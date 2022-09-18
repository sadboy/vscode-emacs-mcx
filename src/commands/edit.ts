import * as vscode from "vscode";
import { TextEditor } from "vscode";
import { createParallel, EmacsCommand } from ".";

export class DeleteBackwardChar extends EmacsCommand {
    public static readonly id = "deleteBackwardChar";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<unknown> {
        const repeat = prefixArgument === undefined ? 1 : prefixArgument;
        return createParallel(repeat, () =>
            vscode.commands.executeCommand("deleteLeft")
        );
    }
}

export class DeleteForwardChar extends EmacsCommand {
    public static readonly id = "deleteForwardChar";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void[]> {
        const repeat = prefixArgument === undefined ? 1 : prefixArgument;
        return createParallel(repeat, () =>
            vscode.commands.executeCommand<void>("deleteRight")
        );
    }
}

export class NewLine extends EmacsCommand {
    public static readonly id = "newLine";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void[]> {
        this.emacsController.deactivateMark();

        const repeat = prefixArgument === undefined ? 1 : prefixArgument;
        return createParallel(repeat, () =>
            vscode.commands.executeCommand<void>("default:type", { text: "\n" })
        );
    }
}
