import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from "react";
const FormContext = /*#__PURE__*/createContext(null);
export function FormProvider({
  children,
  formAtoms
}) {
  return _jsx(FormContext.Provider, {
    value: formAtoms,
    children: children
  });
}
export function useFormContext() {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useFormContext must be used within FormProvider");
  }
  return ctx;
}
//# sourceMappingURL=FormProvider.js.map