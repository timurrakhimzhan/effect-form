import type { FormAtoms } from "@lucas-barake/effect-form"
import type * as Field from "@lucas-barake/effect-form/Field"
import { createContext, type ReactNode, useContext } from "react"

const FormContext = createContext<
  FormAtoms.FormAtoms<
    Field.FieldsRecord,
    unknown,
    unknown,
    unknown,
    unknown
  > | null
>(null)

export interface FormProviderProps<
  TFields extends Field.FieldsRecord,
  R,
  A,
  E,
  SubmitArgs,
> {
  readonly formAtoms: FormAtoms.FormAtoms<TFields, R, A, E, SubmitArgs>
  readonly children: ReactNode
}

export function FormProvider<
  TFields extends Field.FieldsRecord,
  R,
  A,
  E,
  SubmitArgs,
>({ children, formAtoms }: FormProviderProps<TFields, R, A, E, SubmitArgs>) {
  return (
    <FormContext.Provider
      value={formAtoms as FormAtoms.FormAtoms<Field.FieldsRecord, unknown, unknown, unknown, unknown>}
    >
      {children}
    </FormContext.Provider>
  )
}

export function useFormContext<
  TFields extends Field.FieldsRecord = Field.FieldsRecord,
  R = unknown,
  A = unknown,
  E = unknown,
  SubmitArgs = unknown,
>(): FormAtoms.FormAtoms<TFields, R, A, E, SubmitArgs> {
  const ctx = useContext(FormContext)
  if (!ctx) {
    throw new Error("useFormContext must be used within FormProvider")
  }
  return ctx as FormAtoms.FormAtoms<TFields, R, A, E, SubmitArgs>
}
