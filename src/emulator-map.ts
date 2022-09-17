import assert from "assert";
import { Disposable, TextDocument, TextEditor } from "vscode";
import { EmacsEmulator } from "./emulator";
import { KillRing } from "./kill-yank/kill-ring";
import { Minibuffer } from "./minibuffer";

export class EmacsEmulatorManager implements Disposable {
    private readonly emulatorMap: Map<TextEditor, EmacsEmulator>;
    private readonly documentMap: Map<TextDocument, Array<TextEditor>>;
    private readonly killRing: KillRing;
    private readonly minibuffer: Minibuffer;

    constructor(killRing: KillRing, minibuffer: Minibuffer) {
        this.emulatorMap = new Map();
        this.documentMap = new Map();
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
            assert(this.documentMap.has(textEditor.document));
            return existentEmulator;
        }

        const newEmulator = new EmacsEmulator(
            textEditor,
            this.killRing,
            this.minibuffer
        );
        const documentEditors = this.documentMap.get(textEditor.document);
        if (!documentEditors) {
            this.documentMap.set(textEditor.document, [textEditor]);
        } else {
            documentEditors.push(textEditor);
        }
        this.emulatorMap.set(textEditor, newEmulator);

        return newEmulator;
    }

    public onDidCloseTextDocument(t: TextDocument): void {
        const documentEditors = this.documentMap.get(t);
        if (documentEditors) {
            for (const editor of documentEditors) {
                const emulator = this.emulatorMap.get(editor);
                assert(emulator);
                this.emulatorMap.delete(editor);
                emulator.dispose();
            }
            this.documentMap.delete(t);
        }
    }
}
