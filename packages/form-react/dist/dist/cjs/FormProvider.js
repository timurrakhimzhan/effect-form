"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FormProvider = FormProvider;
exports.useFormContext = useFormContext;
var _jsxRuntime = /*#__PURE__*/require("react/jsx-runtime");
var _react = /*#__PURE__*/require("react");
const FormContext = /*#__PURE__*/(0, _react.createContext)(null);
function FormProvider({
  children,
  formAtoms
}) {
  return (0, _jsxRuntime.jsx)(FormContext.Provider, {
    value: formAtoms,
    children: children
  });
}
function useFormContext() {
  const ctx = (0, _react.useContext)(FormContext);
  if (!ctx) {
    throw new Error("useFormContext must be used within FormProvider");
  }
  return ctx;
}
//# sourceMappingURL=FormProvider.js.map