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
        return this.regionTexts[this.regionTexts.length - 1]!.range;
    }
}

export interface IKillRingEntity {
    type: string;
    isSameClipboardText(clipboardText: string): boolean;
    isEmpty(): boolean;
    asString(): string;
    getRegionTexts(): readonly AppendableRegionTexts[];
    getLabel(): string;
}

export abstract class KillRingEntityBase implements IKillRingEntity {
    // Perf trade-off: this limits the filterable portion of the kill ring
    // entity, but prevents really large copies from slowing down the UI:
    public static MAX_LABEL_LENGTH = 12000;

    public abstract type: string;
    public abstract isEmpty(): boolean;
    public abstract asString(): string;
    public abstract getRegionTexts(): readonly AppendableRegionTexts[];

    protected abstract icon: string;

    protected _label: string | undefined = undefined;

    public getLabel(): string {
        if (this._label === undefined) {
            let label = JSON.stringify(this.asString());
            if (label.length > KillRingEntityBase.MAX_LABEL_LENGTH) {
                label = label.substring(0, KillRingEntityBase.MAX_LABEL_LENGTH);
            }
            this._label = this.icon.concat(label);
        }
        return this._label;
    }

    public isSameClipboardText(clipboardText: string): boolean {
        return this.asString() === clipboardText;
    }
}

interface IKillRingQuickPickItem extends QuickPickItem {
    index: number;
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
        }

        this.pointer = (this.pointer + 1) % this._killRing.length;
        return this._killRing[this.pointer];
    }

    public setTop(item: IKillRingQuickPickItem): void {
        this.pointer = item.index % this._killRing.length;
    }

    public getRingAsQuickPickItems(): IKillRingQuickPickItem[] {
        const items = this._killRing.map((entity, idx) => ({
            label: entity.getLabel(),
            index: idx,
        }));
        return items.slice(this.pointer).concat(items.slice(0, this.pointer));
    }
}
