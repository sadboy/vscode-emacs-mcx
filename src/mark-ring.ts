import assert from "assert";
import { Position, Selection } from "vscode";

export class Marker {
    private positions: readonly Position[];

    constructor(positions: readonly Position[]) {
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
}

export class MarkRing {
    private maxNum = 16;
    private ring: Array<Marker>;
    private pointer: number | null;

    constructor(maxNum?: number) {
        if (maxNum) {
            this.maxNum = maxNum;
        }

        this.pointer = null;
        this.ring = [];
    }

    public push(mark: Marker, replace = false, force = false): void {
        const top = this.getTop();

        if (replace || top === undefined) {
            this.ring[0] = mark;
        } else if (force || !top.isEqual(mark)) {
            this.ring.unshift(mark);
            if (this.ring.length > this.maxNum) {
                this.ring.pop();
            }
        }
        this.pointer = 0;
    }

    public getTop(): Marker | undefined {
        if (this.ring.length === 0) {
            return undefined;
        }

        assert(typeof this.pointer === "number");

        return this.ring[this.pointer];
    }

    public pop(): Marker | undefined {
        if (this.ring.length === 0) {
            return undefined;
        }

        assert(typeof this.pointer === "number");

        const ret = this.ring[this.pointer];

        this.pointer = (this.pointer + 1) % this.ring.length;

        return ret;
    }
}
