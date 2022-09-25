import { WindowPosition } from "../emulator";
import * as vscode from "vscode";
import { TextEditor, TextEditorRevealType } from "vscode";
import { EmacsCommand } from ".";

export class RecenterTopBottom extends EmacsCommand {
    public static readonly id = "recenterTopBottom";

    private recenterPosition: WindowPosition = WindowPosition.Center;

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        if (this.emacs.lastCommand !== RecenterTopBottom.id) {
            this.recenterPosition = WindowPosition.Center;
        }

        const activeRange = new vscode.Range(
            textEditor.selection.active,
            textEditor.selection.active
        );

        switch (this.recenterPosition) {
            case WindowPosition.Center: {
                textEditor.revealRange(
                    activeRange,
                    TextEditorRevealType.InCenter
                );
                this.recenterPosition = WindowPosition.Top;
                break;
            }
            case WindowPosition.Top: {
                textEditor.revealRange(activeRange, TextEditorRevealType.AtTop);
                this.recenterPosition = WindowPosition.Bottom;
                break;
            }
            case WindowPosition.Bottom: {
                // TextEditor.revealRange does not support to set the cursor at the bottom of window.
                // Therefore, the number of lines to scroll is calculated here.
                const visibleRange = textEditor.visibleRanges[0];
                if (visibleRange == null) {
                    return;
                }
                const visibleTop = visibleRange.start.line;
                const visibleBottom = visibleRange.end.line;
                const visibleHeight = visibleBottom - visibleTop;

                const current = textEditor.selection.active.line;

                const nextVisibleTop = Math.max(current - visibleHeight, 1);

                // Scroll so that `nextVisibleTop` is the top of window
                const p = new vscode.Position(nextVisibleTop, 0);
                const r = new vscode.Range(p, p);
                textEditor.revealRange(r);

                this.recenterPosition = WindowPosition.Center;
                break;
            }
        }
    }
}
