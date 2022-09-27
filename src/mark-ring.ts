import assert from "assert";
import {
    Position,
    Range,
    Selection,
    TextDocumentChangeEvent,
    TextDocumentContentChangeEvent,
} from "vscode";

export class Marker {
    private readonly positions: Position[];

    constructor(positions: Position[]) {
        this.positions = positions;
    }

    public static fromAnchor(selections: readonly Selection[]): Marker {
        return new Marker(selections.map((selection) => selection.anchor));
    }

    public static fromCursor(selections: readonly Selection[]): Marker {
        return new Marker(selections.map((selection) => selection.active));
    }

    public toCursor(
        selections: readonly Selection[] | undefined = undefined
    ): Selection[] {
        if (selections === undefined) {
            return this.positions.map(
                (position) => new Selection(position, position)
            );
        } else {
            return selections.map((selection, idx) => {
                const marked: Position | undefined = this.positions[idx];
                if (marked !== undefined) {
                    return new Selection(marked, marked);
                } else {
                    return selection;
                }
            });
        }
    }

    public toAnchor(selections: readonly Selection[]): Selection[] {
        return selections.map((selection, idx) => {
            const marked = this.positions[idx];
            if (marked !== undefined) {
                return new Selection(marked, selection.active);
            } else {
                return selection;
            }
        });
    }

    public isEqual(other: Marker): boolean {
        if (other.positions.length !== this.positions.length) {
            return false;
        }

        for (let idx = 0; idx < this.positions.length; idx++) {
            const left = this.positions[idx];
            const right = other.positions[idx];

            if (left === right) {
                continue;
            } else if (left === undefined || right === undefined) {
                return false;
            } else {
                return left.isEqual(right);
            }
        }
        return true;
    }

    public update(change: TextDocumentContentChange): void {
        this.positions.forEach((p, i) => {
            this.positions[i] = updatePosition(p, change);
        });
    }
}

export class MarkRing {
    private maxNum = 16;
    private ring: Array<Marker>;
    private pointer: number | undefined = undefined;
    private isZeroEphemeral = false;

    constructor(maxNum?: number) {
        if (maxNum) {
            this.maxNum = maxNum;
        }

        this.ring = [];
    }

    public push(mark: Marker, replace = false, force = false): void {
        const top = this.getTop();

        if (top === undefined) {
            this.ring[0] = mark;
            this.pointer = 0;
        } else if (force || !top.isEqual(mark)) {
            assert(this.pointer !== undefined);
            if (replace) {
                this.ring[this.pointer] = mark;
            } else {
                if (this.isZeroEphemeral) {
                    this.ring.shift();
                    this.isZeroEphemeral = false;
                }
                this.ring.unshift(mark);
                this.pointer = 0;
                if (this.ring.length > this.maxNum) {
                    this.ring.pop();
                }
            }
        }
    }

    public set(mark: Marker): void {
        this.push(mark);
        this.isZeroEphemeral = true;
    }

    public getTop(): Marker | undefined {
        if (this.ring.length === 0) {
            return undefined;
        }

        assert(typeof this.pointer === "number");

        return this.ring[this.pointer];
    }

    public pop(): Marker | undefined {
        if (this.isZeroEphemeral) {
            this.ring.shift();
            this.isZeroEphemeral = false;
        }
        if (this.ring.length === 0) {
            this.pointer = undefined;
            return undefined;
        }
        assert(typeof this.pointer === "number");

        const ret = this.ring[this.pointer];
        this.pointer = (this.pointer + 1) % this.ring.length;
        return ret;
    }

    public onDidChangeTextDocument(e: TextDocumentChangeEvent): void {
        e.contentChanges
            .map((event) => new TextDocumentContentChange(event))
            .forEach((change) => {
                this.ring.forEach((marker) => marker.update(change));
            });
    }
}

class TextDocumentContentChange {
    readonly event: TextDocumentContentChangeEvent;

    constructor(event: TextDocumentContentChangeEvent) {
        this.event = event;
    }

    public get range(): Range {
        return this.event.range;
    }

    public get text(): string {
        return this.event.text;
    }

    public get textLines(): number {
        if (this._textLines === undefined) {
            const text = this.text;
            let pos = text.indexOf("\n");
            let count = 1;
            while (pos >= 0) {
                count++;
                pos = text.indexOf("\n", pos + 1);
            }
            this._textLines = count;
        }
        return this._textLines;
    }

    public get lastTextLineLength(): number {
        if (this._lastTextLineLength === undefined) {
            const text = this.text;
            const idx = text.lastIndexOf("\n");
            this._lastTextLineLength = text.length - idx - 1;
        }
        return this._lastTextLineLength;
    }

    private _textLines: number | undefined = undefined;
    private _lastTextLineLength: number | undefined = undefined;
}

function updatePosition(
    p: Position,
    change: TextDocumentContentChange
): Position {
    if (p.isBeforeOrEqual(change.range.start)) {
        return p; // nothing to do, the edit starts after this position.
    }

    if (p.isBefore(change.range.end)) {
        // The old position has been deleted:
        return change.range.start;
    }

    // Otherwise, the entire edit occurred before this position, so we have to
    // shift p by the delta of the change:
    const origLines = change.range.end.line - change.range.start.line + 1;
    const lineDelta = change.textLines - origLines;
    let colDelta = 0;
    if (change.range.end.line === p.line) {
        colDelta = change.lastTextLineLength - change.range.end.character;
        if (change.range.start.line === change.range.end.line) {
            colDelta += change.range.start.character;
        }
    }

    return p.translate(lineDelta, colDelta);
}
