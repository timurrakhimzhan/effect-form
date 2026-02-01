import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import type { FormAtoms, FormBuilder } from "@lucas-barake/effect-form"
import { isPathOrParentDirty } from "@lucas-barake/effect-form/Path"
import type * as Field from "@lucas-barake/effect-form/Field"
import type * as Option from "effect/Option"
import { useCallback, useMemo } from "react"

export interface FieldState<T> {
  readonly value: T
  readonly onChange: (value: T) => void
  readonly onBlur: () => void
  readonly error: Option.Option<string>
  readonly isTouched: boolean
  readonly isDirty: boolean
  readonly isValidating: boolean
}

export function useFormField<
  TFields extends Field.FieldsRecord,
  R,
  A,
  E,
  SubmitArgs,
  S,
>(
  formAtoms: FormAtoms.FormAtoms<TFields, R, A, E, SubmitArgs>,
  fieldRef: FormBuilder.FieldRef<S>,
): FieldState<S> {
  const fieldAtoms = useMemo(
    () => formAtoms.getOrCreateFieldAtoms(fieldRef.key),
    [formAtoms, fieldRef.key],
  )

  // Read from atoms - all logic is in FormAtoms
  const value = useAtomValue(fieldAtoms.valueAtom) as S
  const isTouched = useAtomValue(fieldAtoms.touchedAtom)
  const visibleError = useAtomValue(fieldAtoms.visibleErrorAtom)
  const isValidating = useAtomValue(fieldAtoms.isValidatingAtom)
  const dirtyFields = useAtomValue(formAtoms.dirtyFieldsAtom)

  // Write to atoms - handlers just call atom setters
  const setOnChange = useAtomSet(fieldAtoms.onChangeAtom)
  const setOnBlur = useAtomSet(fieldAtoms.onBlurAtom)

  const handleChange = useCallback((newValue: S) => {
    setOnChange(newValue)
  }, [setOnChange])

  const handleBlur = useCallback(() => {
    setOnBlur()
  }, [setOnBlur])

  const isDirty = useMemo(
    () => isPathOrParentDirty(dirtyFields, fieldRef.key),
    [dirtyFields, fieldRef.key],
  )

  return useMemo(() => ({
    value,
    onChange: handleChange,
    onBlur: handleBlur,
    error: visibleError,
    isTouched,
    isDirty,
    isValidating,
  }), [value, handleChange, handleBlur, visibleError, isTouched, isDirty, isValidating])
}
