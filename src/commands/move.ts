import { WindowPosition } from "../emulator";
import * as vscode from "vscode";
import { TextEditor } from "vscode";
import { createParallel, EmacsCommand } from ".";
import {
    travelForward as travelForwardParagraph,
    travelBackward as travelBackwardParagraph,
} from "./helpers/paragraph";

export class FocusBreadcrumbs extends EmacsCommand {
    public static readonly id = "focusBreadcrumbs";

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<unknown> {
        this.emacs.deactivateMark();
        this.emacs.pushMark();
        return vscode.commands.executeCommand("breadcrumbs.focusAndSelect");
    }
}

export class RevealDefinition extends EmacsCommand {
    public static readonly id = "revealDefinition";

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<unknown> {
        this.emacs.deactivateMark();
        this.emacs.pushMark();
        return vscode.commands.executeCommand("editor.action.revealDefinition");
    }
}

export class RevealReference extends EmacsCommand {
    public static readonly id = "revealReference";

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<unknown> {
        this.emacs.deactivateMark();
        this.emacs.pushMark();
        return vscode.commands.executeCommand("revealReference");
    }
}

export class ForwardChar extends EmacsCommand {
    public static readonly id = "forwardChar";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const charDelta = prefixArgument == undefined ? 1 : prefixArgument;

        if (charDelta === 1) {
            return vscode.commands.executeCommand<void>(
                isInMarkMode ? "cursorRightSelect" : "cursorRight"
            );
        } else if (charDelta > 0) {
            const doc = textEditor.document;
            const newSelections = textEditor.selections.map((selection) => {
                const offset = doc.offsetAt(selection.active);
                const newActivePos = doc.positionAt(offset + charDelta);
                const newAnchorPos = isInMarkMode
                    ? selection.anchor
                    : newActivePos;
                return new vscode.Selection(newAnchorPos, newActivePos);
            });
            textEditor.selections = newSelections;
            this.emacs.revealPrimaryCursor();
        }
    }
}

export class BackwardChar extends EmacsCommand {
    public static readonly id = "backwardChar";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const charDelta = prefixArgument == undefined ? 1 : prefixArgument;

        if (charDelta === 1) {
            return vscode.commands.executeCommand<void>(
                isInMarkMode ? "cursorLeftSelect" : "cursorLeft"
            );
        } else if (charDelta > 0) {
            const doc = textEditor.document;
            const newSelections = textEditor.selections.map((selection) => {
                const offset = doc.offsetAt(selection.active);
                const newActivePos = doc.positionAt(offset - charDelta);
                const newAnchorPos = isInMarkMode
                    ? selection.anchor
                    : newActivePos;
                return new vscode.Selection(newAnchorPos, newActivePos);
            });
            textEditor.selections = newSelections;
            this.emacs.revealPrimaryCursor();
        }
    }
}

export class NextLine extends EmacsCommand {
    public static readonly id = "nextLine";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const lineDelta = prefixArgument == undefined ? 1 : prefixArgument;

        return vscode.commands.executeCommand<void>("cursorMove", {
            to: "down",
            by: "wrappedLine",
            value: lineDelta,
            select: isInMarkMode,
        });
    }
}

export class PreviousLine extends EmacsCommand {
    public static readonly id = "previousLine";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const lineDelta = prefixArgument == undefined ? 1 : prefixArgument;

        return vscode.commands.executeCommand<void>("cursorMove", {
            to: "up",
            by: "wrappedLine",
            value: lineDelta,
            select: isInMarkMode,
        });
    }
}

export class MoveBeginningOfLine extends EmacsCommand {
    public static readonly id = "moveBeginningOfLine";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const moveHomeCommand = isInMarkMode
            ? "cursorLineStartSelect"
            : "cursorLineStart";

        const moveHomeCommandFunc = () =>
            vscode.commands.executeCommand<void>(moveHomeCommand);

        if (prefixArgument === undefined || prefixArgument === 1) {
            return moveHomeCommandFunc();
        } else if (prefixArgument > 1) {
            return vscode.commands
                .executeCommand<void>("cursorMove", {
                    to: "down",
                    by: "line",
                    value: prefixArgument - 1,
                    isInMarkMode,
                })
                .then(moveHomeCommandFunc);
        }
    }
}

export class MoveEndOfLine extends EmacsCommand {
    public static readonly id = "moveEndOfLine";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const moveEndCommand = isInMarkMode
            ? "cursorLineEndSelect"
            : "cursorLineEnd";
        const moveEndCommandFunc = () =>
            vscode.commands.executeCommand<void>(moveEndCommand);

        if (prefixArgument === undefined || prefixArgument === 1) {
            return moveEndCommandFunc();
        } else if (prefixArgument > 1) {
            return vscode.commands
                .executeCommand<void>("cursorMove", {
                    to: "down",
                    by: "line",
                    value: prefixArgument - 1,
                    isInMarkMode,
                })
                .then(moveEndCommandFunc);
        }
    }
}

export class ForwardWord extends EmacsCommand {
    public static readonly id = "forwardWord";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<unknown> {
        const repeat = prefixArgument === undefined ? 1 : prefixArgument;

        return createParallel(repeat, () =>
            vscode.commands.executeCommand<void>(
                isInMarkMode ? "cursorWordRightSelect" : "cursorWordRight"
            )
        );
    }
}

export class BackwardWord extends EmacsCommand {
    public static readonly id = "backwardWord";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<unknown> {
        const repeat = prefixArgument === undefined ? 1 : prefixArgument;

        return createParallel(repeat, () =>
            vscode.commands.executeCommand<void>(
                isInMarkMode ? "cursorWordLeftSelect" : "cursorWordLeft"
            )
        );
    }
}

export class BackToIndentation extends EmacsCommand {
    public static readonly id = "backToIndentation";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const doc = textEditor.document;

        const moveActiveFunc = (active: vscode.Position): vscode.Position => {
            const activeLine = doc.lineAt(active.line);
            const charIdxToMove = activeLine.firstNonWhitespaceCharacterIndex;
            const newActive = new vscode.Position(
                activeLine.lineNumber,
                charIdxToMove
            );
            return newActive;
        };

        const newSelections = textEditor.selections.map((selection) => {
            const newActive = moveActiveFunc(selection.active);
            return new vscode.Selection(
                isInMarkMode ? selection.anchor : newActive,
                newActive
            );
        });
        textEditor.selections = newSelections;
        this.emacs.revealPrimaryCursor();
    }
}

export class BeginningOfBuffer extends EmacsCommand {
    public static readonly id = "beginningOfBuffer";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        if (!isInMarkMode) {
            this.emacs.pushMark();
        }
        return vscode.commands.executeCommand<void>(
            isInMarkMode ? "cursorTopSelect" : "cursorTop"
        );
    }
}

export class EndOfBuffer extends EmacsCommand {
    public static readonly id = "endOfBuffer";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        if (!isInMarkMode) {
            this.emacs.pushMark();
        }
        return vscode.commands.executeCommand<void>(
            isInMarkMode ? "cursorBottomSelect" : "cursorBottom"
        );
    }
}

export class ScrollUpCommand extends EmacsCommand {
    public static readonly id = "scrollUpCommand";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const repeat = prefixArgument === undefined ? 1 : prefixArgument;

        if (repeat === 1) {
            await vscode.commands.executeCommand<void>("editorScroll", {
                to: "down",
                by: "page",
            });

            if (!this.emacs.isCursorVisible()) {
                await vscode.commands.executeCommand<void>("cursorMove", {
                    to: "viewPortTop",
                    select: isInMarkMode,
                });

                return vscode.commands.executeCommand<void>("cursorMove", {
                    to: "wrappedLineStart",
                    select: isInMarkMode,
                });
            }
        } else {
            return vscode.commands
                .executeCommand<void>("cursorMove", {
                    to: "down",
                    by: "wrappedLine",
                    value: repeat,
                    select: isInMarkMode,
                })
                .then(() => this.emacs.revealPrimaryCursor());
        }
    }
}

export class ScrollDownCommand extends EmacsCommand {
    public static readonly id = "scrollDownCommand";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const repeat = prefixArgument === undefined ? 1 : prefixArgument;

        if (repeat === 1) {
            await vscode.commands.executeCommand<void>("editorScroll", {
                to: "up",
                by: "page",
            });

            if (!this.emacs.isCursorVisible()) {
                await vscode.commands.executeCommand<void>("cursorMove", {
                    to: "viewPortBottom",
                    select: isInMarkMode,
                });

                return vscode.commands.executeCommand<void>("cursorMove", {
                    to: "wrappedLineStart",
                    select: isInMarkMode,
                });
            }
        } else {
            return vscode.commands
                .executeCommand<void>("cursorMove", {
                    to: "up",
                    by: "wrappedLine",
                    value: repeat,
                    select: isInMarkMode,
                })
                .then(() => this.emacs.revealPrimaryCursor());
        }
    }
}

export class ForwardParagraph extends EmacsCommand {
    public static readonly id = "forwardParagraph";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const repeat = prefixArgument === undefined ? 1 : prefixArgument;
        const doc = textEditor.document;

        const repeatedTravelForwardParagraph = (
            pos: vscode.Position
        ): vscode.Position => {
            for (let i = 0; i < repeat; ++i) {
                pos = travelForwardParagraph(doc, pos);
            }
            return pos;
        };

        const newSelections = textEditor.selections.map((selection) => {
            const newActive = repeatedTravelForwardParagraph(selection.active);
            return new vscode.Selection(
                isInMarkMode ? selection.anchor : newActive,
                newActive
            );
        });
        textEditor.selections = newSelections;
        this.emacs.revealPrimaryCursor();
    }
}

export class BackwardParagraph extends EmacsCommand {
    public static readonly id = "backwardParagraph";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const repeat = prefixArgument === undefined ? 1 : prefixArgument;
        const doc = textEditor.document;

        const repeatedTravelBackwardParagraph = (
            pos: vscode.Position
        ): vscode.Position => {
            for (let i = 0; i < repeat; ++i) {
                pos = travelBackwardParagraph(doc, pos);
            }
            return pos;
        };

        const newSelections = textEditor.selections.map((selection) => {
            const newActive = repeatedTravelBackwardParagraph(selection.active);
            return new vscode.Selection(
                isInMarkMode ? selection.anchor : newActive,
                newActive
            );
        });
        textEditor.selections = newSelections;
        this.emacs.revealPrimaryCursor();
    }
}

export class MoveToWindowLineTopBottomCommand extends EmacsCommand {
    public static readonly id = "moveToWindowLineTopBottom";

    private targetPosition = WindowPosition.Center;

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        if (this.emacs.lastCommand !== MoveToWindowLineTopBottomCommand.id) {
            this.targetPosition = WindowPosition.Center;
        } else {
            switch (this.targetPosition) {
                case WindowPosition.Center: {
                    this.targetPosition = WindowPosition.Top;
                    break;
                }
                case WindowPosition.Top: {
                    this.targetPosition = WindowPosition.Bottom;
                    break;
                }
                case WindowPosition.Bottom: {
                    this.targetPosition = WindowPosition.Center;
                    break;
                }
            }
        }
        return this.emacs.moveCursorToWindowLine(this.targetPosition);
    }
}
