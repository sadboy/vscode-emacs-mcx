import * as vscode from "vscode";
import { CommandRegister } from "./commands/registry";
import { Configuration } from "./configuration/configuration";
import { WorkspaceConfigCache } from "./workspace-configuration";
import { EmacsEmulator } from "./emulator";
import { EmacsEmulatorManager, Navigator } from "./emulator-map";
import { executeCommands } from "./execute-commands";
import { KillRing } from "./kill-yank/kill-ring";
import { logger } from "./logger";
import { MessageManager } from "./message";
import { InputBoxMinibuffer } from "./minibuffer";

// HACK: Currently there is no official type-safe way to handle
//       the unsafe inputs such as the arguments of the extensions.
// See: https://github.com/microsoft/TypeScript/issues/37700#issuecomment-940865298
type Unreliable<T> =
    | { [P in keyof T]?: Unreliable<T[P]> }
    | Array<Unreliable<T>>
    | undefined;

const COMMAND_NAME_PREFIX = "emacs-mcx";

export function activate(context: vscode.ExtensionContext): void {
    MessageManager.registerDispose(context);
    Configuration.registerDispose(context);
    context.subscriptions.push(WorkspaceConfigCache.instance);
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("emacs-mcx")) {
                Configuration.reload();
            }
        })
    );

    const killRing = new KillRing(Configuration.instance.killRingMax);
    const minibuffer = new InputBoxMinibuffer();

    const emulatorManager = new EmacsEmulatorManager(killRing, minibuffer);
    const navigator = new Navigator();

    function getEmulator() {
        const activeTextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor === undefined) {
            return undefined;
        } else {
            return emulatorManager.getOrCreate(activeTextEditor);
        }
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(
            emulatorManager.onDidChangeTextDocument,
            emulatorManager
        )
    );
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(
            emulatorManager.onDidChangeTextEditorSelection,
            emulatorManager
        )
    );
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(
            emulatorManager.onDidCloseTextDocument,
            emulatorManager
        )
    );

    function updateVisibleEditors(editors: readonly vscode.TextEditor[]) {
        navigator.onDidChangeVisibleTextEditors(editors);
        editors.forEach((editor) => emulatorManager.getOrCreate(editor));
    }

    updateVisibleEditors(vscode.window.visibleTextEditors);

    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(updateVisibleEditors)
    );
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(
            navigator.onDidChangeActiveTextEditor,
            navigator
        )
    );

    function registerEmulatorCommand(
        commandName: string,
        callback: (emulator: EmacsEmulator, ...args: Unreliable<any>[]) => any,
        onNoEmulator?: (...args: any[]) => any
    ) {
        const disposable = vscode.commands.registerCommand(
            commandName,
            (...args) => {
                logger.debug(
                    `[command]\t Command "${commandName}" executed with args (${args})`
                );

                const emulator = getEmulator();
                if (!emulator) {
                    if (typeof onNoEmulator === "function") {
                        return onNoEmulator(...args);
                    }
                } else {
                    return callback(emulator, ...args);
                }
            }
        );
        context.subscriptions.push(disposable);
    }

    if (Configuration.instance.enableOverridingTypeCommand) {
        registerEmulatorCommand(
            "type",
            (emulator, args) => {
                const text = (args as unknown as { text: string }).text; // XXX: The arguments of `type` is guaranteed to have this signature.
                // Capture typing characters for prefix argument functionality.
                logger.debug(`[type command]\t args.text = "${text}"`);

                return emulator.type(text);
            },
            (args) => vscode.commands.executeCommand("default:type", args)
        );
    }

    registerEmulatorCommand(
        `${COMMAND_NAME_PREFIX}.subsequentArgumentDigit`,
        (emulator, args) => {
            if (!Array.isArray(args)) {
                return;
            }
            const arg = args[0];
            if (typeof arg !== "number") {
                return;
            }
            emulator.subsequentArgumentDigit(arg);
        }
    );

    registerEmulatorCommand(
        `${COMMAND_NAME_PREFIX}.digitArgument`,
        (emulator, args) => {
            if (!Array.isArray(args)) {
                return;
            }
            const arg = args[0];
            if (typeof arg !== "number") {
                return;
            }
            emulator.digitArgument(arg);
        }
    );

    registerEmulatorCommand(
        `${COMMAND_NAME_PREFIX}.typeChar`,
        (emulator, args) => {
            if (!Array.isArray(args)) {
                return;
            }
            const arg = args[0];
            if (typeof arg !== "string") {
                return;
            }
            emulator.typeChar(arg);
        }
    );

    registerEmulatorCommand(
        `${COMMAND_NAME_PREFIX}.universalArgument`,
        (emulator) => {
            emulator.universalArgument();
        }
    );

    registerEmulatorCommand(
        `${COMMAND_NAME_PREFIX}.negativeArgument`,
        (emulator) => {
            return emulator.negativeArgument();
        }
    );

    registerEmulatorCommand(`${COMMAND_NAME_PREFIX}.cancel`, (emulator) => {
        emulator.cancel();
    });

    context.subscriptions.push(
        vscode.commands.registerCommand(
            `${COMMAND_NAME_PREFIX}.executeCommands`,
            async (...args: any[]) => {
                if (1 <= args.length) {
                    executeCommands(args[0]);
                }
            }
        )
    );

    async function navigate(direction: "backward" | "forward") {
        let activeColumn: vscode.ViewColumn | undefined = undefined;

        const curEditor = vscode.window.activeTextEditor;
        if (curEditor && curEditor.viewColumn) {
            activeColumn = curEditor.viewColumn;
        }
        if (!activeColumn) {
            activeColumn = navigator.lastColumn;
        }
        if (activeColumn) {
            const document = navigator.navigate(activeColumn, direction);
            if (document) {
                return vscode.window.showTextDocument(document, activeColumn);
            } else {
                MessageManager.showMessage(`${direction} stack is empty`);
            }
        } else {
            MessageManager.showMessage("No editor focus!");
        }
    }

    context.subscriptions.push(
        vscode.commands.registerCommand(
            `${COMMAND_NAME_PREFIX}.navigateBackward`,
            async () => navigate("backward")
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            `${COMMAND_NAME_PREFIX}.navigateForward`,
            async () => navigate("forward")
        )
    );

    registerEmulatorCommand(
        `${COMMAND_NAME_PREFIX}.executeCommandWithPrefixArgument`,
        (emulator, args) => {
            if (
                typeof args !== "object" ||
                args == null ||
                Array.isArray(args)
            ) {
                return;
            }

            if (
                typeof args?.command === "string" &&
                (typeof args?.prefixArgumentKey === "string" ||
                    args?.prefixArgumentKey == null)
            ) {
                emulator.executeCommandWithPrefixArgument(
                    args["command"],
                    args["args"],
                    args["prefixArgumentKey"]
                );
            }
        }
    );

    // Register all commands from the command register:
    CommandRegister.forEach((command, name) => {
        registerEmulatorCommand(
            `${COMMAND_NAME_PREFIX}.${name}`,
            (emulator, ...args) => emulator.runCommand(name, ...args)
        );
    });
}

// this method is called when your extension is deactivated
export function deactivate(): void {
    return;
}
