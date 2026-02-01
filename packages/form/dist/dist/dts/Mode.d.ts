import * as Duration from "effect/Duration";
export type FormMode = "onSubmit" | "onBlur" | "onChange" | {
    readonly onChange: {
        readonly debounce: Duration.DurationInput;
        readonly autoSubmit?: false;
    };
} | {
    readonly onBlur: {
        readonly autoSubmit: true;
    };
} | {
    readonly onChange: {
        readonly debounce: Duration.DurationInput;
        readonly autoSubmit: true;
    };
};
export type FormModeWithoutAutoSubmit = "onSubmit" | "onBlur" | "onChange" | {
    readonly onChange: {
        readonly debounce: Duration.DurationInput;
        readonly autoSubmit?: false;
    };
};
export interface ParsedMode {
    readonly validation: "onSubmit" | "onBlur" | "onChange";
    readonly debounce: number | null;
    readonly autoSubmit: boolean;
}
export declare const parse: (mode?: FormMode) => ParsedMode;
//# sourceMappingURL=Mode.d.ts.map