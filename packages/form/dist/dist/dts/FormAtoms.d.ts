import * as Atom from "@effect-atom/atom/Atom";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as ParseResult from "effect/ParseResult";
import * as Schema from "effect/Schema";
import * as Field from "./Field.js";
import * as FormBuilder from "./FormBuilder.js";
import { type WeakRegistry } from "./internal/weak-registry.js";
import * as Mode from "./Mode.js";
import * as Validation from "./Validation.js";
export interface FieldAtoms {
    readonly valueAtom: Atom.Writable<unknown, unknown>;
    readonly initialValueAtom: Atom.Atom<unknown>;
    readonly touchedAtom: Atom.Writable<boolean, boolean>;
    readonly errorAtom: Atom.Atom<Option.Option<Validation.ErrorEntry>>;
    readonly visibleErrorAtom: Atom.Atom<Option.Option<string>>;
    readonly isValidatingAtom: Atom.Atom<boolean>;
    readonly triggerValidationAtom: Atom.AtomResultFn<unknown, void, ParseResult.ParseError>;
    readonly onChangeAtom: Atom.Writable<void, unknown>;
    readonly onBlurAtom: Atom.Writable<void, void>;
}
/**
 * Public interface for accessing all atoms related to a field.
 * Use this when you need to subscribe to or interact with field state
 * outside of the generated field components.
 */
export interface PublicFieldAtoms<S> {
    /** The current value of the field (None if form not initialized) */
    readonly value: Atom.Atom<Option.Option<S>>;
    /** The initial value the field was initialized with */
    readonly initialValue: Atom.Atom<Option.Option<S>>;
    /** The visible error message (respects validation mode) */
    readonly error: Atom.Atom<Option.Option<string>>;
    /** Whether the field has been touched (blurred) */
    readonly isTouched: Atom.Atom<boolean>;
    /** Whether the field value differs from initial value */
    readonly isDirty: Atom.Atom<boolean>;
    /** Whether async validation is in progress */
    readonly isValidating: Atom.Atom<boolean>;
    /** Programmatically set the field value */
    readonly setValue: Atom.Writable<void, S | ((prev: S) => S)>;
    /** Trigger onChange handler (sets value + triggers validation based on mode) */
    readonly onChange: Atom.Writable<void, S>;
    /** Trigger onBlur handler (sets touched + triggers validation if mode is onBlur) */
    readonly onBlur: Atom.Writable<void, void>;
    /** The field's path/key */
    readonly key: string;
}
export interface FormAtomsConfig<TFields extends Field.FieldsRecord, R, A, E, SubmitArgs = void> {
    readonly runtime: Atom.AtomRuntime<R, any>;
    readonly formBuilder: FormBuilder.FormBuilder<TFields, R>;
    readonly onSubmit: (args: SubmitArgs, ctx: {
        readonly decoded: Field.DecodedFromFields<TFields>;
        readonly encoded: Field.EncodedFromFields<TFields>;
        readonly get: Atom.FnContext;
    }) => A | Effect.Effect<A, E, R>;
    readonly mode?: Mode.FormMode;
    readonly validationDebounceMs?: number;
}
export type FieldRefs<TFields extends Field.FieldsRecord> = {
    readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S> ? FormBuilder.FieldRef<Schema.Schema.Encoded<S>> : TFields[K] extends Field.ArrayFieldDef<any, infer S> ? FormBuilder.FieldRef<ReadonlyArray<Schema.Schema.Encoded<S>>> : never;
};
export interface FormAtoms<TFields extends Field.FieldsRecord, R, A = void, E = never, SubmitArgs = void> {
    readonly stateAtom: Atom.Writable<Option.Option<FormBuilder.FormState<TFields>>, Option.Option<FormBuilder.FormState<TFields>>>;
    readonly errorsAtom: Atom.Writable<Map<string, Validation.ErrorEntry>, Map<string, Validation.ErrorEntry>>;
    readonly rootErrorAtom: Atom.Atom<Option.Option<string>>;
    readonly valuesAtom: Atom.Atom<Option.Option<Field.EncodedFromFields<TFields>>>;
    readonly dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>;
    readonly isDirtyAtom: Atom.Atom<boolean>;
    readonly submitCountAtom: Atom.Atom<number>;
    readonly lastSubmittedValuesAtom: Atom.Atom<Option.Option<FormBuilder.SubmittedValues<TFields>>>;
    readonly changedSinceSubmitFieldsAtom: Atom.Atom<ReadonlySet<string>>;
    readonly hasChangedSinceSubmitAtom: Atom.Atom<boolean>;
    readonly submitAtom: Atom.AtomResultFn<SubmitArgs, A, E | ParseResult.ParseError>;
    readonly combinedSchema: Schema.Schema<Field.DecodedFromFields<TFields>, Field.EncodedFromFields<TFields>, R>;
    readonly fieldRefs: FieldRefs<TFields>;
    readonly validationAtomsRegistry: WeakRegistry<Atom.AtomResultFn<unknown, void, ParseResult.ParseError>>;
    readonly fieldAtomsRegistry: WeakRegistry<FieldAtoms>;
    readonly getOrCreateValidationAtom: (fieldPath: string, schema: Schema.Schema.Any) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>;
    readonly getOrCreateFieldAtoms: (fieldPath: string) => FieldAtoms;
    readonly resetValidationAtoms: (ctx: {
        set: <R, W>(atom: Atom.Writable<R, W>, value: W) => void;
    }) => void;
    readonly operations: FormOperations<TFields>;
    readonly resetAtom: Atom.Writable<void, void>;
    readonly revertToLastSubmitAtom: Atom.Writable<void, void>;
    readonly setValuesAtom: Atom.Writable<void, Field.EncodedFromFields<TFields>>;
    readonly setValue: <S>(field: FormBuilder.FieldRef<S>) => Atom.Writable<void, S | ((prev: S) => S)>;
    readonly getFieldAtom: <S>(field: FormBuilder.FieldRef<S>) => Atom.Atom<Option.Option<S>>;
    /**
     * Get all atoms for a field, allowing you to subscribe to or interact with
     * any aspect of the field state outside of the generated field components.
     *
     * @example
     * ```tsx
     * const emailField = form.getField(form.fields.email)
     *
     * // Subscribe to individual atoms
     * const error = useAtomValue(emailField.error)
     * const isDirty = useAtomValue(emailField.isDirty)
     *
     * // Programmatically update
     * const setEmail = useAtomSet(emailField.setValue)
     * setEmail("new@email.com")
     * ```
     */
    readonly getField: <S>(field: FormBuilder.FieldRef<S>) => PublicFieldAtoms<S>;
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
    readonly mountAtom: Atom.Atom<void>;
    readonly keepAliveActiveAtom: Atom.Writable<boolean, boolean>;
    /**
     * Initialize the form with default values.
     * Safe to call multiple times - will only initialize if not already initialized
     * (unless keepAliveActive is false, in which case it will reinitialize).
     */
    readonly initializeAtom: Atom.Writable<void, Field.EncodedFromFields<TFields>>;
    /**
     * The parsed mode configuration for this form.
     */
    readonly parsedMode: Mode.ParsedMode;
    /**
     * Trigger auto-submit for onBlur mode.
     * Call this atom on field blur to trigger auto-submit.
     */
    readonly triggerAutoSubmitOnBlurAtom: Atom.Writable<void, void>;
    /**
     * Trigger auto-submit for onChange mode.
     * Call this on every state change - it handles value tracking internally.
     */
    readonly triggerAutoSubmitOnChangeAtom: Atom.Writable<void, void>;
    /**
     * Flush pending auto-submit when submit completes.
     * Pass the previous wasSubmitting state to detect transitions.
     */
    readonly flushAutoSubmitPendingAtom: Atom.Writable<void, boolean>;
    /**
     * Flag indicating auto-submit is ready to fire.
     * React should subscribe to this and call submitAtom when it becomes true.
     */
    readonly autoSubmitReadyAtom: Atom.Writable<boolean, boolean>;
    /**
     * Counter tracking unique auto-submit requests.
     * React uses this to detect when a new auto-submit should happen.
     */
    readonly autoSubmitRequestIdAtom: Atom.Atom<number>;
    readonly isAutoSubmitDebouncingAtom: Atom.Atom<boolean>;
}
export interface FormOperations<TFields extends Field.FieldsRecord> {
    readonly createInitialState: (defaultValues: Field.EncodedFromFields<TFields>) => FormBuilder.FormState<TFields>;
    readonly createResetState: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>;
    readonly createSubmitState: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>;
    readonly setFieldValue: (state: FormBuilder.FormState<TFields>, fieldPath: string, value: unknown) => FormBuilder.FormState<TFields>;
    readonly setFormValues: (state: FormBuilder.FormState<TFields>, values: Field.EncodedFromFields<TFields>) => FormBuilder.FormState<TFields>;
    readonly setFieldTouched: (state: FormBuilder.FormState<TFields>, fieldPath: string, touched: boolean) => FormBuilder.FormState<TFields>;
    readonly appendArrayItem: (state: FormBuilder.FormState<TFields>, arrayPath: string, itemSchema: Schema.Schema.Any, value?: unknown) => FormBuilder.FormState<TFields>;
    readonly removeArrayItem: (state: FormBuilder.FormState<TFields>, arrayPath: string, index: number) => FormBuilder.FormState<TFields>;
    readonly swapArrayItems: (state: FormBuilder.FormState<TFields>, arrayPath: string, indexA: number, indexB: number) => FormBuilder.FormState<TFields>;
    readonly moveArrayItem: (state: FormBuilder.FormState<TFields>, arrayPath: string, fromIndex: number, toIndex: number) => FormBuilder.FormState<TFields>;
    readonly revertToLastSubmit: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>;
}
export declare const make: <TFields extends Field.FieldsRecord, R, A, E, SubmitArgs = void>(config: FormAtomsConfig<TFields, R, A, E, SubmitArgs>) => FormAtoms<TFields, R, A, E, SubmitArgs>;
//# sourceMappingURL=FormAtoms.d.ts.map