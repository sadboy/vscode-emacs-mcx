import * as vscode from "vscode";
import { Selection, TextEditor } from "vscode";
import { instanceOfIEmacsCommandInterrupted } from "./commands";
import { EmacsCommandRegistry } from "./commands/registry";
import { EditorIdentity } from "./editorIdentity";
import { KillYanker } from "./kill-yank";
import { KillRing } from "./kill-yank/kill-ring";
import { logger } from "./logger";
import { MessageManager } from "./message";
import { PrefixArgumentHandler } from "./prefix-argument";
import { Configuration } from "./configuration/configuration";
import { Mark, MarkRing } from "./mark-ring";
import { convertSelectionToRectSelections } from "./rectangle";
import { InputBoxMinibuffer, Minibuffer } from "./minibuffer";
import { revealPrimaryActive } from "./commands/helpers/reveal";

export interface SearchState {
  startSelections: readonly vscode.Selection[] | undefined;
}

type KilledRectangle = string[];
export interface RectangleState {
  latestKilledRectangle: KilledRectangle; // multi-cursor is not supported
}

export interface IEmacsController {
  runCommand(commandName: string): void | Thenable<unknown>;

  deactivateRegion(): void;
  deactivateMark(): void;
  pushMark(mark?: Mark, nomsg?: boolean, activate?: boolean): void;

  readonly miniBuffer: Minibuffer;
  readonly killRing: KillRing | null;
  readonly killYanker: KillYanker;
  readonly inRectMarkMode: boolean;
  readonly nativeSelections: readonly vscode.Selection[];
  readonly searchState: SearchState;
  readonly rectangleState: RectangleState;

  moveRectActives: (navigateFn: (currentActives: vscode.Position) => vscode.Position) => void;

  registerDisposable: (disposable: vscode.Disposable) => void;
}

export class EmacsEmulator implements IEmacsController, vscode.Disposable {
  private textEditor: TextEditor;

  private commandRegistry: EmacsCommandRegistry;

  private markRing: MarkRing;
  private mark: Mark | null;

  private _isMarkActive = false;
  public get isMarkActive(): boolean {
    return this._isMarkActive;
  }

  public get isRegionActive(): boolean {
    return this.hasNonEmptySelection();
  }

  private rectMode = false;
  public get inRectMarkMode(): boolean {
    return this._isMarkActive && this.rectMode;
  }

  public get numCursors(): number {
    return this.textEditor.selections.length;
  }

  /**
   * It is usually synced to `textEditor.selections`.
   * Specially in rect-mark-mode, it is used to manage the underlying selections which the move commands directly manipulate
   * and the `textEditor.selections` is in turn managed to visually represent rects reflecting the underlying `this._nativeSelections`.
   */
  private _nativeSelections: readonly vscode.Selection[];
  public get nativeSelections(): readonly vscode.Selection[] {
    return this._nativeSelections;
  }
  private applyNativeSelectionsAsRect(): void {
    if (this.inRectMarkMode) {
      const rectSelections = this._nativeSelections
        .map(convertSelectionToRectSelections.bind(null, this.textEditor.document))
        .reduce((a, b) => a.concat(b), []);
      this.textEditor.selections = rectSelections;
    }
  }
  public moveRectActives(navigateFn: (currentActive: vscode.Position) => vscode.Position): void {
    const newNativeSelections = this._nativeSelections.map((s) => {
      const newActive = navigateFn(s.active);
      return new vscode.Selection(s.anchor, newActive);
    });
    this._nativeSelections = newNativeSelections;
    this.applyNativeSelectionsAsRect();
  }

  public readonly miniBuffer: Minibuffer;
  public readonly killRing: KillRing | null;
  public readonly killYanker: KillYanker;
  public readonly searchState: SearchState;
  public readonly rectangleState: RectangleState;
  private prefixArgumentHandler: PrefixArgumentHandler;

  private disposables: vscode.Disposable[];

  constructor(
    textEditor: TextEditor,
    killRing: KillRing | null = null,
    minibuffer: Minibuffer = new InputBoxMinibuffer()
  ) {
    this.textEditor = textEditor;
    this._nativeSelections = this.rectMode ? [] : textEditor.selections; // TODO: `[]` is workaround.

    this.markRing = new MarkRing(Configuration.instance.markRingMax);
    this.mark = null;

    this.prefixArgumentHandler = new PrefixArgumentHandler(
      this.onPrefixArgumentChange,
      this.onPrefixArgumentAcceptingStateChange
    );

    this.disposables = [];

    vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this, this.disposables);
    vscode.window.onDidChangeTextEditorSelection(this.onDidChangeTextEditorSelection, this, this.disposables);

    this.commandRegistry = new EmacsCommandRegistry(this);
    this.afterCommand = this.afterCommand.bind(this);

    this.miniBuffer = minibuffer;
    this.killRing = killRing;
    this.searchState = { startSelections: undefined, };
    this.killYanker = new KillYanker(textEditor, killRing, minibuffer);
    this.registerDisposable(this.killYanker);

    this.rectangleState = { latestKilledRectangle: [], };
  }

  public setTextEditor(textEditor: TextEditor): void {
    this.textEditor = textEditor;
    this.killYanker.setTextEditor(textEditor);
  }

  public getTextEditor(): TextEditor {
    return this.textEditor;
  }

  public registerDisposable(disposable: vscode.Disposable): void {
    this.disposables.push(disposable);
  }

  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  public onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent): void {
    // XXX: Is this a correct way to check the identity of document?
    if (e.document.uri.toString() === this.textEditor.document.uri.toString()) {
      if (
        e.contentChanges.some((contentChange) =>
          this.textEditor.selections.some(
            (selection) => typeof contentChange.range.intersection(selection) !== "undefined"
          )
        )
      ) {
        this.deactivateMark(false);
      }

      this.onDidInterruptTextEditor();
    }
  }

  public onDidChangeTextEditorSelection(e: vscode.TextEditorSelectionChangeEvent): void {
    if (new EditorIdentity(e.textEditor).isEqual(new EditorIdentity(this.textEditor))) {
      this.onDidInterruptTextEditor();

      if (!this.rectMode) {
        this._nativeSelections = this.textEditor.selections;
      }
    }
  }

  /**
   * An extended version of the native `type` command with prefix argument integration.
   */
  public typeChar(char: string): void | Thenable<unknown> {
    if (this.isMarkActive) {
      this.deactivateMark();
    }

    if (char === "-" && this.prefixArgumentHandler.minusSignAcceptable) {
      return this.prefixArgumentHandler.negativeArgument();
    }

    const prefixArgument = this.prefixArgumentHandler.getPrefixArgument();
    this.prefixArgumentHandler.cancel();

    const repeat = prefixArgument == null ? 1 : prefixArgument;
    if (repeat < 0) {
      MessageManager.showMessage(`Negative repetition argument ${repeat}`);
      return;
    }

    if (repeat == 1) {
      // It's better to use `type` command than `TextEditor.edit` method
      // because `type` command invokes features like auto-completion reacting to character inputs.
      return vscode.commands.executeCommand("type", { text: char });
    }

    return this.textEditor.edit((editBuilder) => {
      this.textEditor.selections.forEach((selection) => {
        editBuilder.insert(selection.active, char.repeat(repeat));
      });
    });
  }

  // Ref: https://github.com/Microsoft/vscode-extension-samples/blob/f9955406b4cad550fdfa891df23a84a2b344c3d8/vim-sample/src/extension.ts#L152
  public type(text: string): Thenable<unknown> {
    // Single character input with prefix argument
    // NOTE: This single character handling should be replaced with `EmacsEmulator.typeChar` directly bound to relevant keystrokes,
    // however, it's difficult to cover all characters without `type` event registration,
    // then this method can be used to handle single character inputs other than ASCII characters,
    // for those who want it as an option.
    const prefixArgument = this.prefixArgumentHandler.getPrefixArgument();
    this.prefixArgumentHandler.cancel();

    logger.debug(`[EmacsEmulator.type]\t Single char (text: "${text}", prefix argument: ${prefixArgument}).`);
    if (prefixArgument !== undefined && prefixArgument >= 0) {
      const promises = [];
      for (let i = 0; i < prefixArgument; ++i) {
        const promise = vscode.commands.executeCommand("default:type", {
          text,
        });
        promises.push(promise);
      }
      // NOTE: Current implementation executes promises concurrently. Should it be sequential?
      return Promise.all(promises);
    }

    logger.debug(`[EmacsEmulator.type]\t Execute "default:type" (text: "${text}")`);
    return vscode.commands.executeCommand("default:type", {
      text,
    });
  }

  /**
   * C-u
   */
  public universalArgument(): Promise<unknown> {
    return this.prefixArgumentHandler.universalArgument();
  }

  /**
   * M-<number>
   */
  public digitArgument(digit: number): Promise<unknown> {
    return this.prefixArgumentHandler.digitArgument(digit);
  }

  /**
   * M--
   */
  public negativeArgument(): Promise<unknown> {
    return this.prefixArgumentHandler.negativeArgument();
  }

  /**
   * Digits following C-u or M-<number>
   */
  public subsequentArgumentDigit(arg: number): Promise<unknown> {
    return this.prefixArgumentHandler.subsequentArgumentDigit(arg);
  }

  public onPrefixArgumentChange(newPrefixArgument: number | undefined): Thenable<unknown> {
    logger.debug(`[EmacsEmulator.onPrefixArgumentChange]\t Prefix argument: ${newPrefixArgument}`);

    return Promise.all([
      vscode.commands.executeCommand("setContext", "emacs-mcx.prefixArgument", newPrefixArgument),
      vscode.commands.executeCommand("setContext", "emacs-mcx.prefixArgumentExists", newPrefixArgument != null),
    ]);
  }

  public onPrefixArgumentAcceptingStateChange(newState: boolean): Thenable<unknown> {
    logger.debug(`[EmacsEmulator.onPrefixArgumentAcceptingStateChange]\t Prefix accepting: ${newState}`);
    return vscode.commands.executeCommand("setContext", "emacs-mcx.acceptingArgument", newState);
  }

  public runCommand(commandName: string, ...args: any[]): Thenable<unknown> | void {
    const command = this.commandRegistry.get(commandName);

    if (command === undefined) {
      throw Error(`command ${commandName} is not found`);
    }

    const prefixArgument = this.prefixArgumentHandler.getPrefixArgument();

    const ret = command.run(this.textEditor, this.isMarkActive, prefixArgument, ...args);
    this.afterCommand();
    return ret;
  }

  /**
   * C-<SPC>
   */
  public setMarkCommand(): void {
    if (this.prefixArgumentHandler.precedingSingleCtrlU()) {
      // C-u C-<SPC>
      this.prefixArgumentHandler.cancel();
      return this.popMark();
    }

    if (this.isMarkActive && !this.hasNonEmptySelection()) {
      // Toggle if enterMarkMode is invoked continuously without any cursor move.
      this.deactivateMark();
    } else {
      this.pushMark();
    }
  }

  /**
   * C-x <SPC>
   */
  public rectangleMarkMode(): void {
    if (this.inRectMarkMode) {
      this.exitRectangleMarkMode();
    } else {
      this.enterRectangleMarkMode();
    }
  }

  private normalCursorStyle?: vscode.TextEditorCursorStyle = undefined;
  private enterRectangleMarkMode(): void {
    if (this.isMarkActive) {
      MessageManager.showMessage("Rectangle-Mark mode enabled in current buffer");
    } else {
      MessageManager.showMessage("Mark set (rectangle-mode)");
    }

    this.pushMark();
    this.rectMode = true;
    vscode.commands.executeCommand("setContext", "emacs-mcx.inRectMarkMode", true);
    this.applyNativeSelectionsAsRect();

    this.normalCursorStyle = this.textEditor.options.cursorStyle;
    this.textEditor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin;
  }

  private exitRectangleMarkMode(): void {
    if (!this.rectMode) {
      return;
    }

    this.rectMode = false;
    vscode.commands.executeCommand("setContext", "emacs-mcx.inRectMarkMode", false);
    this.textEditor.selections = this._nativeSelections;

    if (!this.isMarkActive) {
      this.deactivateRegion();
    }

    this.textEditor.options.cursorStyle = this.normalCursorStyle;
  }

  /**
   * Invoked by C-g
   */
  public cancel(): void {
    if (this.rectMode) {
      this.exitRectangleMarkMode();
    }

    if (this.hasMultipleSelections() && !this.hasNonEmptySelection()) {
      this.stopMultiCursor();
    } else {
      this.deactivateRegion();
    }

    if (this.isMarkActive) {
      this.deactivateMark();
    }

    this.onDidInterruptTextEditor();

    this.killYanker.cancelKillAppend();
    this.prefixArgumentHandler.cancel();

    MessageManager.showMessage("Quit");
  }

  public activateMark(nomsg = false): void {
    this._isMarkActive = true;
    this.rectMode = false;

    // At this moment, the only way to set the context for `when` conditions is `setContext` command.
    // The discussion is ongoing in https://github.com/Microsoft/vscode/issues/10471
    // TODO: How to write unittest for `setContext`?
    vscode.commands.executeCommand("setContext", "emacs-mcx.inMarkMode", true);
    if (!nomsg) {
      MessageManager.showMessage("Mark activated");
    }
  }

  private _setCursorTo(position: Mark) {
    this.textEditor.selections = position.toCursor();
  }

  public async pushMark(newMark: Mark | undefined = undefined, nomsg = false, activate = false): Promise<void> {
    if (newMark === undefined) {
      newMark = Mark.fromCursor(this.textEditor.selections);
      await vscode.commands.executeCommand("editor.action.setSelectionAnchor");
    } else {
      const cursor = Mark.fromCursor(this.textEditor.selections);
      this._setCursorTo(newMark);
      await vscode.commands.executeCommand("editor.action.setSelectionAnchor");
      this._setCursorTo(cursor);
    }
    if (this.mark) {
      this.markRing.push(this.mark);
    }
    this.mark = newMark;
    if (!nomsg) {
      MessageManager.showMessage("Mark set");
    }
    if (activate) {
      this.activateMark(nomsg);
    }
  }

  public popMark(): void {
    const prevMark = this.markRing.pop();
    if (prevMark) {
      this.textEditor.selections = prevMark.toCursor(this.textEditor.selections);
      revealPrimaryActive(this.textEditor);
    }
  }

  public async exchangePointAndMark(): Promise<void> {
    if (this.mark) {
      await vscode.commands.executeCommand("editor.action.setSelectionAnchor");
      const cursor = Mark.fromCursor(this.textEditor.selections);
      if (this.isMarkActive) {
        this.textEditor.selections = this.mark.toAnchor(this.textEditor.selections);
      } else {
        this.textEditor.selections = this.mark.toCursor(this.textEditor.selections);
      }
      this.mark = cursor;
      revealPrimaryActive(this.textEditor);
    } else {
      MessageManager.showMessage("No mark set in this buffer");
    }
  }

  public deactivateMark(andRegion = true): void {
    this._isMarkActive = false;
    this.exitRectangleMarkMode();
    if (andRegion) {
      this.deactivateRegion();
    }
    vscode.commands.executeCommand("setContext", "emacs-mcx.inMarkMode", false);
  }

  public executeCommandWithPrefixArgument<T>(
    command: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any = null,
    prefixArgumentKey = "prefixArgument"
  ): Thenable<T | undefined> {
    const prefixArgument = this.prefixArgumentHandler.getPrefixArgument();
    this.prefixArgumentHandler.cancel();

    return vscode.commands.executeCommand<T>(command, { ...args, [prefixArgumentKey]: prefixArgument });
  }

  public getPrefixArgument(): number | undefined {
    return this.prefixArgumentHandler.getPrefixArgument();
  }

  public deactivateRegion(): void {
    const srcSelections = this.rectMode ? this._nativeSelections : this.textEditor.selections;
    this.textEditor.selections = srcSelections.map(
      (selection) => new Selection(selection.active, selection.active)
    );
  }

  private stopMultiCursor() {
    vscode.commands.executeCommand("removeSecondaryCursors");
  }

  private hasMultipleSelections(): boolean {
    return this.textEditor.selections.length > 1;
  }

  private hasNonEmptySelection(): boolean {
    return this.textEditor.selections.some((selection) => !selection.isEmpty);
  }

  private afterCommand() {
    return this.prefixArgumentHandler.cancel();
  }

  private onDidInterruptTextEditor() {
    this.commandRegistry.forEach((command) => {
      if (instanceOfIEmacsCommandInterrupted(command)) {
        // TODO: Cache the array of IEmacsCommandInterrupted instances
        command.onDidInterruptTextEditor();
      }
    });
  }
}
