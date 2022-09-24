import {
    AppendableRegionTexts,
    AppendDirection,
    IRegionText,
    KillRingEntityBase,
} from "../kill-ring";

export class EditorTextKillRingEntity extends KillRingEntityBase {
    public readonly type = "editor";
    protected readonly icon = "$(edit)";

    private regionTextsList: AppendableRegionTexts[];
    private _flattened: string | undefined = undefined;

    constructor(regionTexts: IRegionText[]) {
        super();
        this.regionTextsList = regionTexts.map(
            (regionText) => new AppendableRegionTexts(regionText)
        );
    }

    public isEmpty(): boolean {
        return this.regionTextsList.every((regionTexts) =>
            regionTexts.isEmpty()
        );
    }

    public asString(): string {
        if (this._flattened === undefined) {
            const appendedTexts = this.regionTextsList.map(
                (appendedRegionTexts) => ({
                    range: appendedRegionTexts.getLastRange(),
                    text: appendedRegionTexts.getAppendedText(),
                })
            );

            const sortedAppendedTexts = appendedTexts.sort((a, b) => {
                if (a.range.start.line === b.range.start.line) {
                    return a.range.start.character - b.range.start.character;
                } else {
                    return a.range.start.line - b.range.start.line;
                }
            });

            let allText = "";
            sortedAppendedTexts.forEach((item, i) => {
                const prevItem = sortedAppendedTexts[i - 1];
                if (
                    prevItem &&
                    prevItem.range.start.line !== item.range.start.line
                ) {
                    allText += "\n" + item.text;
                } else {
                    allText += item.text;
                }
            });
            this._flattened = allText;
        }
        return this._flattened;
    }

    public getRegionTexts(): AppendableRegionTexts[] {
        return this.regionTextsList;
    }

    public append(
        entity: EditorTextKillRingEntity,
        appendDirection: AppendDirection = AppendDirection.Forward
    ): void {
        const additional = entity.getRegionTexts();
        if (additional.length !== this.regionTextsList.length) {
            throw Error("Not appendable");
        }

        this.regionTextsList.map((appendedRegionTexts, i) =>
            // `additional.length === this.regionTextsList.length` has already been checked,
            // so noUncheckedIndexedAccess rule can be skipped here.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            appendedRegionTexts.append(additional[i]!, appendDirection)
        );
        this._flattened = undefined;
        this._label = undefined;
    }
}
