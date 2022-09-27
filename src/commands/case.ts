import { Marker } from "../mark-ring";
import * as vscode from "vscode";
import { EmacsCommand } from ".";

abstract class EmacsCaseCommand extends EmacsCommand {
    abstract transformCommand: string;

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        const cursor = Marker.fromCursor(textEditor.selections);
        this.emacs.deactivateMark();
        await this.emacs.runCommand("forwardWord");
        textEditor.selections = cursor.toAnchor(textEditor.selections);
        await vscode.commands.executeCommand(this.transformCommand);
        this.emacs.deactivateRegion();
    }
}

export class TransformToUppercase extends EmacsCaseCommand {
    public static readonly id = "transformToUppercase";

    transformCommand = "editor.action.transformToUppercase";
}

export class TransformToLowercase extends EmacsCaseCommand {
    public static readonly id = "transformToLowercase";

    transformCommand = "editor.action.transformToLowercase";
}

export class TransformToTitlecase extends EmacsCaseCommand {
    public static readonly id = "transformToTitlecase";

    transformCommand = "editor.action.transformToTitlecase";
}
