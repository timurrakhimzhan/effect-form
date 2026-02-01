"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useFormField = useFormField;
var _atomReact = /*#__PURE__*/require("@effect-atom/atom-react");
var _Path = /*#__PURE__*/require("@lucas-barake/effect-form/Path");
var _react = /*#__PURE__*/require("react");
function useFormField(formAtoms, fieldRef) {
  const fieldAtoms = (0, _react.useMemo)(() => formAtoms.getOrCreateFieldAtoms(fieldRef.key), [formAtoms, fieldRef.key]);
  // Read from atoms - all logic is in FormAtoms
  const value = (0, _atomReact.useAtomValue)(fieldAtoms.valueAtom);
  const isTouched = (0, _atomReact.useAtomValue)(fieldAtoms.touchedAtom);
  const visibleError = (0, _atomReact.useAtomValue)(fieldAtoms.visibleErrorAtom);
  const isValidating = (0, _atomReact.useAtomValue)(fieldAtoms.isValidatingAtom);
  const dirtyFields = (0, _atomReact.useAtomValue)(formAtoms.dirtyFieldsAtom);
  // Write to atoms - handlers just call atom setters
  const setOnChange = (0, _atomReact.useAtomSet)(fieldAtoms.onChangeAtom);
  const setOnBlur = (0, _atomReact.useAtomSet)(fieldAtoms.onBlurAtom);
  const handleChange = (0, _react.useCallback)(newValue => {
    setOnChange(newValue);
  }, [setOnChange]);
  const handleBlur = (0, _react.useCallback)(() => {
    setOnBlur();
  }, [setOnBlur]);
  const isDirty = (0, _react.useMemo)(() => (0, _Path.isPathOrParentDirty)(dirtyFields, fieldRef.key), [dirtyFields, fieldRef.key]);
  return (0, _react.useMemo)(() => ({
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