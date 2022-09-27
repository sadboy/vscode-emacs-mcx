import { TextEditor, TextEditorRevealType } from "vscode";
import { EmacsCommand } from ".";

export class RotatePrimaryCursorNext extends EmacsCommand {
    public static id = "rotatePrimaryCursorNext";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        if (textEditor.selections.length > 1) {
            textEditor.selections = [
                ...textEditor.selections.slice(1),
                textEditor.selection,
            ];
        }
        return this.emacs.revealPrimaryCursor(
            TextEditorRevealType.InCenterIfOutsideViewport
        );
    }
}

export class RotatePrimaryCursorPrev extends EmacsCommand {
    public static id = "rotatePrimaryCursorPrev";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        if (textEditor.selections.length > 1) {
            textEditor.selections = [
                textEditor.selections[textEditor.selections.length - 1]!,
                ...textEditor.selections.slice(
                    0,
                    textEditor.selections.length - 1
                ),
            ];
        }
        return this.emacs.revealPrimaryCursor(
            TextEditorRevealType.InCenterIfOutsideViewport
        );
    }
}

export class DeletePrimaryCursor extends EmacsCommand {
    public static id = "deletePrimaryCursor";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        if (textEditor.selections.length > 1) {
            textEditor.selections = textEditor.selections.slice(1);
        }
        return this.emacs.revealPrimaryCursor(
            TextEditorRevealType.InCenterIfOutsideViewport
        );
    }
}
