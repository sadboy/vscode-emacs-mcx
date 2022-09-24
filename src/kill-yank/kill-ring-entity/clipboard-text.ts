import { AppendableRegionTexts, KillRingEntityBase } from "../kill-ring";

export class ClipboardTextKillRingEntity extends KillRingEntityBase {
    public readonly type = "clipboard";
    protected readonly icon = "$(clone)";

    private readonly text: string;

    constructor(clipboardText: string) {
        super();
        this.text = clipboardText;
    }

    public getRegionTexts(): readonly AppendableRegionTexts[] {
        return [];
    }

    public isEmpty(): boolean {
        return this.text === "";
    }

    public asString(): string {
        return this.text;
    }
}
