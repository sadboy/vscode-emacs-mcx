import * as vscode from "vscode";
import { CommandRegister } from "./commands/registry";
import { Configuration } from "./configuration/configuration";
import { WorkspaceConfigCache } from "./workspace-configuration";
import { EmacsEmulator } from "./emulator";
import { EmacsEmulatorManager, Navigator } from "./emulator-map";
import { KillRing } from "./kill-yank/kill-ring";
import { logger } from "./logger";
import { MessageManager } from "./message";
import { InputBoxMinibuffer } from "./minibuffer";
import { PrefixArgumentHandler } from "./prefix-argument";

interface PrefixableCommand {
    command: string;
    prefixArgumentKey?: string;
    args?: Record<string, unknown>;
}

function isPrefixableCommandArgs(
    args: PrefixableCommand | unknown
): args is PrefixableCommand {
    if (typeof args !== "object" || !args || !("command" in args)) {
        return false;
    }
    const { command } = args as { command: unknown };
    if (typeof command !== "string") {
        return false;
    }
    if ("prefixArgumentKey" in args) {
        const { prefixArgumentKey } = args as { prefixArgumentKey: unknown };
        if (typeof prefixArgumentKey !== "string") {
            return false;
        }
    }
    return true;
}

const COMMAND_NAME_PREFIX = "emacs-mcx";

async function onPrefixArgumentChange(
    newPrefixArgument: number | undefined
): Promise<unknown> {
    logger.debug(
        `[onPrefixArgumentChange]\t Prefix argument: ${newPrefixArgument}`
    );

    return Promise.all([
        vscode.commands.executeCommand(
            "setContext",
            "emacs-mcx.prefixArgument",
            newPrefixArgument
        ),
        vscode.commands.executeCommand(
            "setContext",
            "emacs-mcx.prefixArgumentExists",
            newPrefixArgument != null
        ),
    ]);
}

async function onPrefixArgumentAcceptingStateChange(
    newState: boolean
): Promise<unknown> {
    logger.debug(
        `[onPrefixArgumentAcceptingStateChange]\t Prefix accepting: ${newState}`
    );
    return vscode.commands.executeCommand(
        "setContext",
        "emacs-mcx.acceptingArgument",
        newState
    );
}

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
    const prefixArgumentHandler = new PrefixArgumentHandler(
        onPrefixArgumentChange,
        onPrefixArgumentAcceptingStateChange
    );

    const emulatorManager = new EmacsEmulatorManager(
        killRing,
        minibuffer,
        prefixArgumentHandler
    );
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
        callback: (emulator: EmacsEmulator, ...args: unknown[]) => unknown,
        onNoEmulator?: (...args: unknown[]) => unknown
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

    context.subscriptions.push(
        vscode.commands.registerCommand(
            `${COMMAND_NAME_PREFIX}.subsequentArgumentDigit`,
            async (...args) => {
                prefixArgumentHandler.subsequentArgumentDigit(
                    (args as [number])[0]
                );
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            `${COMMAND_NAME_PREFIX}.digitArgument`,
            async (...args) => {
                prefixArgumentHandler.digitArgument((args as [number])[0]);
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            `${COMMAND_NAME_PREFIX}.universalArgument`,
            async () => prefixArgumentHandler.universalArgument()
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            `${COMMAND_NAME_PREFIX}.negativeArgument`,
            async () => prefixArgumentHandler.negativeArgument()
        )
    );

    registerEmulatorCommand(
        `${COMMAND_NAME_PREFIX}.typeChar`,
        (emulator, args) => {
            emulator.typeChar((args as [string])[0]);
        }
    );

    registerEmulatorCommand(`${COMMAND_NAME_PREFIX}.cancel`, (emulator) => {
        emulator.cancel();
    });

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
            if (isPrefixableCommandArgs(args)) {
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
