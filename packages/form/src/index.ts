
export * as Field from "./Field.js"

/**
   * Root anchor atom for the form's dependency graph.
   * Mount this atom to keep all form state alive even when field components unmount.
   *
   * Useful for:
   * - Multi-step wizards where steps unmount but state should persist
   * - Conditional fields (toggles) where state should survive visibility changes
   *
   * @example
   * ```tsx
   * // Keep form state alive at wizard root level
   * function Wizard() {
   *   useAtomMount(step1Form.mount)
   *   useAtomMount(step2Form.mount)
   *   return currentStep === 1 ? <Step1 /> : <Step2 />
   * }
   * ```
   */
export * as FormAtoms from "./FormAtoms.js"


export * as FormBuilder from "./FormBuilder.js"


export * as Mode from "./Mode.js"


export * as Path from "./Path.js"


export * as Validation from "./Validation.js"
