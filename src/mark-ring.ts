import { Position, Selection } from "vscode";

export class Mark {
  private positions: readonly Position[];

  constructor(positions: readonly Position[]) {
    this.positions = positions;
  }

  public static fromAnchor(selections: readonly Selection[]): Mark {
    return new Mark(selections.map((selection) => selection.anchor));
  }

  public static fromCursor(selections: readonly Selection[]): Mark {
    return new Mark(selections.map((selection) => selection.active));
  }

  public toCursor(selections: readonly Selection[] | undefined = undefined): Selection[] {
    if (selections === undefined) {
      return this.positions.map((position) => new Selection(position, position));
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

  public isEqual(other: Mark): boolean {
    if (other.positions.length !== this.positions.length) {
      return false;
    }

    for (let idx = 0; idx < this.positions.length; idx++) {
      const left = this.positions[idx];
      const right = other.positions[idx];

      if (left === right) {
        continue;
      } else if (left === undefined || right === undefined) {
        return false
      } else {
        return left.isEqual(right);
      }
    }
    return true;
  }
}


export class MarkRing {
  private maxNum = 16;
  private ring: Array<Mark>;
  private pointer: number | null;

  constructor(maxNum?: number) {
    if (maxNum) {
      this.maxNum = maxNum;
    }

    this.pointer = null;
    this.ring = [];
  }

  public push(mark: Mark, replace = false, force = false): void {
    const top = this.getTop();

    if (replace || top === undefined) {
      this.ring[0] = mark;
    } else if (force || top.isEqual(mark)) {
      this.ring.unshift(mark);
      if (this.ring.length > this.maxNum) {
        this.ring.pop();
      }
    }
    this.pointer = 0;
  }

  public getTop(): Mark | undefined {
    if (this.pointer == null || this.ring.length === 0) {
      return undefined;
    }

    return this.ring[this.pointer];
  }

  public pop(): Mark | undefined {
    if (this.pointer == null || this.ring.length === 0) {
      return undefined;
    }

    const ret = this.ring[this.pointer];

    this.pointer = (this.pointer + 1) % this.ring.length;

    return ret;
  }
}
