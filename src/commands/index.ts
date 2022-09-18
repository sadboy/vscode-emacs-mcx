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

    public async run(...args: unknown[]): Promise<unknown> {
        return this.execute(
            this.emacsController.editor,
            this.emacsController.isMarkActive,
            this.emacsController.prefixArgumentHandler.getPrefixArgument(),
            ...args
        );
    }

    public abstract execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined,
        ...args: unknown[]
    ): Promise<unknown>;
}

export interface IEmacsCommandInterrupted {
    onDidInterruptTextEditor(): void;
}

export function instanceOfIEmacsCommandInterrupted(
    obj: any
): obj is IEmacsCommandInterrupted {
    return typeof obj.onDidInterruptTextEditor === "function";
}
