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

    protected emacs: EmacsEmulator;

    public constructor(controller: EmacsEmulator) {
        this.emacs = controller;
    }

    public async run(...args: unknown[]): Promise<unknown> {
        return this.execute(
            this.emacs.editor,
            this.emacs.isMarkActive(),
            this.emacs.prefixArgumentHandler.getPrefixArgument(),
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
