import { EmacsCommand } from ".";
import { AddSelectionToNextFindMatch, AddSelectionToPreviousFindMatch } from "./add-selection-to-find-match";
import * as CaseCommands from "./case";
import { DeleteBlankLines } from "./delete-blank-lines";
import * as EditCommands from "./edit";
import * as FindCommands from "./find";
import * as KillCommands from "./kill";
import * as MoveCommands from "./move";
import * as PareditCommands from "./paredit";
import * as RectangleCommands from "./rectangle";
import { RecenterTopBottom } from "./recenter";
import { EmacsEmulator } from "src/emulator";
import { ExchangePointAndMarkCommand, PopMarkCommand, RectangleMarkModeCommand, SetMarkCommand } from "./mark";

const _CommandRegister = new Map([
  SetMarkCommand,
  PopMarkCommand,
  ExchangePointAndMarkCommand,
  RectangleMarkModeCommand,

  MoveCommands.ForwardChar,
  MoveCommands.BackwardChar,
  MoveCommands.NextLine,
  MoveCommands.PreviousLine,
  MoveCommands.MoveBeginningOfLine,
  MoveCommands.MoveEndOfLine,
  MoveCommands.ForwardWord,
  MoveCommands.BackwardWord,
  MoveCommands.BackToIndentation,
  MoveCommands.BeginningOfBuffer,
  MoveCommands.EndOfBuffer,
  MoveCommands.ScrollUpCommand,
  MoveCommands.ScrollDownCommand,
  MoveCommands.ForwardParagraph,
  MoveCommands.BackwardParagraph,
  EditCommands.DeleteBackwardChar,
  EditCommands.DeleteForwardChar,
  EditCommands.NewLine,
  DeleteBlankLines,
  RecenterTopBottom,

  FindCommands.IsearchForward,
  FindCommands.IsearchBackward,
  FindCommands.IsearchForwardRegexp,
  FindCommands.IsearchBackwardRegexp,
  FindCommands.QueryReplace,
  FindCommands.QueryReplaceRegexp,
  FindCommands.IsearchAbort,
  FindCommands.IsearchExit,
  KillCommands.KillWord,
  KillCommands.BackwardKillWord,
  KillCommands.KillLine,
  KillCommands.KillWholeLine,
  KillCommands.KillRegion,
  KillCommands.CopyRegion,
  KillCommands.Yank,
  KillCommands.YankPop,
  RectangleCommands.StartAcceptingRectCommand,
  RectangleCommands.KillRectangle,
  RectangleCommands.CopyRectangleAsKill,
  RectangleCommands.DeleteRectangle,
  RectangleCommands.YankRectangle,
  RectangleCommands.OpenRectangle,
  RectangleCommands.ClearRectangle,
  RectangleCommands.StringRectangle,
  RectangleCommands.ReplaceKillRingToRectangle,
  PareditCommands.ForwardSexp,
  PareditCommands.BackwardSexp,
  PareditCommands.ForwardDownSexp,
  PareditCommands.BackwardUpSexp,
  PareditCommands.MarkSexp,
  PareditCommands.KillSexp,
  PareditCommands.BackwardKillSexp,
  CaseCommands.TransformToUppercase,
  CaseCommands.TransformToLowercase,
  CaseCommands.TransformToTitlecase,
  AddSelectionToNextFindMatch,
  AddSelectionToPreviousFindMatch,
].map((item) => [item.id, item]));

export const CommandRegister: ReadonlyMap<string, typeof EmacsCommand> = _CommandRegister;

export class EmacsCommandRegistry {
  private commands: Map<string, EmacsCommand>;
  private controller: EmacsEmulator;

  constructor(controller: EmacsEmulator) {
    this.commands = new Map();
    this.controller = controller;
  }

  public get(commandName: string): EmacsCommand | undefined {
    if (this.commands.has(commandName)) {
      return this.commands.get(commandName);
    } else {
      const cmdClass = _CommandRegister.get(commandName);
      if (cmdClass === undefined) {
        return undefined;
      } else {
        const command = new cmdClass(this.controller);
        this.commands.set(commandName, command);
        return command;
      }
    }
  }

  public forEach(
    callbackfn: (value: EmacsCommand, key: string, map: Map<string, EmacsCommand>) => void,
    thisArg?: any
  ): void {
    this.commands.forEach(callbackfn, thisArg);
  }
}
