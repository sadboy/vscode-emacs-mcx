import * as paredit from "paredit.js";
import { TextDocument, Selection, Range, TextEditor, Position } from "vscode";
import { EmacsCommand } from ".";
import { KillYankCommand } from "./kill";
import { AppendDirection } from "../kill-yank";
import { revealPrimaryActive } from "./helpers/reveal";
import { EmacsEmulator } from "src/emulator";
import assert from "assert";

type PareditNavigatorFn = (ast: paredit.AST, idx: number) => number;

// Languages in which semicolon represents comment
const languagesSemicolonComment = new Set(["clojure", "lisp", "scheme"]);

const makeSexpTravelFunc = (doc: TextDocument, pareditNavigatorFn: PareditNavigatorFn) => {
  let src = doc.getText();
  if (!languagesSemicolonComment.has(doc.languageId)) {
    // paredit.js treats semicolon as comment in a manner of lisp and this behavior is not configurable
    // (a literal ";" is hard coded in paredit.js).
    // However, in other languages, semicolon should be treated as one entity, but not comment for convenience.
    // To do so, ";" is replaced with another character which is not treated as comment by paredit.js
    // if the document is not lisp or lisp-like languages.
    src = src.split(";").join("_"); // split + join = replaceAll
  }
  const ast = paredit.parse(src);

  return (position: Position, repeat: number): Position => {
    if (repeat < 0) {
      throw new Error(`Invalid repetition ${repeat}`);
    }

    let idx = doc.offsetAt(position);

    for (let i = 0; i < repeat; ++i) {
      idx = pareditNavigatorFn(ast, idx);
    }

    return doc.positionAt(idx);
  };
};

abstract class PareditNavigatorCommand extends EmacsCommand {
  public abstract readonly pareditNavigatorFn: PareditNavigatorFn;

  public async execute(textEditor: TextEditor, isInMarkMode: boolean, prefixArgument: number | undefined) {
    const repeat = prefixArgument === undefined ? 1 : prefixArgument;
    if (repeat <= 0) {
      return;
    }

    const doc = textEditor.document;

    const travelSexp = makeSexpTravelFunc(doc, this.pareditNavigatorFn);
    const newSelections = textEditor.selections.map((selection) => {
      const newActivePosition = travelSexp(selection.active, repeat);
      return new Selection(isInMarkMode ? selection.anchor : newActivePosition, newActivePosition);
    });

    textEditor.selections = newSelections;

    revealPrimaryActive(textEditor);
  }
}

export class ForwardSexp extends PareditNavigatorCommand {
  public static readonly id = "paredit.forwardSexp";
  public readonly pareditNavigatorFn = paredit.navigator.forwardSexp;
}

export class BackwardSexp extends PareditNavigatorCommand {
  public static readonly id = "paredit.backwardSexp";
  public readonly pareditNavigatorFn = paredit.navigator.backwardSexp;
}

export class ForwardDownSexp extends PareditNavigatorCommand {
  public static readonly id = "paredit.forwardDownSexp";
  public readonly pareditNavigatorFn = paredit.navigator.forwardDownSexp;
}

export class BackwardUpSexp extends PareditNavigatorCommand {
  public static readonly id = "paredit.backwardUpSexp";
  public readonly pareditNavigatorFn = paredit.navigator.backwardUpSexp;
}

export class MarkSexp extends EmacsCommand {
  public static readonly id = "paredit.markSexp";

  private get continuing(): boolean {
    return this.emacsController.lastCommand == MarkSexp.id;
  }

  public async execute(
    textEditor: TextEditor, isInMarkMode: boolean, prefixArgument: number | undefined
  ): Promise<void> {
    const controller: EmacsEmulator = this.emacsController;
    const arg = prefixArgument === undefined ? 1 : prefixArgument;

    const repeat = Math.abs(arg);
    const navigatorFn = arg > 0 ? paredit.navigator.forwardSexp : paredit.navigator.backwardSexp;

    const doc = textEditor.document;

    if (!this.continuing || controller.mark === undefined) {
      controller.pushMark(undefined, false, true);
    }
    assert(controller.mark);

    const travelSexp = makeSexpTravelFunc(doc, navigatorFn);
    const newCursor = textEditor.selections.map((selection) => {
      const newActivePosition = travelSexp(selection.active, repeat);
      return new Selection(newActivePosition, newActivePosition);
    });

    textEditor.selections = controller.mark.toAnchor(newCursor);
    revealPrimaryActive(textEditor);
  }
}

export class KillSexp extends KillYankCommand {
  public static readonly id = "paredit.killSexp";

  public async execute(
    textEditor: TextEditor,
    isInMarkMode: boolean,
    prefixArgument: number | undefined
  ): Promise<void> {
    const repeat = prefixArgument === undefined ? 1 : prefixArgument;
    if (repeat <= 0) {
      return;
    }

    const doc = textEditor.document;

    const travelSexp = makeSexpTravelFunc(doc, paredit.navigator.forwardSexp);
    const killRanges = textEditor.selections.map((selection) => {
      const newActivePosition = travelSexp(selection.active, repeat);
      return new Range(selection.anchor, newActivePosition);
    });

    await this.killYanker.kill(killRanges);

    revealPrimaryActive(textEditor);
  }
}

export class BackwardKillSexp extends KillYankCommand {
  public static readonly id = "paredit.backwardKillSexp";

  public async execute(
    textEditor: TextEditor,
    isInMarkMode: boolean,
    prefixArgument: number | undefined
  ): Promise<void> {
    const repeat = prefixArgument === undefined ? 1 : prefixArgument;
    if (repeat <= 0) {
      return;
    }

    const doc = textEditor.document;

    const travelSexp = makeSexpTravelFunc(doc, paredit.navigator.backwardSexp);
    const killRanges = textEditor.selections.map((selection) => {
      const newActivePosition = travelSexp(selection.active, repeat);
      return new Range(selection.anchor, newActivePosition);
    });

    await this.killYanker.kill(killRanges, AppendDirection.Backward);

    revealPrimaryActive(textEditor);
  }
}
