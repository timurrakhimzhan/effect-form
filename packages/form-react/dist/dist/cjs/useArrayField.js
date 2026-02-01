"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useArrayField = useArrayField;
var _atomReact = /*#__PURE__*/require("@effect-atom/atom-react");
var Option = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/Option"));
var _react = /*#__PURE__*/require("react");
function _interopRequireWildcard(e, t) {
  if ("function" == typeof WeakMap) var r = new WeakMap(),
    n = new WeakMap();
  return (_interopRequireWildcard = function (e, t) {
    if (!t && e && e.__esModule) return e;
    var o,
      i,
      f = {
        __proto__: null,
        default: e
      };
    if (null === e || "object" != typeof e && "function" != typeof e) return f;
    if (o = t ? n : r) {
      if (o.has(e)) return o.get(e);
      o.set(e, f);
    }
    for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);
    return f;
  })(e, t);
}
function useArrayField(formAtoms, fieldRef, itemSchema) {
  const itemsOption = (0, _atomReact.useAtomValue)(formAtoms.getFieldAtom(fieldRef));
  const items = (0, _react.useMemo)(() => Option.getOrElse(itemsOption, () => []), [itemsOption]);
  const setStateAtom = (0, _atomReact.useAtomSet)(formAtoms.stateAtom);
  const append = (0, _react.useCallback)(value => {
    setStateAtom(prev => {
      if (Option.isNone(prev)) return prev;
      return Option.some(formAtoms.operations.appendArrayItem(prev.value, fieldRef.key, itemSchema, value));
    });
  }, [setStateAtom, fieldRef.key, itemSchema, formAtoms.operations]);
  const remove = (0, _react.useCallback)(index => {
    setStateAtom(prev => {
      if (Option.isNone(prev)) return prev;
      return Option.some(formAtoms.operations.removeArrayItem(prev.value, fieldRef.key, index));
    });
  }, [setStateAtom, fieldRef.key, formAtoms.operations]);
  const swap = (0, _react.useCallback)((indexA, indexB) => {
    setStateAtom(prev => {
      if (Option.isNone(prev)) return prev;
      return Option.some(formAtoms.operations.swapArrayItems(prev.value, fieldRef.key, indexA, indexB));
    });
  }, [setStateAtom, fieldRef.key, formAtoms.operations]);
  const move = (0, _react.useCallback)((fromIndex, toIndex) => {
    setStateAtom(prev => {
      if (Option.isNone(prev)) return prev;
      return Option.some(formAtoms.operations.moveArrayItem(prev.value, fieldRef.key, fromIndex, toIndex));
    });
  }, [setStateAtom, fieldRef.key, formAtoms.operations]);
  return (0, _react.useMemo)(() => ({
    items,
    append,
    remove,
    swap,
    move
  }), [items, append, remove, swap, move]);
}
//# sourceMappingURL=useArrayField.js.map