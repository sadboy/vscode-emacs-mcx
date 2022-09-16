import * as vscode from "vscode";
import { CommandRegister } from "./commands/registry";
import { Configuration } from "./configuration/configuration";
import { WorkspaceConfigCache } from "./workspace-configuration";
import { EmacsEmulator } from "./emulator";
import { EmacsEmulatorMap } from "./emulator-map";
import { executeCommands } from "./execute-commands";
import { KillRing } from "./kill-yank/kill-ring";
import { logger } from "./logger";
import { MessageManager } from "./message";
import { InputBoxMinibuffer } from "./minibuffer";

// HACK: Currently there is no official type-safe way to handle
//       the unsafe inputs such as the arguments of the extensions.
// See: https://github.com/microsoft/TypeScript/issues/37700#issuecomment-940865298
type Unreliable<T> = { [P in keyof T]?: Unreliable<T[P]> } | Array<Unreliable<T>> | undefined;

const COMMAND_NAME_PREFIX = "emacs-mcx";

export function activate(context: vscode.ExtensionContext): void {
  MessageManager.registerDispose(context);
  Configuration.registerDispose(context);
  context.subscriptions.push(WorkspaceConfigCache.instance);

  const killRing = new KillRing(Configuration.instance.killRingMax);
  const minibuffer = new InputBoxMinibuffer();

  const emulatorMap = new EmacsEmulatorMap(killRing, minibuffer);
  context.subscriptions.push(emulatorMap);

  function getAndUpdateEmulator() {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor === undefined) {
      return undefined;
    } else {
      return emulatorMap.getOrCreate(activeTextEditor);
    }
  }

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(() => emulatorMap.cleanup())
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("emacs-mcx")) {
        Configuration.reload();
      }
    })
  );

  function registerEmulatorCommand(
    commandName: string,
    callback: (emulator: EmacsEmulator, ...args: Unreliable<any>[]) => any,
    onNoEmulator?: (...args: any[]) => any
  ) {
    const disposable = vscode.commands.registerCommand(commandName, (...args) => {
      logger.debug(`[command]\t Command "${commandName}" executed with args (${args})`);

      const emulator = getAndUpdateEmulator();
      if (!emulator) {
        if (typeof onNoEmulator === "function") {
          return onNoEmulator(...args);
        }
      } else {
        return callback(emulator, ...args);
      }
    });
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

  registerEmulatorCommand(`${COMMAND_NAME_PREFIX}.subsequentArgumentDigit`, (emulator, args) => {
    if (!Array.isArray(args)) {
      return;
    }
    const arg = args[0];
    if (typeof arg !== "number") {
      return;
    }
    emulator.subsequentArgumentDigit(arg);
  });

  registerEmulatorCommand(`${COMMAND_NAME_PREFIX}.digitArgument`, (emulator, args) => {
    if (!Array.isArray(args)) {
      return;
    }
    const arg = args[0];
    if (typeof arg !== "number") {
      return;
    }
    emulator.digitArgument(arg);
  });

  registerEmulatorCommand(`${COMMAND_NAME_PREFIX}.typeChar`, (emulator, args) => {
    if (!Array.isArray(args)) {
      return;
    }
    const arg = args[0];
    if (typeof arg !== "string") {
      return;
    }
    emulator.typeChar(arg);
  });

  registerEmulatorCommand(`${COMMAND_NAME_PREFIX}.universalArgument`, (emulator) => {
    emulator.universalArgument();
  });

  registerEmulatorCommand(`${COMMAND_NAME_PREFIX}.negativeArgument`, (emulator) => {
    return emulator.negativeArgument();
  });

  registerEmulatorCommand(`${COMMAND_NAME_PREFIX}.cancel`, (emulator) => {
    emulator.cancel();
  });

  vscode.commands.registerCommand(`${COMMAND_NAME_PREFIX}.executeCommands`, async (...args: any[]) => {
    if (1 <= args.length) {
      executeCommands(args[0]);
    }
  });

  registerEmulatorCommand(`${COMMAND_NAME_PREFIX}.executeCommandWithPrefixArgument`, (emulator, args) => {
    if (typeof args !== "object" || args == null || Array.isArray(args)) {
      return;
    }

    if (
      typeof args?.command === "string" &&
      (typeof args?.prefixArgumentKey === "string" || args?.prefixArgumentKey == null)
    ) {
      emulator.executeCommandWithPrefixArgument(args["command"], args["args"], args["prefixArgumentKey"]);
    }
  });

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
