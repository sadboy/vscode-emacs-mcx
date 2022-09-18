import {
    TextDocument,
    TextDocumentChangeEvent,
    TextEditor,
    TextEditorSelectionChangeEvent,
} from "vscode";
import { EmacsEmulator } from "./emulator";
import { KillRing } from "./kill-yank/kill-ring";
import { Minibuffer } from "./minibuffer";

export class EmacsEmulatorManager {
    private readonly emulatorMap: Map<string, EmacsEmulator>;
    private readonly killRing: KillRing;
    private readonly minibuffer: Minibuffer;

    constructor(killRing: KillRing, minibuffer: Minibuffer) {
        this.emulatorMap = new Map();
        this.killRing = killRing;
        this.minibuffer = minibuffer;
    }

    public getOrCreate(textEditor: TextEditor): EmacsEmulator {
        const uri = textEditor.document.uri.toString();
        let emulator = this.emulatorMap.get(uri);
        if (!emulator) {
            emulator = new EmacsEmulator(
                textEditor,
                this.killRing,
                this.minibuffer
            );
            this.emulatorMap.set(uri, emulator);
        }
        emulator.attachEditor(textEditor);
        return emulator;
    }

    public onDidChangeTextDocument(e: TextDocumentChangeEvent): void {
        const emulator = this.emulatorMap.get(e.document.uri.toString());
        if (emulator) {
            emulator.onDidChangeTextDocument(e);
        }
    }

    public onDidChangeTextEditorSelection(
        e: TextEditorSelectionChangeEvent
    ): void {
        const emulator = this.emulatorMap.get(
            e.textEditor.document.uri.toString()
        );
        if (emulator) {
            emulator.onDidChangeTextEditorSelection(e);
        }
    }

    public onDidCloseTextDocument(t: TextDocument): void {
        this.emulatorMap.delete(t.uri.toString());
    }
}
