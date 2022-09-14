import * as vscode from "vscode";
import { TextEditor } from "vscode";
import { EmacsCommand } from ".";

export class AddSelectionToNextFindMatch extends EmacsCommand {
  public static readonly id = "addSelectionToNextFindMatch";

  public execute(
    textEditor: TextEditor, isInMarkMode: boolean, prefixArgument: number | undefined
  ): Thenable<void> {
    this.emacsController.deactivateMark()
    return vscode.commands.executeCommand<void>("editor.action.addSelectionToNextFindMatch");
  }
}

export class AddSelectionToPreviousFindMatch extends EmacsCommand {
  public static readonly id = "addSelectionToPreviousFindMatch";

  public execute(
    textEditor: TextEditor, isInMarkMode: boolean, prefixArgument: number | undefined
  ): Thenable<void> {
    this.emacsController.deactivateMark()
    return vscode.commands.executeCommand<void>("editor.action.addSelectionToPreviousFindMatch");
  }
}
