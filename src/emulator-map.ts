import {
    TextDocument,
    TextDocumentChangeEvent,
    TextEditor,
    TextEditorSelectionChangeEvent,
    ViewColumn,
} from "vscode";
import { EmacsEmulator } from "./emulator";
import { KillRing } from "./kill-yank/kill-ring";
import { Minibuffer } from "./minibuffer";
import { PrefixArgumentHandler } from "./prefix-argument";

export class EmacsEmulatorManager {
    private readonly emulatorMap: Map<string, EmacsEmulator>;
    private readonly killRing: KillRing;
    private readonly minibuffer: Minibuffer;
    private readonly prefixArgumentHandler: PrefixArgumentHandler;

    constructor(
        killRing: KillRing,
        minibuffer: Minibuffer,
        prefixArgumentHandler: PrefixArgumentHandler
    ) {
        this.emulatorMap = new Map();
        this.killRing = killRing;
        this.minibuffer = minibuffer;
        this.prefixArgumentHandler = prefixArgumentHandler;
    }

    public getOrCreate(textEditor: TextEditor): EmacsEmulator {
        const uri = textEditor.document.uri.toString();
        let emulator = this.emulatorMap.get(uri);
        if (!emulator) {
            emulator = new EmacsEmulator(
                textEditor,
                this.killRing,
                this.minibuffer,
                this.prefixArgumentHandler
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

class NavStack {
    private readonly previous: TextDocument[] = [];
    private current: TextDocument | undefined = undefined;
    private readonly next: TextDocument[] = [];
    private maxSize = 12;

    private push(stack: TextDocument[], document: TextDocument): number {
        stack.push(document);
        while (stack.length > this.maxSize) {
            this.previous.shift();
        }
        return stack.length;
    }

    public go(direction: "backward" | "forward"): TextDocument | undefined {
        let to: TextDocument[];
        let from: TextDocument[];
        if (direction === "backward") {
            from = this.previous;
            to = this.next;
        } else {
            from = this.next;
            to = this.previous;
        }

        let item = from.pop();
        while (item && (item.isClosed || item === this.current)) {
            item = from.pop();
        }
        if (item) {
            if (this.current) {
                this.push(to, this.current);
            }
            this.current = item;
        }
        return item;
    }

    public update(active: TextDocument | undefined): void {
        if (active !== this.current) {
            if (this.current) {
                this.push(this.previous, this.current);
            }
        }

        this.current = active;
    }
}

const IGNORED_SCHEMES = new Set(["output"]);

export class Navigator {
    private readonly stacks: Map<ViewColumn, NavStack>;
    private _lastColumn: ViewColumn | undefined;

    public get lastColumn(): ViewColumn | undefined {
        return this._lastColumn;
    }

    constructor() {
        this.stacks = new Map();
        this._lastColumn = undefined;
    }

    public onDidChangeVisibleTextEditors(
        visibleEditors: readonly TextEditor[]
    ): void {
        const updates: TextDocument[] = [];
        const orphans: TextDocument[] = [];
        visibleEditors.forEach((editor) => {
            if (
                editor.viewColumn === undefined ||
                editor.viewColumn === ViewColumn.Active ||
                editor.viewColumn === ViewColumn.Beside
            ) {
                if (!IGNORED_SCHEMES.has(editor.document.uri.scheme)) {
                    orphans.push(editor.document);
                }
            } else {
                let stack = this.stacks.get(editor.viewColumn);
                if (!stack) {
                    stack = new NavStack();
                    this.stacks.set(editor.viewColumn, stack);
                }
                updates[editor.viewColumn] = editor.document;
            }
        });
        this.stacks.forEach((stack, column) => {
            let document = updates[column];
            if (!document) {
                document = orphans.shift();
            }
            stack.update(document);
        });
    }

    public onDidChangeActiveTextEditor(
        activeEditor: TextEditor | undefined
    ): void {
        if (activeEditor && activeEditor.viewColumn) {
            this._lastColumn = activeEditor.viewColumn;
        }
    }

    public navigate(
        column: ViewColumn | undefined,
        direction: "backward" | "forward"
    ): TextDocument | undefined {
        if (!column) {
            column = this._lastColumn;
        }
        if (
            column === undefined ||
            column === ViewColumn.Active ||
            column === ViewColumn.Beside
        ) {
            return undefined;
        }

        let stack = this.stacks.get(column);
        if (!stack) {
            stack = new NavStack();
            this.stacks.set(column, stack);
            return undefined;
        } else {
            return stack.go(direction);
        }
    }
}
