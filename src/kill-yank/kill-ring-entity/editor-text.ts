import { QuickPickItemKind, QuickInputButton } from "vscode";
import {
    AppendableRegionTexts,
    AppendDirection,
    IKillRingEntity,
    IRegionText,
} from "../kill-ring";

export class EditorTextKillRingEntity implements IKillRingEntity {
    public readonly type = "editor";
    public picked = false;

    private regionTextsList: AppendableRegionTexts[];

    constructor(regionTexts: IRegionText[]) {
        this.regionTextsList = regionTexts.map(
            (regionText) => new AppendableRegionTexts(regionText)
        );
    }
    private _flattened: string | undefined = undefined;
    private _label: string | undefined = undefined;

    kind?: QuickPickItemKind | undefined;
    description?: string | undefined;
    detail?: string | undefined;
    alwaysShow?: boolean | undefined;
    buttons?: readonly QuickInputButton[] | undefined;

    public get label(): string {
        if (!this._label) {
            this._label = "$(edit)" + JSON.stringify(this.asString());
        }
        return this._label;
    }

    public isSameClipboardText(clipboardText: string): boolean {
        return this.asString() === clipboardText;
    }

    public isEmpty(): boolean {
        return this.regionTextsList.every((regionTexts) =>
            regionTexts.isEmpty()
        );
    }

    public asString(): string {
        if (!this._flattened) {
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
