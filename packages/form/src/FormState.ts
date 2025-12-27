/**
 * Form state operations - pure transforms for form state manipulation.
 *
 * @since 1.0.0
 */
import type * as Form from "./Form.js"
import { recalculateDirtyFieldsForArray, recalculateDirtySubtree } from "./internal/dirty.js"
import { getNestedValue, setNestedValue } from "./internal/path.js"

// ================================
// Value Operations
// ================================

/**
 * Gets a value from form state at the specified path.
 *
 * @since 1.0.0
 * @category Value Operations
 */
export const getValue = <TFields extends Form.FieldsRecord>(
  state: Form.FormState<TFields>,
  path: string,
): unknown => getNestedValue(state.values, path)

/**
 * Sets a value in form state at the specified path, recalculating dirty fields.
 *
 * @since 1.0.0
 * @category Value Operations
 */
export const setValue = <TFields extends Form.FieldsRecord>(
  state: Form.FormState<TFields>,
  path: string,
  value: unknown,
): Form.FormState<TFields> => {
  const newValues = setNestedValue(state.values, path, value)
  const newDirtyFields = recalculateDirtySubtree(
    state.dirtyFields,
    state.initialValues,
    newValues,
    path,
  )
  return {
    ...state,
    values: newValues as Form.EncodedFromFields<TFields>,
    dirtyFields: newDirtyFields,
  }
}

/**
 * Replaces all values in form state, recalculating all dirty fields.
 *
 * @since 1.0.0
 * @category Value Operations
 */
export const setValues = <TFields extends Form.FieldsRecord>(
  state: Form.FormState<TFields>,
  values: Form.EncodedFromFields<TFields>,
): Form.FormState<TFields> => {
  const newDirtyFields = recalculateDirtySubtree(
    state.dirtyFields,
    state.initialValues,
    values,
    "",
  )
  return {
    ...state,
    values,
    dirtyFields: newDirtyFields,
  }
}

// ================================
// Array Operations
// ================================

/**
 * Appends an item to an array field.
 *
 * @since 1.0.0
 * @category Array Operations
 */
export const appendItem = <TFields extends Form.FieldsRecord>(
  state: Form.FormState<TFields>,
  arrayPath: string,
  defaultItem: unknown,
): Form.FormState<TFields> => {
  const currentArray = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
  const newItems = [...currentArray, defaultItem]
  const newValues = setNestedValue(state.values, arrayPath, newItems)
  const newDirtyFields = recalculateDirtyFieldsForArray(
    state.dirtyFields,
    state.initialValues,
    arrayPath,
    newItems,
  )
  return {
    ...state,
    values: newValues as Form.EncodedFromFields<TFields>,
    dirtyFields: newDirtyFields,
  }
}

/**
 * Removes an item from an array field at the specified index.
 *
 * @since 1.0.0
 * @category Array Operations
 */
export const removeItem = <TFields extends Form.FieldsRecord>(
  state: Form.FormState<TFields>,
  arrayPath: string,
  index: number,
): Form.FormState<TFields> => {
  const currentArray = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
  const newItems = currentArray.filter((_, i) => i !== index)
  const newValues = setNestedValue(state.values, arrayPath, newItems)
  const newDirtyFields = recalculateDirtyFieldsForArray(
    state.dirtyFields,
    state.initialValues,
    arrayPath,
    newItems,
  )
  return {
    ...state,
    values: newValues as Form.EncodedFromFields<TFields>,
    dirtyFields: newDirtyFields,
  }
}

/**
 * Swaps two items in an array field.
 *
 * @since 1.0.0
 * @category Array Operations
 */
export const swapItems = <TFields extends Form.FieldsRecord>(
  state: Form.FormState<TFields>,
  arrayPath: string,
  indexA: number,
  indexB: number,
): Form.FormState<TFields> => {
  const currentArray = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
  const newItems = [...currentArray]
  const temp = newItems[indexA]
  newItems[indexA] = newItems[indexB]
  newItems[indexB] = temp
  const newValues = setNestedValue(state.values, arrayPath, newItems)
  const newDirtyFields = recalculateDirtyFieldsForArray(
    state.dirtyFields,
    state.initialValues,
    arrayPath,
    newItems,
  )
  return {
    ...state,
    values: newValues as Form.EncodedFromFields<TFields>,
    dirtyFields: newDirtyFields,
  }
}

/**
 * Moves an item from one index to another in an array field.
 *
 * @since 1.0.0
 * @category Array Operations
 */
export const moveItem = <TFields extends Form.FieldsRecord>(
  state: Form.FormState<TFields>,
  arrayPath: string,
  fromIndex: number,
  toIndex: number,
): Form.FormState<TFields> => {
  const currentArray = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
  const newItems = [...currentArray]
  const [item] = newItems.splice(fromIndex, 1)
  newItems.splice(toIndex, 0, item)
  const newValues = setNestedValue(state.values, arrayPath, newItems)
  const newDirtyFields = recalculateDirtyFieldsForArray(
    state.dirtyFields,
    state.initialValues,
    arrayPath,
    newItems,
  )
  return {
    ...state,
    values: newValues as Form.EncodedFromFields<TFields>,
    dirtyFields: newDirtyFields,
  }
}
