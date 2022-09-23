import { QuickPickItemKind, QuickInputButton } from "vscode";
import { AppendableRegionTexts, IKillRingEntity } from "../kill-ring";

export class ClipboardTextKillRingEntity implements IKillRingEntity {
    public readonly type = "clipboard";

    public picked = false;

    private readonly text: string;
    private _label: string | undefined = undefined;

    constructor(clipboardText: string) {
        this.text = clipboardText;
    }

    public getRegionTexts(): readonly AppendableRegionTexts[] {
        return [];
    }

    public get label(): string {
        if (this._label === undefined) {
            this._label = "$(clone)" + JSON.stringify(this.asString());
        }
        return this._label;
    }

    kind?: QuickPickItemKind | undefined;
    description?: string | undefined;
    detail?: string | undefined;
    alwaysShow?: boolean | undefined;
    buttons?: readonly QuickInputButton[] | undefined;

    public isSameClipboardText(clipboardText: string): boolean {
        return clipboardText === this.text;
    }

    public isEmpty(): boolean {
        return this.text === "";
    }

    public asString(): string {
        return this.text;
    }
}
