import { EmacsEmulator } from "src/emulator";
import * as vscode from "vscode";
import { EmacsCommand } from ".";
import { revealPrimaryActive } from "./helpers/reveal";

export class SetMarkCommand extends EmacsCommand {
    public static readonly id = "setMarkCommand";

    public execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): void | Thenable<unknown> {
        const controller: EmacsEmulator = this.emacsController;

        if (
            controller.prefixArgumentHandler.precedingSingleCtrlU() ||
            controller.lastCommand === "popMark"
        ) {
            controller.prefixArgumentHandler.cancel();
            return controller.runCommand("popMark");
        } else {
            if (controller.lastCommand === "setMarkCommand") {
                if (isInMarkMode) {
                    controller.deactivateMark();
                } else {
                    controller.activateMark();
                }
            } else {
                controller.deactivateMark();
                controller.pushMark();
            }
        }
    }
}

export class PopMarkCommand extends EmacsCommand {
    public static readonly id = "popMark";

    public execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): void | Thenable<unknown> {
        const controller = this.emacsController;

        if (isInMarkMode) {
            controller.deactivateMark();
        }

        if (controller.mark) {
            textEditor.selections = controller.mark.toCursor(
                textEditor.selections
            );
            revealPrimaryActive(textEditor);
        }
        controller.popMark();
    }
}

export class ExchangePointAndMarkCommand extends EmacsCommand {
    public static readonly id = "exchangePointAndMark";

    public execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): void | Thenable<unknown> {
        const controller = this.emacsController;
        if (controller.prefixArgumentHandler.precedingSingleCtrlU()) {
            controller.activateMark();
        }
        return this.emacsController.exchangePointAndMark();
    }
}
