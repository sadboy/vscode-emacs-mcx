import { QuickPickItem, Range } from "vscode";

export enum AppendDirection {
    Forward,
    Backward,
}

export interface IRegionText {
    text: string;
    range: Range;
}

export class AppendableRegionTexts {
    /**
     * This class represents a sequence of IRegionTexts appended by kill command.
     * Each element come from one cursor (selection) at single kill.
     */
    private regionTexts: IRegionText[];

    constructor(regionText: IRegionText) {
        this.regionTexts = [regionText];
    }

    public append(
        another: AppendableRegionTexts,
        appendDirection: AppendDirection = AppendDirection.Forward
    ): void {
        if (appendDirection === AppendDirection.Forward) {
            this.regionTexts = this.regionTexts.concat(another.regionTexts);
        } else {
            this.regionTexts = another.regionTexts.concat(this.regionTexts);
        }
    }

    public isEmpty(): boolean {
        return this.regionTexts.every((regionText) => regionText.text === "");
    }

    public getAppendedText(): string {
        return this.regionTexts.map((regionText) => regionText.text).join("");
    }

    public getLastRange(): Range {
        return this.regionTexts[this.regionTexts.length - 1]!.range; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }
}

export interface IKillRingEntity extends QuickPickItem {
    type: string;
    isSameClipboardText(clipboardText: string): boolean;
    isEmpty(): boolean;
    asString(): string;
    getRegionTexts(): readonly AppendableRegionTexts[];
}

export class KillRing {
    private maxNum = 60;
    private _killRing: Array<IKillRingEntity>;
    private pointer: number;

    constructor(maxNum = 60) {
        if (maxNum) {
            this.maxNum = maxNum;
        }

        this.pointer = -1;
        this._killRing = [];
    }

    public push(entity: IKillRingEntity): void {
        this._killRing.unshift(entity);
        if (this._killRing.length > this.maxNum) {
            this._killRing.pop();
        }
        this.pointer = 0;
    }

    public getZero(): IKillRingEntity | undefined {
        return this._killRing[0];
    }

    public getTop(): IKillRingEntity | undefined {
        if (this._killRing.length === 0) {
            return undefined;
        }
        if (this.pointer < 0) {
            this.pointer = 0;
        }

        return this._killRing[this.pointer];
    }

    public popNext(): IKillRingEntity | undefined {
        if (this._killRing.length === 0) {
            return undefined;
        }
        if (this.pointer < 0) {
            this.pointer = 0;
        } else {
            this._killRing[this.pointer]!.picked = false;
        }

        this.pointer = (this.pointer + 1) % this._killRing.length;
        return this._killRing[this.pointer];
    }

    public setTop(item: IKillRingEntity): void {
        this.pointer = this._killRing.indexOf(item);
    }

    public getRing(): readonly IKillRingEntity[] {
        return this._killRing
            .slice(this.pointer)
            .concat(this._killRing.slice(0, this.pointer));
    }
}
