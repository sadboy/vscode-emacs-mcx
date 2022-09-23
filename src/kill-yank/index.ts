import { Marker } from "../mark-ring";
import { Minibuffer } from "../minibuffer";
import * as vscode from "vscode";
import { Range, TextEditor } from "vscode";
import { IKillRingEntity, KillRing } from "./kill-ring";
import { ClipboardTextKillRingEntity } from "./kill-ring-entity/clipboard-text";
import { AppendableRegionTexts, AppendDirection } from "./kill-ring";
import { EmacsEmulator } from "src/emulator";
import assert from "assert";
import { EditorTextKillRingEntity } from "./kill-ring-entity/editor-text";

export class KillYanker {
    private emacs: EmacsEmulator;
    private textEditor: TextEditor;
    private readonly killRing: KillRing | null; // If null, killRing is disabled and only clipboard is used.
    private readonly minibuffer: Minibuffer;

    private isAppending = false;
    private prevKillPosition: Marker | undefined;
    public docChangedAfterYank = false;

    constructor(emulator: EmacsEmulator) {
        this.emacs = emulator;
        this.textEditor = emulator.editor;
        this.killRing = emulator.killRing;
        this.minibuffer = emulator.miniBuffer;

        this.docChangedAfterYank = false;
        this.prevKillPosition = undefined;
    }

    public getTextEditor(): TextEditor {
        return this.textEditor;
    }

    public attachEditor(textEditor: TextEditor): void {
        if (this.textEditor !== textEditor) {
            this.textEditor = textEditor;
            this.onDidChangeTextEditorSelection();
        }
    }

    public onDidChangeTextDocument(): void {
        this.docChangedAfterYank = true;
        this.isAppending = false;
    }

    public onDidChangeTextEditorSelection(): void {
        this.docChangedAfterYank = true;
        this.isAppending = false;
    }

    public async kill(
        ranges: Range[],
        appendDirection: AppendDirection = AppendDirection.Forward
    ): Promise<void> {
        if (
            !this.prevKillPosition ||
            !this.prevKillPosition.isEqual(
                Marker.fromCursor(this.textEditor.selections)
            )
        ) {
            this.isAppending = false;
        }

        await this.copy(ranges, this.isAppending, appendDirection);

        await this.delete(ranges);

        this.isAppending = true;
        this.prevKillPosition = Marker.fromCursor(this.textEditor.selections);
    }

    public async copy(
        ranges: Range[],
        shouldAppend = false,
        appendDirection: AppendDirection = AppendDirection.Forward
    ): Promise<void> {
        const newKillEntity = new EditorTextKillRingEntity(
            ranges.map((range) => ({
                range,
                text: this.textEditor.document.getText(range),
            }))
        );

        if (this.killRing !== null) {
            const currentKill = this.killRing.getTop();
            if (
                shouldAppend &&
                currentKill instanceof EditorTextKillRingEntity
            ) {
                currentKill.append(newKillEntity, appendDirection);
                return vscode.env.clipboard.writeText(currentKill.asString());
            } else {
                this.killRing.push(newKillEntity);
                return vscode.env.clipboard.writeText(newKillEntity.asString());
            }
        } else {
            return vscode.env.clipboard.writeText(newKillEntity.asString());
        }
    }

    public cancelKillAppend(): void {
        this.isAppending = false;
    }

    private async paste(killRingEntity: IKillRingEntity): Promise<boolean> {
        const flattenedText = killRingEntity.asString();
        if (this.minibuffer.isReading) {
            this.minibuffer.paste(flattenedText);
            return true;
        }

        const target = this.textEditor.selections;
        let chunks: readonly AppendableRegionTexts[] | undefined = undefined;

        if (target.length > 1 && killRingEntity.type === "editor") {
            chunks = killRingEntity.getRegionTexts();
            if (chunks.length <= 1 || chunks.length < target.length) {
                chunks = undefined;
            }
        }
        return this.textEditor.edit((editBuilder) => {
            target.forEach((selection, i) => {
                if (!selection.isEmpty) {
                    editBuilder.delete(selection);
                }
                editBuilder.insert(
                    selection.start,
                    chunks
                        ? // `chunks.length >= selections.length` has already been checked,
                          // so noUncheckedIndexedAccess rule can be skipped here.
                          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                          chunks[i]!.getAppendedText()
                        : flattenedText
                );
            });
        });
    }

    public async yank(): Promise<unknown> {
        if (this.killRing === null) {
            return vscode.commands.executeCommand(
                "editor.action.clipboardPasteAction"
            );
        }

        const clipboardText = await vscode.env.clipboard.readText();
        const killRingEntityToPaste = this.killRing.getZero();

        if (
            !killRingEntityToPaste ||
            !killRingEntityToPaste.isSameClipboardText(clipboardText)
        ) {
            this.killRing.push(new ClipboardTextKillRingEntity(clipboardText));
        }

        return this.yankTop();
    }

    public async yankTop(): Promise<boolean> {
        if (this.killRing === null) {
            return false;
        }

        const item = this.killRing.getTop();

        assert(item);

        const anchor = Marker.fromAnchor(this.textEditor.selections);
        if (await this.paste(item)) {
            this.docChangedAfterYank = false;
            this.emacs.pushMark(anchor, true, false);
            this.emacs.deactivateRegion();
            return true;
        } else {
            this.docChangedAfterYank = true;
            return false;
        }
    }

    public async yankPop(): Promise<boolean> {
        if (this.killRing === null) {
            return false;
        }

        if (this.docChangedAfterYank) {
            return false;
        }

        assert(this.emacs.mark);

        const killRingEntity = this.killRing.popNext();
        if (!killRingEntity) {
            return false;
        }
        // Activate the region:
        this.textEditor.selections = this.emacs.mark.toAnchor(
            this.textEditor.selections
        );
        if (await this.paste(killRingEntity)) {
            this.docChangedAfterYank = false;
            return true;
        } else {
            return false;
        }
    }

    private async delete(
        ranges: vscode.Range[],
        maxTrials = 3
    ): Promise<boolean> {
        let success = false;
        let trial = 0;
        while (!success && trial < maxTrials) {
            success = await this.textEditor.edit((editBuilder) => {
                ranges.forEach((range) => {
                    editBuilder.delete(range);
                });
            });
            trial++;
        }

        return success;
    }
}
