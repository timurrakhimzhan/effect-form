import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import * as Option from "effect/Option";
import { useCallback, useMemo } from "react";
export function useArrayField(formAtoms, fieldRef, itemSchema) {
  const itemsOption = useAtomValue(formAtoms.getFieldAtom(fieldRef));
  const items = useMemo(() => Option.getOrElse(itemsOption, () => []), [itemsOption]);
  const setStateAtom = useAtomSet(formAtoms.stateAtom);
  const append = useCallback(value => {
    setStateAtom(prev => {
      if (Option.isNone(prev)) return prev;
      return Option.some(formAtoms.operations.appendArrayItem(prev.value, fieldRef.key, itemSchema, value));
    });
  }, [setStateAtom, fieldRef.key, itemSchema, formAtoms.operations]);
  const remove = useCallback(index => {
    setStateAtom(prev => {
      if (Option.isNone(prev)) return prev;
      return Option.some(formAtoms.operations.removeArrayItem(prev.value, fieldRef.key, index));
    });
  }, [setStateAtom, fieldRef.key, formAtoms.operations]);
  const swap = useCallback((indexA, indexB) => {
    setStateAtom(prev => {
      if (Option.isNone(prev)) return prev;
      return Option.some(formAtoms.operations.swapArrayItems(prev.value, fieldRef.key, indexA, indexB));
    });
  }, [setStateAtom, fieldRef.key, formAtoms.operations]);
  const move = useCallback((fromIndex, toIndex) => {
    setStateAtom(prev => {
      if (Option.isNone(prev)) return prev;
      return Option.some(formAtoms.operations.moveArrayItem(prev.value, fieldRef.key, fromIndex, toIndex));
    });
  }, [setStateAtom, fieldRef.key, formAtoms.operations]);
  return useMemo(() => ({
    items,
    append,
    remove,
    swap,
    move
  }), [items, append, remove, swap, move]);
}
//# sourceMappingURL=useArrayField.js.map