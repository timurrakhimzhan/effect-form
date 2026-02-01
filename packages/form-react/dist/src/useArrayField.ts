import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import type { FormAtoms, FormBuilder } from "@lucas-barake/effect-form"
import type * as Field from "@lucas-barake/effect-form/Field"
import * as Option from "effect/Option"
import type * as Schema from "effect/Schema"
import { useCallback, useMemo } from "react"

export interface ArrayFieldOperations<T> {
  readonly items: ReadonlyArray<T>
  readonly append: (value?: T) => void
  readonly remove: (index: number) => void
  readonly swap: (indexA: number, indexB: number) => void
  readonly move: (fromIndex: number, toIndex: number) => void
}

export function useArrayField<
  TFields extends Field.FieldsRecord,
  R,
  A,
  E,
  SubmitArgs,
  S,
>(
  formAtoms: FormAtoms.FormAtoms<TFields, R, A, E, SubmitArgs>,
  fieldRef: FormBuilder.FieldRef<ReadonlyArray<S>>,
  itemSchema: Schema.Schema<S, S>,
): ArrayFieldOperations<S> {
  const itemsOption = useAtomValue(formAtoms.getFieldAtom(fieldRef))
  const items = useMemo(
    () => Option.getOrElse(itemsOption, () => [] as ReadonlyArray<S>),
    [itemsOption],
  )
  const setStateAtom = useAtomSet(formAtoms.stateAtom)

  const append = useCallback((value?: S) => {
    setStateAtom((prev) => {
      if (Option.isNone(prev)) return prev
      return Option.some(
        formAtoms.operations.appendArrayItem(prev.value, fieldRef.key, itemSchema, value),
      )
    })
  }, [setStateAtom, fieldRef.key, itemSchema, formAtoms.operations])

  const remove = useCallback((index: number) => {
    setStateAtom((prev) => {
      if (Option.isNone(prev)) return prev
      return Option.some(
        formAtoms.operations.removeArrayItem(prev.value, fieldRef.key, index),
      )
    })
  }, [setStateAtom, fieldRef.key, formAtoms.operations])

  const swap = useCallback((indexA: number, indexB: number) => {
    setStateAtom((prev) => {
      if (Option.isNone(prev)) return prev
      return Option.some(
        formAtoms.operations.swapArrayItems(prev.value, fieldRef.key, indexA, indexB),
      )
    })
  }, [setStateAtom, fieldRef.key, formAtoms.operations])

  const move = useCallback((fromIndex: number, toIndex: number) => {
    setStateAtom((prev) => {
      if (Option.isNone(prev)) return prev
      return Option.some(
        formAtoms.operations.moveArrayItem(prev.value, fieldRef.key, fromIndex, toIndex),
      )
    })
  }, [setStateAtom, fieldRef.key, formAtoms.operations])

  return useMemo(
    () => ({ items, append, remove, swap, move }),
    [items, append, remove, swap, move],
  )
}
