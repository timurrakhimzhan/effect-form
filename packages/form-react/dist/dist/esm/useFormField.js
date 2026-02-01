import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { isPathOrParentDirty } from "@lucas-barake/effect-form/Path";
import { useCallback, useMemo } from "react";
export function useFormField(formAtoms, fieldRef) {
  const fieldAtoms = useMemo(() => formAtoms.getOrCreateFieldAtoms(fieldRef.key), [formAtoms, fieldRef.key]);
  // Read from atoms - all logic is in FormAtoms
  const value = useAtomValue(fieldAtoms.valueAtom);
  const isTouched = useAtomValue(fieldAtoms.touchedAtom);
  const visibleError = useAtomValue(fieldAtoms.visibleErrorAtom);
  const isValidating = useAtomValue(fieldAtoms.isValidatingAtom);
  const dirtyFields = useAtomValue(formAtoms.dirtyFieldsAtom);
  // Write to atoms - handlers just call atom setters
  const setOnChange = useAtomSet(fieldAtoms.onChangeAtom);
  const setOnBlur = useAtomSet(fieldAtoms.onBlurAtom);
  const handleChange = useCallback(newValue => {
    setOnChange(newValue);
  }, [setOnChange]);
  const handleBlur = useCallback(() => {
    setOnBlur();
  }, [setOnBlur]);
  const isDirty = useMemo(() => isPathOrParentDirty(dirtyFields, fieldRef.key), [dirtyFields, fieldRef.key]);
  return useMemo(() => ({
    value,
    onChange: handleChange,
    onBlur: handleBlur,
    error: visibleError,
    isTouched,
    isDirty,
    isValidating
  }), [value, handleChange, handleBlur, visibleError, isTouched, isDirty, isValidating]);
}
//# sourceMappingURL=useFormField.js.map