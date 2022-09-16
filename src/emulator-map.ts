import { Disposable, TextEditor } from "vscode";
import { EmacsEmulator } from "./emulator";
import { KillRing } from "./kill-yank/kill-ring";
import { Minibuffer } from "./minibuffer";

export class EmacsEmulatorMap implements Disposable {
  private emulatorMap: Map<TextEditor, EmacsEmulator>;
  private killRing: KillRing;
  private minibuffer: Minibuffer;

  constructor(killRing: KillRing, minibuffer: Minibuffer) {
    this.emulatorMap = new Map();
    this.killRing = killRing;
    this.minibuffer = minibuffer;
  }

  dispose(): void {
    for (const emulator of this.emulatorMap.values()) {
      emulator.dispose();
    }
  }

  public getOrCreate(textEditor: TextEditor): EmacsEmulator {
    const existentEmulator = this.emulatorMap.get(textEditor);
    if (existentEmulator) {
      return existentEmulator;
    }

    const newEmulator = new EmacsEmulator(textEditor, this.killRing, this.minibuffer);
    this.emulatorMap.set(textEditor, newEmulator);
    return newEmulator;
  }

  public get(editor: TextEditor): EmacsEmulator | undefined {
    return this.emulatorMap.get(editor);
  }

  public cleanup(): void {
    for (const [editor, emulator] of this.emulatorMap) {
      if (editor.document.isClosed) {
        this.emulatorMap.delete(editor);
        emulator.dispose();
      }
    }
  }
}
