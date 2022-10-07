import * as vscode from "vscode";
import { Range, TextEditor } from "vscode";
import { EmacsCommand } from ".";
import { EmacsEmulator, SearchState } from "../emulator";
import { MessageManager } from "../message";
import { Marker } from "../mark-ring";

interface FindArgs {
    // See https://github.com/microsoft/vscode/blob/1.64.0/src/vs/editor/contrib/find/browser/findController.ts#L588-L599
    searchString?: string;
    replaceString?: string;
    isRegex?: boolean;
    matchWholeWord?: boolean;
    isCaseSensitive?: boolean;
    preserveCase?: boolean;
}

abstract class ISearchCommand extends EmacsCommand {
    protected searchState: SearchState;

    public constructor(emacsController: EmacsEmulator) {
        super(emacsController);

        this.searchState = emacsController.searchState;
    }

    protected async openFindWidget({
        isRegex,
        searchString,
        replaceString,
    }: {
        isRegex?: boolean;
        searchString?: string;
        replaceString?: string;
    }): Promise<void> {
        const findArgs: FindArgs = {
            searchString,
            replaceString,
            isRegex,
        };

        return vscode.commands.executeCommand(
            "editor.actions.findWithArgs",
            findArgs
        );
    }
}

export class ISearchBegin extends ISearchCommand {
    public static readonly id = "isearchBegin";

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined,
        ...args: unknown[]
    ): Promise<unknown> {
        this.searchState.startPosition = Marker.fromCursor(
            textEditor.selections
        );
        let findArgs: FindArgs = { isRegex: false };
        if (args.length > 0) {
            // Just let it error at runtime if keybindings.json is bad:
            [findArgs] = args as [FindArgs];
        }
        return this.openFindWidget(findArgs);
    }
}

export class ISearchForward extends ISearchCommand {
    public static readonly id = "isearchForward";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        await this.openFindWidget({ isRegex: false });
        return vscode.commands.executeCommand(
            "editor.action.nextMatchFindAction"
        );
    }
}

export class ISearchBackward extends ISearchCommand {
    public static readonly id = "isearchBackward";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        await this.openFindWidget({ isRegex: false });
        return vscode.commands.executeCommand(
            "editor.action.previousMatchFindAction"
        );
    }
}

export class ISearchForwardRegexp extends ISearchCommand {
    public static readonly id = "isearchForwardRegexp";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        await this.openFindWidget({ isRegex: true });
        return vscode.commands.executeCommand(
            "editor.action.nextMatchFindAction"
        );
    }
}

export class ISearchBackwardRegexp extends ISearchCommand {
    public static readonly id = "isearchBackwardRegexp";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        await this.openFindWidget({ isRegex: true });
        return vscode.commands.executeCommand(
            "editor.action.previousMatchFindAction"
        );
    }
}

export class ISearchYankWordOrChar extends ISearchCommand {
    public static readonly id = "isearchYankWordOrChar";

    public async execute(
        textEditor: vscode.TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<unknown> {
        const anchor = textEditor.selection.anchor;
        await this.emacs.runCommand("forwardWord");
        const searchString = this.emacs.bufferSubstring(
            new Range(anchor, textEditor.selection.active)
        );
        return this.openFindWidget({ searchString: searchString });
    }
}

export class QueryReplace extends ISearchCommand {
    public static readonly id = "queryReplace";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        // I could not find a way to open the find widget with `editor.actions.findWithArgs`
        // revealing the replace input and restoring the both query and replace strings.
        // So `editor.action.startFindReplaceAction` is used here.
        return vscode.commands.executeCommand(
            "editor.action.startFindReplaceAction"
        );
    }
}

export class QueryReplaceRegexp extends ISearchCommand {
    public static readonly id = "queryReplaceRegexp";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        // Like `queryReplace` command, I could not find a way to open the find widget with the desired state.
        // In this command, setting `isRegex` is the priority and I gave up restoring the replace string by setting ´replaceString=undefined`.
        return this.openFindWidget({
            isRegex: true,
            replaceString: "",
        });
    }
}

/**
 * C-g
 */
export class ISearchAbort extends ISearchCommand {
    public static readonly id = "isearchAbort";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        if (this.searchState.startPosition) {
            textEditor.selections = this.searchState.startPosition.toCursor();
        }
        MessageManager.showMessage("Quit");
        this.emacs.deactivateMark();
        this.emacs.revealPrimaryCursor();
        return vscode.commands.executeCommand("closeFindWidget");
    }
}

/**
 * Enter, etc
 */
export class ISearchExit extends ISearchCommand {
    public static readonly id = "isearchExit";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined,
        ...args: unknown[]
    ): Promise<void> {
        this.emacs.deactivateMark();
        if (this.searchState.startPosition) {
            this.emacs.pushMark(this.searchState.startPosition, true);
            MessageManager.showMessage("Mark saved where search started");
        }

        if (args.length > 0) {
            await vscode.commands.executeCommand("closeFindWidget");

            const [{ then }] = args as [{ then: string }];
            return vscode.commands.executeCommand(then);
        } else {
            return vscode.commands.executeCommand("closeFindWidget");
        }
    }
}

export class ISearchAccept extends ISearchCommand {
    public static readonly id = "isearchAccept";

    public async execute(
        textEditor: TextEditor,
        isInMarkMode: boolean,
        prefixArgument: number | undefined
    ): Promise<void> {
        this.emacs.deactivateMark();
        if (this.searchState.startPosition) {
            this.emacs.pushMark(this.searchState.startPosition, true);
            MessageManager.showMessage("Mark saved where search started");
        }

        return vscode.commands.executeCommand(
            "workbench.action.focusActiveEditorGroup"
        );
    }
}
