import * as assert from "assert";
import * as vscode from "vscode";
import {Position, Selection} from "vscode";
import {EmacsEmulator} from "../emulator";

suite("EmacsEmulator.killRegion() and .yank()", () => {
    test("it sorts ranges and aggregates the selected texts in order when multi cursor mode", async () => {
        const content = `0123456789
abcdefghij
ABCDEFGHIJ`;

        const doc = await vscode.workspace.openTextDocument({
            content,
            language: "text",
        });
        await vscode.window.showTextDocument(doc);

        const activeTextEditor = vscode.window.activeTextEditor;
        if (typeof activeTextEditor === "undefined") {
            throw Error("vscode.window.activeTextEditor");
        }

        const emulator = new EmacsEmulator(activeTextEditor);

        // Select with multi cursor in not aligned order
        activeTextEditor.selections = [
            new Selection(new Position(1, 0), new Position(1, 3)),
            new Selection(new Position(0, 0), new Position(0, 3)),
            new Selection(new Position(2, 0), new Position(2, 3)),
        ];

        await emulator.killRegion();

        assert.equal(
            doc.getText(),
            `3456789
defghij
DEFGHIJ`,
        );

        // Open a empty document
        const yankDoc = await vscode.workspace.openTextDocument({
            content: "",
            language: "text",
        });
        await vscode.window.showTextDocument(yankDoc);
        activeTextEditor.selections = [
            new Selection(new Position(0, 0), new Position(0, 0)),
        ];

        await emulator.yank();

        assert.equal(
            yankDoc.getText(),
            `012
abc
ABC`,
        );
    });
});
