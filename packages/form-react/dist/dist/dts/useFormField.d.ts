import type { FormAtoms, FormBuilder } from "@lucas-barake/effect-form";
import type * as Field from "@lucas-barake/effect-form/Field";
import type * as Option from "effect/Option";
export interface FieldState<T> {
    readonly value: T;
    readonly onChange: (value: T) => void;
    readonly onBlur: () => void;
    readonly error: Option.Option<string>;
    readonly isTouched: boolean;
    readonly isDirty: boolean;
    readonly isValidating: boolean;
}
export declare function useFormField<TFields extends Field.FieldsRecord, R, A, E, SubmitArgs, S>(formAtoms: FormAtoms.FormAtoms<TFields, R, A, E, SubmitArgs>, fieldRef: FormBuilder.FieldRef<S>): FieldState<S>;
//# sourceMappingURL=useFormField.d.ts.map