import { TextEditor } from "vscode";
import { EmacsEmulator } from "../emulator";

export function createParallel<T>(
    concurrency: number,
    promiseFactory: () => Thenable<T>
): Thenable<T[]> {
    return Promise.all(Array.from({ length: concurrency }, promiseFactory));
}

export abstract class EmacsCommand {
    public static readonly id: string;

    protected emacsController: EmacsEmulator;

    public constructor(controller: EmacsEmulator) {
        this.emacsController = controller;
    }

    public run(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined,
        ...args: any[]
    ): Thenable<unknown> | void {
        return this.execute(textEditor, isInMarkMode, prefixArgument, ...args);
    }

    public abstract execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined,
        ...args: any[]
    ): void | Thenable<unknown>;
}

export interface IEmacsCommandInterrupted {
    onDidInterruptTextEditor(): void;
}

export function instanceOfIEmacsCommandInterrupted(
    obj: any
): obj is IEmacsCommandInterrupted {
    return typeof obj.onDidInterruptTextEditor === "function";
}
