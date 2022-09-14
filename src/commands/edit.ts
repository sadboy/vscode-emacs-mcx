import * as vscode from "vscode";
import { Selection, TextEditor } from "vscode";
import { createParallel, EmacsCommand } from ".";

export class DeleteBackwardChar extends EmacsCommand {
  public static readonly id = "deleteBackwardChar";

  public execute(textEditor: TextEditor, isInMarkMode: boolean, prefixArgument: number | undefined): Thenable<unknown> {
    const repeat = prefixArgument === undefined ? 1 : prefixArgument;
    return createParallel(repeat, () => vscode.commands.executeCommand("deleteLeft"));
  }
}

export class DeleteForwardChar extends EmacsCommand {
  public static readonly id = "deleteForwardChar";

  public execute(textEditor: TextEditor, isInMarkMode: boolean, prefixArgument: number | undefined) {
    const repeat = prefixArgument === undefined ? 1 : prefixArgument;
    return createParallel(repeat, () => vscode.commands.executeCommand<void>("deleteRight"));
  }
}

export class NewLine extends EmacsCommand {
  public static readonly id = "newLine";

  public execute(textEditor: TextEditor, isInMarkMode: boolean, prefixArgument: number | undefined) {
    this.emacsController.deactivateMark();

    textEditor.selections = textEditor.selections.map((selection) => new Selection(selection.active, selection.active));

    const repeat = prefixArgument === undefined ? 1 : prefixArgument;
    return createParallel(repeat, () => vscode.commands.executeCommand<void>("default:type", { text: "\n" }));
  }
}
