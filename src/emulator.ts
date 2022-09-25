import * as vscode from "vscode";
import { Selection, TextDocument, TextEditor } from "vscode";
import { EmacsCommandRegistry } from "./commands/registry";
import { KillYanker } from "./kill-yank";
import { KillRing } from "./kill-yank/kill-ring";
import { logger } from "./logger";
import { MessageManager } from "./message";
import { PrefixArgumentHandler } from "./prefix-argument";
import { Configuration } from "./configuration/configuration";
import { Marker, MarkRing } from "./mark-ring";
import { InputBoxMinibuffer, Minibuffer } from "./minibuffer";
import { revealPrimaryActive } from "./commands/helpers/reveal";
import assert from "assert";

export interface SearchState {
    startSelections: readonly vscode.Selection[] | undefined;
}

export class EmacsEmulator {
    public readonly uri: string;
    public readonly miniBuffer: Minibuffer;
    public readonly killRing: KillRing | null;
    public readonly killYanker: KillYanker;
    public readonly searchState: SearchState;
    public readonly prefixArgumentHandler: PrefixArgumentHandler;
    public thisCommand: string | undefined = undefined;

    public get lastCommand(): string | undefined {
        return this._lastCommand;
    }

    public get editor(): TextEditor {
        return this._editor;
    }

    public get document(): TextDocument {
        return this._document;
    }

    public get mark(): Marker | undefined {
        return this.markRing.getTop();
    }

    public isMarkActive(): this is { mark: Marker } {
        return this._isMarkActive;
    }

    public isRegionActive(): boolean {
        return this._editor.selections.some((selection) => !selection.isEmpty);
    }

    public getRegion(): Selection[] {
        if (!this.mark) {
            return [];
        } else {
            return this.mark.toAnchor(this._editor.selections);
        }
    }

    public get numCursors(): number {
        return this._editor.selections.length;
    }

    constructor(
        textEditor: vscode.TextEditor,
        killRing: KillRing | null = null,
        minibuffer: Minibuffer = new InputBoxMinibuffer(),
        prefixArgumentHandler: PrefixArgumentHandler = new PrefixArgumentHandler()
    ) {
        this._editor = textEditor;
        this._document = textEditor.document;
        this.killRing = killRing;
        this.miniBuffer = minibuffer;
        this.prefixArgumentHandler = prefixArgumentHandler;

        this.uri = this._document.uri.toString();
        this.markRing = new MarkRing(Configuration.instance.markRingMax);

        this.commandRegistry = new EmacsCommandRegistry(this);
        this.afterCommand = this.afterCommand.bind(this);

        this.searchState = { startSelections: undefined };
        this.killYanker = new KillYanker(this);
    }

    public onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent): void {
        assert(e.document.uri.toString() === this.uri);

        if (
            e.contentChanges.some((contentChange) =>
                this._editor.selections.some((selection) =>
                    contentChange.range.intersection(selection)
                )
            )
        ) {
            this.deactivateMark(false);
        }
        this.killYanker.onDidChangeTextDocument();
    }

    private _hasSelectionStateChanged(): boolean {
        if (this._lastSelections === this._editor.selections) {
            return false;
        }
        if (this._lastSelections.length !== this._editor.selections.length) {
            return true;
        }
        for (let idx = 0; idx < this._lastSelections.length; idx++) {
            const left = this._lastSelections[idx];
            const right = this._editor.selections[idx];

            if (left === right) {
                continue;
            } else if (
                left === undefined ||
                right === undefined ||
                !left.isEqual(right)
            ) {
                return true;
            }
        }
        return false;
    }

    public onDidChangeTextEditorSelection(
        e: vscode.TextEditorSelectionChangeEvent
    ): void {
        assert(e.textEditor.document.uri.toString() === this.uri);

        if (!this._isInCommand && this._hasSelectionStateChanged()) {
            // Editor state was modified by forces beyond our control:
            this.thisCommand = undefined;
            if (this.editor !== e.textEditor) {
                this.attachEditor(e.textEditor);
            } else if (e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
                this._syncEditorState();
            } else {
                this._syncMarkAndSelection();
            }
        }
        this.killYanker.onDidChangeTextEditorSelection();
    }

    public attachEditor(textEditor: TextEditor): void {
        if (this.editor === textEditor) {
            return;
        }

        assert(textEditor.document.uri.toString() === this.uri);

        this._editor = textEditor;
        this._document = textEditor.document;
        this._syncEditorState();
        this.killYanker.attachEditor(textEditor);
    }

    private _syncEditorState(): void {
        if (this.isRegionActive()) {
            const mark = Marker.fromAnchor(this.editor.selections);
            // Replace the current mark:
            this.markRing.push(mark, true);
            this.activateMark(true);
        } else {
            this.deactivateMark(false);
        }
        this._lastSelections = this.editor.selections;
    }

    private _syncMarkAndSelection(): void {
        if (this.isRegionActive()) {
            // Outside command activated region, update our mark to match:
            const mark = Marker.fromAnchor(this.editor.selections);
            this.activateMark();
            if (!this.mark || !mark.isEqual(this.mark)) {
                this.pushMark(mark);
            }
        } else if (this.isMarkActive()) {
            // Mark is active but outside command deactivated region, so we reactivate:
            this._editor.selections = this.mark.toAnchor(
                this._editor.selections
            );
        }
        this._lastSelections = this.editor.selections;
    }

    /**
     * An extended version of the native `type` command with prefix argument integration.
     */
    public typeChar(char: string): void | Thenable<unknown> {
        if (this.isMarkActive()) {
            this.deactivateMark();
        }

        if (char === "-" && this.prefixArgumentHandler.minusSignAcceptable) {
            return this.prefixArgumentHandler.negativeArgument();
        }

        const prefixArgument = this.prefixArgumentHandler.getPrefixArgument();
        this.prefixArgumentHandler.cancel();

        const repeat = prefixArgument == null ? 1 : prefixArgument;
        if (repeat < 0) {
            MessageManager.showMessage(
                `Negative repetition argument ${repeat}`
            );
            return;
        }

        if (repeat == 1) {
            // It's better to use `type` command than `TextEditor.edit` method
            // because `type` command invokes features like auto-completion reacting to character inputs.
            return vscode.commands.executeCommand("type", { text: char });
        }

        return this._editor.edit((editBuilder) => {
            this._editor.selections.forEach((selection) => {
                editBuilder.insert(selection.active, char.repeat(repeat));
            });
        });
    }

    // Ref: https://github.com/Microsoft/vscode-extension-samples/blob/f9955406b4cad550fdfa891df23a84a2b344c3d8/vim-sample/src/extension.ts#L152
    public type(text: string): Thenable<unknown> {
        // Single character input with prefix argument
        // NOTE: This single character handling should be replaced with `EmacsEmulator.typeChar` directly bound to relevant keystrokes,
        // however, it's difficult to cover all characters without `type` event registration,
        // then this method can be used to handle single character inputs other than ASCII characters,
        // for those who want it as an option.
        const prefixArgument = this.prefixArgumentHandler.getPrefixArgument();
        this.prefixArgumentHandler.cancel();

        logger.debug(
            `[EmacsEmulator.type]\t Single char (text: "${text}", prefix argument: ${prefixArgument}).`
        );
        if (prefixArgument !== undefined && prefixArgument >= 0) {
            const promises = [];
            for (let i = 0; i < prefixArgument; ++i) {
                const promise = vscode.commands.executeCommand("default:type", {
                    text,
                });
                promises.push(promise);
            }
            // NOTE: Current implementation executes promises concurrently. Should it be sequential?
            return Promise.all(promises);
        }

        logger.debug(
            `[EmacsEmulator.type]\t Execute "default:type" (text: "${text}")`
        );
        return vscode.commands.executeCommand("default:type", {
            text,
        });
    }

    public async runCommand(
        commandName: string,
        ...args: unknown[]
    ): Promise<void> {
        const command = this.commandRegistry.get(commandName);

        if (command === undefined) {
            throw Error(`command ${commandName} is not found`);
        }

        this._isInCommand = true;
        this._lastCommand = this.thisCommand;
        this.thisCommand = commandName;

        try {
            await command.run(...args);
        } finally {
            this.afterCommand();
            this._lastSelections = this._editor.selections;
            this._isInCommand = false;
        }
    }

    /**
     * Invoked by C-g
     */
    public cancel(): void {
        this.thisCommand = "cancel";

        if (this.isMarkActive() || this.isRegionActive()) {
            this.deactivateMark();
        } else {
            this.cancelMultiCursor();
        }

        this.killYanker.cancelKillAppend();
        this.prefixArgumentHandler.cancel();

        this._lastSelections = this._editor.selections;

        MessageManager.showMessage("Quit");
    }

    public activateMark(nomsg = false): void {
        if (!this.isMarkActive) {
            this._isMarkActive = true;

            // At this moment, the only way to set the context for `when` conditions is `setContext` command.
            // The discussion is ongoing in https://github.com/Microsoft/vscode/issues/10471
            // TODO: How to write unittest for `setContext`?
            vscode.commands.executeCommand(
                "setContext",
                "emacs-mcx.inMarkMode",
                true
            );
            if (!nomsg) {
                MessageManager.showMessage("Mark activated");
            }
        }
    }

    public pushMark(
        newMark: Marker | undefined = undefined,
        nomsg = false,
        activate = false
    ): asserts this is { mark: Marker } {
        if (newMark === undefined) {
            newMark = Marker.fromCursor(this._editor.selections);
        }
        this.markRing.push(newMark);
        if (!nomsg) {
            MessageManager.showMessage("Mark set");
        }
        if (activate) {
            this.activateMark(nomsg);
        }
    }

    public popMark(): Marker | undefined {
        return this.markRing.pop();
    }

    public exchangePointAndMark(): void {
        if (this.mark) {
            const cursor = Marker.fromCursor(this._editor.selections);
            let newSelections = this.mark.toCursor(this._editor.selections);
            if (this.isMarkActive()) {
                newSelections = cursor.toAnchor(newSelections);
            }
            this._editor.selections = newSelections;
            this.markRing.push(cursor, true);
            return revealPrimaryActive(this._editor);
        } else {
            MessageManager.showMessage("No mark set in this buffer");
        }
    }

    public deactivateMark(andRegion = true): void {
        if (this.isMarkActive()) {
            this._isMarkActive = false;
            if (andRegion) {
                this.deactivateRegion();
            }
            vscode.commands.executeCommand(
                "setContext",
                "emacs-mcx.inMarkMode",
                false
            );
        }
    }

    public executeCommandWithPrefixArgument<T>(
        command: string,
        args: Record<string, unknown> | undefined = undefined,
        prefixArgumentKey = "prefixArgument"
    ): Thenable<T | undefined> {
        const prefixArgument = this.prefixArgumentHandler.getPrefixArgument();
        this.prefixArgumentHandler.cancel();

        return vscode.commands.executeCommand<T>(command, {
            ...args,
            [prefixArgumentKey]: prefixArgument,
        });
    }

    public getPrefixArgument(): number | undefined {
        return this.prefixArgumentHandler.getPrefixArgument();
    }

    public activateRegion(): void {
        if (this.mark) {
            this.editor.selections = this.mark.toAnchor(this.editor.selections);
        }
    }

    public deactivateRegion(): void {
        this.editor.selections = this.editor.selections.map(
            (selection) => new Selection(selection.active, selection.active)
        );
    }

    public isCursorVisible(): boolean {
        const cursor = this.editor.selection.active;
        return this.editor.visibleRanges.some((range) =>
            range.contains(cursor)
        );
    }

    private cancelMultiCursor() {
        this._editor.selections = [this._editor.selection];
    }

    private afterCommand() {
        return this.prefixArgumentHandler.cancel();
    }

    private _editor: TextEditor;
    private _document: TextDocument;
    private _lastSelections: readonly vscode.Selection[] = [];
    private _isMarkActive = false;
    private _isInCommand = false;
    private _lastCommand: string | undefined = undefined;
    private readonly commandRegistry: EmacsCommandRegistry;
    private readonly markRing: MarkRing;
}
