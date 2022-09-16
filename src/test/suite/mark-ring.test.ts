import { Position } from "vscode";
import assert from "assert";
import { Marker, MarkRing } from "../../mark-ring";

suite("MarkRing", () => {
    test("push, getTop, and pop", () => {
        const markRing = new MarkRing(3);

        const entities = [
            [new Position(0, 1)],
            [new Position(2, 3)],
            [new Position(4, 5)],
            [new Position(6, 7)],
        ];

        entities.forEach((entity) => {
            markRing.push(new Marker(entity));
        });

        assert.strictEqual(markRing.getTop(), new Marker([new Position(6, 7)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(6, 7)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(4, 5)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(2, 3)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(6, 7)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(4, 5)]));
    });

    test("push with replace", () => {
        const markRing = new MarkRing(3);

        const entities = [
            [new Position(0, 1)],
            [new Position(2, 3)],
            [new Position(4, 5)],
            [new Position(6, 7)],
        ] as const;

        markRing.push(new Marker(entities[0]), false);
        markRing.push(new Marker(entities[1]), false);
        markRing.push(new Marker(entities[2]), false);
        markRing.push(new Marker(entities[3]), true); // Replace the top

        assert.strictEqual(markRing.getTop(), new Marker([new Position(6, 7)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(6, 7)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(2, 3)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(0, 1)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(6, 7)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(2, 3)]));
    });

    test("push with replace at first", () => {
        const markRing = new MarkRing(3);

        const entities = [
            [new Position(0, 1)],
            [new Position(2, 3)],
            [new Position(4, 5)],
            [new Position(6, 7)],
        ] as const;
        markRing.push(new Marker(entities[0]), true); // Replace the top
        markRing.push(new Marker(entities[1]), false);
        markRing.push(new Marker(entities[2]), false);
        markRing.push(new Marker(entities[3]), false);

        assert.strictEqual(markRing.getTop(), new Marker([new Position(6, 7)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(6, 7)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(4, 5)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(2, 3)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(6, 7)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(4, 5)]));
    });
    test("less data than max", () => {
        const markRing = new MarkRing(4);

        const entities = [
            [new Position(0, 1)],
            [new Position(2, 3)],
            [new Position(4, 5)],
        ];

        entities.forEach((entity) => {
            markRing.push(new Marker(entity));
        });

        assert.strictEqual(markRing.getTop(), new Marker([new Position(4, 5)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(4, 5)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(2, 3)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(0, 1)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(4, 5)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(2, 3)]));
        assert.strictEqual(markRing.pop(), new Marker([new Position(0, 1)]));
    });

    test("just single data", () => {
        const markRing = new MarkRing(3);

        const entities = [[new Position(0, 1)]];

        entities.forEach((entity) => {
            markRing.push(new Marker(entity));
        });

        assert.strictEqual(markRing.getTop(), [new Position(0, 1)]);
        assert.strictEqual(markRing.pop(), [new Position(0, 1)]);
        assert.strictEqual(markRing.pop(), [new Position(0, 1)]);
    });

    test("zero data", () => {
        const markRing = new MarkRing(3);

        assert.strictEqual(markRing.getTop(), undefined);
        assert.strictEqual(markRing.pop(), undefined);
        assert.strictEqual(markRing.pop(), undefined);
    });
});
