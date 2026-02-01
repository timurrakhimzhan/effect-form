import type { FormAtoms } from "@lucas-barake/effect-form";
import type * as Field from "@lucas-barake/effect-form/Field";
import { type ReactNode } from "react";
export interface FormProviderProps<TFields extends Field.FieldsRecord, R, A, E, SubmitArgs> {
    readonly formAtoms: FormAtoms.FormAtoms<TFields, R, A, E, SubmitArgs>;
    readonly children: ReactNode;
}
export declare function FormProvider<TFields extends Field.FieldsRecord, R, A, E, SubmitArgs>({ children, formAtoms }: FormProviderProps<TFields, R, A, E, SubmitArgs>): import("react/jsx-runtime").JSX.Element;
export declare function useFormContext<TFields extends Field.FieldsRecord = Field.FieldsRecord, R = unknown, A = unknown, E = unknown, SubmitArgs = unknown>(): FormAtoms.FormAtoms<TFields, R, A, E, SubmitArgs>;
//# sourceMappingURL=FormProvider.d.ts.map