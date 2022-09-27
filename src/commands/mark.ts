import { EmacsEmulator } from "src/emulator";
import { Marker } from "../mark-ring";
import * as vscode from "vscode";
import { EmacsCommand } from ".";
import { revealPrimaryActive } from "./helpers/reveal";

export class SetMarkCommand extends EmacsCommand {
    public static readonly id = "setMarkCommand";

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<unknown> {
        const controller: EmacsEmulator = this.emacs;

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

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const controller = this.emacs;

        controller.deactivateMark();
        if (controller.mark) {
            textEditor.selections = controller.mark.toCursor();
        }
        controller.popMark();
        revealPrimaryActive(textEditor);
    }
}

export class ExchangePointAndMarkCommand extends EmacsCommand {
    public static readonly id = "exchangePointAndMark";

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const controller = this.emacs;
        if (controller.prefixArgumentHandler.precedingSingleCtrlU()) {
            controller.activateMark();
        }
        return this.emacs.exchangePointAndMark();
    }
}

export class RectangleModeCommand extends EmacsCommand {
    public static readonly id = "rectangleMode";

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        this.emacs.activateRegion();
        await vscode.commands.executeCommand(
            "editor.action.toggleColumnSelection"
        );
        const newMark = Marker.fromAnchor(textEditor.selections);
        this.emacs.pushMark(newMark, true, true);
    }
}
