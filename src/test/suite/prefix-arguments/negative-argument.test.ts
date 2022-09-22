import assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { TextEditor } from "vscode";
import { EmacsEmulator } from "../../../emulator";
import { assertTextEqual, cleanUpWorkspace, setupWorkspace } from "../utils";
import { PrefixArgumentHandler } from "../../../prefix-argument";
import { InputBoxMinibuffer } from "../../../minibuffer";

suite("Negative argument (M--)", () => {
    let activeTextEditor: TextEditor;
    let prefix: PrefixArgumentHandler;
    let emulator: EmacsEmulator;

    setup(() => {
        sinon.spy(vscode.commands, "executeCommand");
    });

    teardown(() => {
        sinon.restore();
    });

    const assertPrefixArgumentContext = (expected: number | undefined) => {
        assert(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            vscode.commands.executeCommand.calledWithExactly(
                "setContext",
                "emacs-mcx.prefixArgument",
                expected
            ),
            `Assertion failed that emacs-mcx.prefixArgument context has been set to ${expected}`
        );
    };

    const assertAcceptingArgumentContext = (expected: boolean) => {
        assert(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            vscode.commands.executeCommand.calledWithExactly(
                "setContext",
                "emacs-mcx.acceptingArgument",
                expected
            ),
            `Assertion failed that emacs-mcx.acceptingArgument context has been set to ${expected}`
        );
    };

    const resetExecuteCommandSpy = () => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        vscode.commands.executeCommand.resetHistory();
    };

    suite("Negative argument and single character input", () => {
        setup(async () => {
            activeTextEditor = await setupWorkspace();
            prefix = new PrefixArgumentHandler();
            emulator = new EmacsEmulator(
                activeTextEditor,
                null,
                new InputBoxMinibuffer(),
                prefix
            );
        });

        teardown(cleanUpWorkspace);

        test("M-- 3", async () => {
            resetExecuteCommandSpy();
            await prefix.negativeArgument();
            assertAcceptingArgumentContext(true);
            assertPrefixArgumentContext(-1);

            resetExecuteCommandSpy();
            await prefix.subsequentArgumentDigit(3);
            assertPrefixArgumentContext(-3);

            resetExecuteCommandSpy();
            await emulator.typeChar("a");
            assertTextEqual(activeTextEditor, ""); // Nothing happens
            assertAcceptingArgumentContext(false);
            assertPrefixArgumentContext(undefined);
        });

        test("C-u - 3", async () => {
            resetExecuteCommandSpy();
            await prefix.universalArgument();
            assertAcceptingArgumentContext(true);
            assertPrefixArgumentContext(4);

            resetExecuteCommandSpy();
            await emulator.typeChar("-");
            assertPrefixArgumentContext(-1);

            resetExecuteCommandSpy();
            await prefix.subsequentArgumentDigit(3);
            assertPrefixArgumentContext(-3);

            resetExecuteCommandSpy();
            await emulator.typeChar("a");
            assertTextEqual(activeTextEditor, ""); // Nothing happens
            assertAcceptingArgumentContext(false);
            assertPrefixArgumentContext(undefined);
        });

        test("C-u C-u - 3", async () => {
            resetExecuteCommandSpy();
            await prefix.universalArgument();
            assertAcceptingArgumentContext(true);
            assertPrefixArgumentContext(4);

            resetExecuteCommandSpy();
            await prefix.universalArgument();
            assertPrefixArgumentContext(16);

            resetExecuteCommandSpy();
            await emulator.typeChar("-");
            assertPrefixArgumentContext(-1);

            resetExecuteCommandSpy();
            await prefix.subsequentArgumentDigit(3);
            assertPrefixArgumentContext(-3);

            resetExecuteCommandSpy();
            await emulator.typeChar("a");
            assertTextEqual(activeTextEditor, ""); // Nothing happens
            assertAcceptingArgumentContext(false);
            assertPrefixArgumentContext(undefined);
        });

        test("C-u M-- 3", async () => {
            resetExecuteCommandSpy();
            await prefix.universalArgument();
            assertAcceptingArgumentContext(true);
            assertPrefixArgumentContext(4);

            resetExecuteCommandSpy();
            await prefix.negativeArgument();
            assertPrefixArgumentContext(-1);

            resetExecuteCommandSpy();
            await prefix.subsequentArgumentDigit(3);
            assertPrefixArgumentContext(-3);

            resetExecuteCommandSpy();
            await emulator.typeChar("a");
            assertTextEqual(activeTextEditor, ""); // Nothing happens
            assertAcceptingArgumentContext(false);
            assertPrefixArgumentContext(undefined);
        });

        test("C-u 3 - ('-' is not handled as a minus sign)", async () => {
            resetExecuteCommandSpy();
            await prefix.universalArgument();
            assertAcceptingArgumentContext(true);
            assertPrefixArgumentContext(4);

            resetExecuteCommandSpy();
            await prefix.subsequentArgumentDigit(3);
            assertPrefixArgumentContext(3);

            resetExecuteCommandSpy();
            await emulator.typeChar("-");
            assertTextEqual(activeTextEditor, "---");
            assertAcceptingArgumentContext(false);
            assertPrefixArgumentContext(undefined);
        });
    });
});
