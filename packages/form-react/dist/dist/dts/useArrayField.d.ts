import type { FormAtoms, FormBuilder } from "@lucas-barake/effect-form";
import type * as Field from "@lucas-barake/effect-form/Field";
import type * as Schema from "effect/Schema";
export interface ArrayFieldOperations<T> {
    readonly items: ReadonlyArray<T>;
    readonly append: (value?: T) => void;
    readonly remove: (index: number) => void;
    readonly swap: (indexA: number, indexB: number) => void;
    readonly move: (fromIndex: number, toIndex: number) => void;
}
export declare function useArrayField<TFields extends Field.FieldsRecord, R, A, E, SubmitArgs, S>(formAtoms: FormAtoms.FormAtoms<TFields, R, A, E, SubmitArgs>, fieldRef: FormBuilder.FieldRef<ReadonlyArray<S>>, itemSchema: Schema.Schema<S, S>): ArrayFieldOperations<S>;
//# sourceMappingURL=useArrayField.d.ts.map