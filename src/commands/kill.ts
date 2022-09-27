import * as vscode from "vscode";
import { Position, Range, TextDocument, TextEditor } from "vscode";
import { EmacsCommand } from ".";
import { EmacsEmulator } from "../emulator";
import { KillYanker } from "../kill-yank";
import { Configuration } from "../configuration/configuration";
import {
    WordCharacterClassifier,
    getMapForWordSeparators,
} from "vs/editor/common/controller/wordCharacterClassifier";
import {
    findNextWordEnd,
    findPreviousWordStart,
} from "./helpers/wordOperations";
import { MessageManager } from "../message";
import { AppendDirection } from "../kill-yank/kill-ring";

function getWordSeparators(): WordCharacterClassifier {
    // Ref: https://github.com/VSCodeVim/Vim/blob/91ca71f8607458c0558f9aff61e230c6917d4b51/src/configuration/configuration.ts#L155
    const activeTextEditor = vscode.window.activeTextEditor;
    const resource = activeTextEditor ? activeTextEditor.document.uri : null;
    const maybeWordSeparators = vscode.workspace.getConfiguration(
        "editor",
        resource
    ).wordSeparators;
    // Ref: https://github.com/microsoft/vscode/blob/bc9f2577cd8e297b003e5ca652e19685504a1e50/src/vs/editor/contrib/wordOperations/wordOperations.ts#L45
    return getMapForWordSeparators(
        typeof maybeWordSeparators === "string" ? maybeWordSeparators : ""
    );
}

export abstract class KillYankCommand extends EmacsCommand {
    protected killYanker: KillYanker;

    public constructor(emacsController: EmacsEmulator) {
        super(emacsController);

        this.killYanker = emacsController.killYanker;
    }
}

function findNextKillWordRange(
    doc: TextDocument,
    position: Position,
    repeat = 1
) {
    if (repeat <= 0) {
        throw new Error(`Invalid repeat ${repeat}`);
    }

    const wordSeparators = getWordSeparators();

    let wordEnd = position;
    for (let i = 0; i < repeat; ++i) {
        wordEnd = findNextWordEnd(doc, wordSeparators, wordEnd);
    }

    const range = new Range(position, wordEnd);
    return range.isEmpty ? undefined : range;
}

export class KillWord extends KillYankCommand {
    public static readonly id = "killWord";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const repeat = prefixArgument === undefined ? 1 : prefixArgument;
        if (repeat <= 0) {
            return;
        }

        const killRanges = textEditor.selections
            .map((selection) =>
                findNextKillWordRange(
                    textEditor.document,
                    selection.active,
                    repeat
                )
            )
            .filter(
                <T>(maybeRange: T | undefined): maybeRange is T =>
                    maybeRange != null
            );
        await this.killYanker.kill(killRanges);
        this.emacs.revealPrimaryCursor();
    }
}

function findPreviousKillWordRange(
    doc: TextDocument,
    position: Position,
    repeat = 1
) {
    if (repeat <= 0) {
        throw new Error(`Invalid repeat ${repeat}`);
    }

    const wordSeparators = getWordSeparators();

    let wordStart = position;
    for (let i = 0; i < repeat; ++i) {
        wordStart = findPreviousWordStart(doc, wordSeparators, wordStart);
    }

    const range = new Range(wordStart, position);

    return range.isEmpty ? undefined : range;
}

export class BackwardKillWord extends KillYankCommand {
    public static readonly id = "backwardKillWord";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const repeat = prefixArgument === undefined ? 1 : prefixArgument;
        if (repeat <= 0) {
            return;
        }

        const killRanges = textEditor.selections
            .map((selection) =>
                findPreviousKillWordRange(
                    textEditor.document,
                    selection.active,
                    repeat
                )
            )
            .filter(
                <T>(maybeRange: T | undefined): maybeRange is T =>
                    maybeRange != null
            );
        await this.killYanker.kill(killRanges, AppendDirection.Backward);
        this.emacs.revealPrimaryCursor();
    }
}

export class KillLine extends KillYankCommand {
    public static readonly id = "killLine";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const killWholeLine = Configuration.instance.killWholeLine;

        const ranges = textEditor.selections.map((selection) => {
            const cursor = selection.active;
            const lineAtCursor = textEditor.document.lineAt(cursor.line);

            if (prefixArgument !== undefined) {
                return new Range(
                    cursor,
                    new Position(cursor.line + prefixArgument, 0)
                );
            }

            if (killWholeLine && cursor.character === 0) {
                return new Range(cursor, new Position(cursor.line + 1, 0));
            }

            const lineEnd = lineAtCursor.range.end;

            if (cursor.isEqual(lineEnd)) {
                // From the end of the line to the beginning of the next line
                return new Range(cursor, new Position(cursor.line + 1, 0));
            } else {
                // From the current cursor to the end of line
                return new Range(cursor, lineEnd);
            }
        });
        this.emacs.deactivateMark();
        await this.killYanker.kill(ranges);
        return this.emacs.revealPrimaryCursor();
    }
}

export class KillWholeLine extends KillYankCommand {
    public static readonly id = "killWholeLine";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const ranges = textEditor.selections.map(
            (selection) =>
                // From the beginning of the line to the beginning of the next line
                new Range(
                    new Position(selection.active.line, 0),
                    new Position(selection.active.line + 1, 0)
                )
        );
        this.emacs.deactivateMark();
        await this.killYanker.kill(ranges);
        return this.emacs.revealPrimaryCursor();
    }
}

export class KillRegion extends KillYankCommand {
    public static readonly id = "killRegion";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const controller = this.emacs;
        const ranges = controller
            .getRegion()
            .filter((selection) => !selection.isEmpty);
        await this.killYanker.kill(ranges);
        this.emacs.deactivateMark();
        this.killYanker.cancelKillAppend();
        this.emacs.revealPrimaryCursor();
    }
}

// TODO: Rename to kill-ring-save (original emacs command name)
export class CopyRegion extends KillYankCommand {
    public static readonly id = "copyRegion";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const ranges = this.emacs
            .getRegion()
            .filter((selection) => !selection.isEmpty);
        await this.killYanker.copy(ranges);
        this.emacs.deactivateMark();
        this.killYanker.cancelKillAppend();
        this.emacs.revealPrimaryCursor();
    }
}

export class Yank extends KillYankCommand {
    public static readonly id = "yank";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        await this.killYanker.yank();
        this.emacs.deactivateMark();
        this.emacs.revealPrimaryCursor();
    }
}

export class YankPop extends KillYankCommand {
    public static readonly id = "yank-pop";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        if (
            !this.emacs.killYanker.docChangedAfterYank &&
            this.emacs.lastCommand === Yank.id
        ) {
            this.emacs.thisCommand = Yank.id;
            await this.killYanker.yankPop();
            this.emacs.deactivateMark();
            this.emacs.revealPrimaryCursor();
        } else if (this.emacs.killRing) {
            const selected = await vscode.window.showQuickPick(
                this.emacs.killRing.getRingAsQuickPickItems(),
                {
                    title: "Kill Ring",
                    canPickMany: false,
                }
            );
            if (selected) {
                this.emacs.killRing.setTop(selected);
                await this.killYanker.yankTop();
            }
        } else {
            MessageManager.showMessage("Previous command was not a yank");
        }
    }
}
