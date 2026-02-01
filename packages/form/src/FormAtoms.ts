import * as Atom from "@effect-atom/atom/Atom"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import * as Field from "./Field.js"
import * as FormBuilder from "./FormBuilder.js"
import { recalculateDirtyFieldsForArray, recalculateDirtySubtree } from "./internal/dirty.js"
import { createWeakRegistry, type WeakRegistry } from "./internal/weak-registry.js"
import * as Mode from "./Mode.js"
import { getNestedValue, isPathOrParentDirty, setNestedValue } from "./Path.js"
import * as Validation from "./Validation.js"

export interface FieldAtoms {
  readonly valueAtom: Atom.Writable<unknown, unknown>
  readonly initialValueAtom: Atom.Atom<unknown>
  readonly touchedAtom: Atom.Writable<boolean, boolean>
  readonly errorAtom: Atom.Atom<Option.Option<Validation.ErrorEntry>>
  readonly visibleErrorAtom: Atom.Atom<Option.Option<string>>
  readonly isValidatingAtom: Atom.Atom<boolean>
  readonly triggerValidationAtom: Atom.AtomResultFn<unknown, void, ParseResult.ParseError>
  readonly onChangeAtom: Atom.Writable<void, unknown>
  readonly onBlurAtom: Atom.Writable<void, void>
}

/**
 * Public interface for accessing all atoms related to a field.
 * Use this when you need to subscribe to or interact with field state
 * outside of the generated field components.
 */
export interface PublicFieldAtoms<S> {
  /** The current value of the field (None if form not initialized) */
  readonly value: Atom.Atom<Option.Option<S>>
  /** The initial value the field was initialized with */
  readonly initialValue: Atom.Atom<Option.Option<S>>
  /** The visible error message (respects validation mode) */
  readonly error: Atom.Atom<Option.Option<string>>
  /** Whether the field has been touched (blurred) */
  readonly isTouched: Atom.Atom<boolean>
  /** Whether the field value differs from initial value */
  readonly isDirty: Atom.Atom<boolean>
  /** Whether async validation is in progress */
  readonly isValidating: Atom.Atom<boolean>
  /** Programmatically set the field value */
  readonly setValue: Atom.Writable<void, S | ((prev: S) => S)>
  /** Trigger onChange handler (sets value + triggers validation based on mode) */
  readonly onChange: Atom.Writable<void, S>
  /** Trigger onBlur handler (sets touched + triggers validation if mode is onBlur) */
  readonly onBlur: Atom.Writable<void, void>
  /** The field's path/key */
  readonly key: string
}

export interface FormAtomsConfig<TFields extends Field.FieldsRecord, R, A, E, SubmitArgs = void> {
  readonly runtime: Atom.AtomRuntime<R, any>
  readonly formBuilder: FormBuilder.FormBuilder<TFields, R>
  readonly onSubmit: (
    args: SubmitArgs,
    ctx: {
      readonly decoded: Field.DecodedFromFields<TFields>
      readonly encoded: Field.EncodedFromFields<TFields>
      readonly get: Atom.FnContext
    },
  ) => A | Effect.Effect<A, E, R>
  readonly mode?: Mode.FormMode
  readonly validationDebounceMs?: number
}

export type FieldRefs<TFields extends Field.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S> ?
    FormBuilder.FieldRef<Schema.Schema.Encoded<S>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S> ?
      FormBuilder.FieldRef<ReadonlyArray<Schema.Schema.Encoded<S>>>
    : never
}

export interface FormAtoms<TFields extends Field.FieldsRecord, R, A = void, E = never, SubmitArgs = void> {
  readonly stateAtom: Atom.Writable<
    Option.Option<FormBuilder.FormState<TFields>>,
    Option.Option<FormBuilder.FormState<TFields>>
  >
  readonly errorsAtom: Atom.Writable<Map<string, Validation.ErrorEntry>, Map<string, Validation.ErrorEntry>>
  readonly rootErrorAtom: Atom.Atom<Option.Option<string>>
  readonly valuesAtom: Atom.Atom<Option.Option<Field.EncodedFromFields<TFields>>>
  readonly dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>
  readonly isDirtyAtom: Atom.Atom<boolean>
  readonly submitCountAtom: Atom.Atom<number>
  readonly lastSubmittedValuesAtom: Atom.Atom<Option.Option<FormBuilder.SubmittedValues<TFields>>>
  readonly changedSinceSubmitFieldsAtom: Atom.Atom<ReadonlySet<string>>
  readonly hasChangedSinceSubmitAtom: Atom.Atom<boolean>

  readonly submitAtom: Atom.AtomResultFn<SubmitArgs, A, E | ParseResult.ParseError>

  readonly combinedSchema: Schema.Schema<Field.DecodedFromFields<TFields>, Field.EncodedFromFields<TFields>, R>

  readonly fieldRefs: FieldRefs<TFields>

  readonly validationAtomsRegistry: WeakRegistry<Atom.AtomResultFn<unknown, void, ParseResult.ParseError>>
  readonly fieldAtomsRegistry: WeakRegistry<FieldAtoms>

  readonly getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>

  readonly getOrCreateFieldAtoms: (fieldPath: string) => FieldAtoms

  readonly resetValidationAtoms: (ctx: { set: <R, W>(atom: Atom.Writable<R, W>, value: W) => void }) => void

  readonly operations: FormOperations<TFields>

  readonly resetAtom: Atom.Writable<void, void>
  readonly revertToLastSubmitAtom: Atom.Writable<void, void>
  readonly setValuesAtom: Atom.Writable<void, Field.EncodedFromFields<TFields>>
  readonly setValue: <S>(field: FormBuilder.FieldRef<S>) => Atom.Writable<void, S | ((prev: S) => S)>

  readonly getFieldAtom: <S>(field: FormBuilder.FieldRef<S>) => Atom.Atom<Option.Option<S>>

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
  readonly getField: <S>(field: FormBuilder.FieldRef<S>) => PublicFieldAtoms<S>

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
  readonly mountAtom: Atom.Atom<void>

  readonly keepAliveActiveAtom: Atom.Writable<boolean, boolean>

  /**
   * Initialize the form with default values.
   * Safe to call multiple times - will only initialize if not already initialized
   * (unless keepAliveActive is false, in which case it will reinitialize).
   */
  readonly initializeAtom: Atom.Writable<void, Field.EncodedFromFields<TFields>>

  /**
   * The parsed mode configuration for this form.
   */
  readonly parsedMode: Mode.ParsedMode

  /**
   * Trigger auto-submit for onBlur mode.
   * Call this atom on field blur to trigger auto-submit.
   */
  readonly triggerAutoSubmitOnBlurAtom: Atom.Writable<void, void>

  /**
   * Trigger auto-submit for onChange mode.
   * Call this on every state change - it handles value tracking internally.
   */
  readonly triggerAutoSubmitOnChangeAtom: Atom.Writable<void, void>

  /**
   * Flush pending auto-submit when submit completes.
   * Pass the previous wasSubmitting state to detect transitions.
   */
  readonly flushAutoSubmitPendingAtom: Atom.Writable<void, boolean>

  /**
   * Flag indicating auto-submit is ready to fire.
   * React should subscribe to this and call submitAtom when it becomes true.
   */
  readonly autoSubmitReadyAtom: Atom.Writable<boolean, boolean>

  /**
   * Counter tracking unique auto-submit requests.
   * React uses this to detect when a new auto-submit should happen.
   */
  readonly autoSubmitRequestIdAtom: Atom.Atom<number>
  readonly isAutoSubmitDebouncingAtom: Atom.Atom<boolean>
}

export interface FormOperations<TFields extends Field.FieldsRecord> {
  readonly createInitialState: (defaultValues: Field.EncodedFromFields<TFields>) => FormBuilder.FormState<TFields>

  readonly createResetState: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>

  readonly createSubmitState: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>

  readonly setFieldValue: (
    state: FormBuilder.FormState<TFields>,
    fieldPath: string,
    value: unknown,
  ) => FormBuilder.FormState<TFields>

  readonly setFormValues: (
    state: FormBuilder.FormState<TFields>,
    values: Field.EncodedFromFields<TFields>,
  ) => FormBuilder.FormState<TFields>

  readonly setFieldTouched: (
    state: FormBuilder.FormState<TFields>,
    fieldPath: string,
    touched: boolean,
  ) => FormBuilder.FormState<TFields>

  readonly appendArrayItem: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    itemSchema: Schema.Schema.Any,
    value?: unknown,
  ) => FormBuilder.FormState<TFields>

  readonly removeArrayItem: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    index: number,
  ) => FormBuilder.FormState<TFields>

  readonly swapArrayItems: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    indexA: number,
    indexB: number,
  ) => FormBuilder.FormState<TFields>

  readonly moveArrayItem: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    fromIndex: number,
    toIndex: number,
  ) => FormBuilder.FormState<TFields>

  readonly revertToLastSubmit: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>
}

export const make = <TFields extends Field.FieldsRecord, R, A, E, SubmitArgs = void>(
  config: FormAtomsConfig<TFields, R, A, E, SubmitArgs>,
): FormAtoms<TFields, R, A, E, SubmitArgs> => {
  const { formBuilder, runtime } = config
  const { fields } = formBuilder
  const parsedMode = Mode.parse(config.mode)
  const debounceMs = config.validationDebounceMs ?? parsedMode.debounce ?? 0

  const combinedSchema = FormBuilder.buildSchema(formBuilder)

  const stateAtom = Atom.make(Option.none<FormBuilder.FormState<TFields>>()).pipe(Atom.setIdleTTL(0))
  const errorsAtom = Atom.make<Map<string, Validation.ErrorEntry>>(new Map()).pipe(Atom.setIdleTTL(0))

  const rootErrorAtom = Atom.readable((get) => {
    const errors = get(errorsAtom)
    const entry = errors.get("")
    return entry ? Option.some(entry.message) : Option.none<string>()
  }).pipe(Atom.setIdleTTL(0))

  const valuesAtom = Atom.readable((get) => Option.map(get(stateAtom), (state) => state.values)).pipe(
    Atom.setIdleTTL(0),
  )

  const dirtyFieldsAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => new Set<string>(),
      onSome: (state) => state.dirtyFields,
    })
  ).pipe(Atom.setIdleTTL(0))

  const isDirtyAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => false,
      onSome: (state) => state.dirtyFields.size > 0,
    })
  ).pipe(Atom.setIdleTTL(0))

  const submitCountAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => 0,
      onSome: (state) => state.submitCount,
    })
  ).pipe(Atom.setIdleTTL(0))

  const lastSubmittedValuesAtom = Atom.readable((get) =>
    Option.flatMap(get(stateAtom), (state) => state.lastSubmittedValues)
  ).pipe(Atom.setIdleTTL(0))

  const changedSinceSubmitFieldsAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => new Set<string>(),
      onSome: (state) =>
        Option.match(state.lastSubmittedValues, {
          onNone: () => new Set<string>(),
          onSome: (lastSubmitted) => recalculateDirtySubtree(new Set(), lastSubmitted.encoded, state.values, ""),
        }),
    })
  ).pipe(Atom.setIdleTTL(0))

  const hasChangedSinceSubmitAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => false,
      onSome: (state) => {
        if (Option.isNone(state.lastSubmittedValues)) return false
        if (state.values === state.lastSubmittedValues.value.encoded) return false
        return get(changedSinceSubmitFieldsAtom).size > 0
      },
    })
  ).pipe(Atom.setIdleTTL(0))

  const validationAtomsRegistry = createWeakRegistry<Atom.AtomResultFn<unknown, void, ParseResult.ParseError>>()
  const fieldAtomsRegistry = createWeakRegistry<FieldAtoms>()
  const publicFieldAtomRegistry = createWeakRegistry<Atom.Atom<Option.Option<unknown>>>()

  const getOrCreateValidationAtom = (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ): Atom.AtomResultFn<unknown, void, ParseResult.ParseError> => {
    const existing = validationAtomsRegistry.get(fieldPath)
    if (existing) return existing

    const validationAtom = runtime.fn<unknown>()((value: unknown) =>
      pipe(
        Schema.decodeUnknown(schema)(value) as Effect.Effect<unknown, ParseResult.ParseError, R>,
        Effect.asVoid,
      )
    ).pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<unknown, void, ParseResult.ParseError>

    validationAtomsRegistry.set(fieldPath, validationAtom)
    return validationAtom
  }

  const getFieldSchema = (fieldPath: string): Schema.Schema.Any | undefined => {
    const parts = fieldPath.split(".")
    const rootFieldName = parts[0].replace(/\[\d+\]$/, "")
    const fieldDef = fields[rootFieldName]
    if (!fieldDef) return undefined

    if (Field.isFieldDef(fieldDef)) {
      return fieldDef.schema
    }

    if (Field.isArrayFieldDef(fieldDef)) {
      return fieldDef.itemSchema
    }

    return undefined
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-Submit atoms (defined before getOrCreateFieldAtoms so they're in scope)
  // ─────────────────────────────────────────────────────────────────────────────
  // Track pending changes while a submit is in progress
  const autoSubmitPendingAtom = Atom.make(false).pipe(Atom.setIdleTTL(0))

  // Flag set when debounced auto-submit should trigger
  const autoSubmitReadyAtom = Atom.make(false).pipe(Atom.setIdleTTL(0))
  // Counter to track unique auto-submit requests (for React to detect changes)
  const autoSubmitRequestIdAtom = Atom.make(0).pipe(Atom.setIdleTTL(0))

  // Debounced auto-submit - sets the ready flag after debounce
  // Uses number parameter to ensure each call creates a new fiber (like triggerValidationAtom)
  const debouncedAutoSubmitAtom = runtime.fn<number>()((_requestId: number, get) =>
    Effect.gen(function*() {
      if (debounceMs > 0) {
        yield* Effect.sleep(Duration.millis(debounceMs))
      }
      yield* Effect.sync(() => {
        get.set(autoSubmitReadyAtom, true)
        get.set(autoSubmitRequestIdAtom, get(autoSubmitRequestIdAtom) + 1)
      })
    })
  ).pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<number, void, never>

  // Counter for auto-submit requests
  let autoSubmitCounter = 0

  // Atom to keep debouncedAutoSubmitAtom alive by subscribing to it
  const isAutoSubmitDebouncing = Atom.readable((get) => {
    const result = get(debouncedAutoSubmitAtom)
    return result.waiting
  }).pipe(Atom.setIdleTTL(0))

  const getOrCreateFieldAtoms = (fieldPath: string): FieldAtoms => {
    const existing = fieldAtomsRegistry.get(fieldPath)
    if (existing) return existing

    const fieldSchema = getFieldSchema(fieldPath)

    const valueAtom = Atom.writable(
      (get) => getNestedValue(Option.getOrThrow(get(stateAtom)).values, fieldPath),
      (ctx, value) => {
        const currentState = Option.getOrThrow(ctx.get(stateAtom))
        ctx.set(stateAtom, Option.some(operations.setFieldValue(currentState, fieldPath, value)))
      },
    ).pipe(Atom.setIdleTTL(0))

    const initialValueAtom = Atom.readable(
      (get) => getNestedValue(Option.getOrThrow(get(stateAtom)).initialValues, fieldPath),
    ).pipe(Atom.setIdleTTL(0))

    const touchedAtom = Atom.writable(
      (get) => (getNestedValue(Option.getOrThrow(get(stateAtom)).touched, fieldPath) ?? false) as boolean,
      (ctx, value) => {
        const currentState = Option.getOrThrow(ctx.get(stateAtom))
        ctx.set(
          stateAtom,
          Option.some({
            ...currentState,
            touched: setNestedValue(currentState.touched, fieldPath, value),
          }),
        )
      },
    ).pipe(Atom.setIdleTTL(0))

    const errorAtom = Atom.readable((get) => {
      const errors = get(errorsAtom)
      const entry = errors.get(fieldPath)
      return entry ? Option.some(entry) : Option.none<Validation.ErrorEntry>()
    }).pipe(Atom.setIdleTTL(0))

    // Debounced validation that writes results to errorsAtom
    const triggerValidationAtom = fieldSchema
      ? runtime.fn<unknown>()((value: unknown, get) =>
        Effect.gen(function*() {
          // Debounce
          if (debounceMs > 0) {
            yield* Effect.sleep(Duration.millis(debounceMs))
          }

          yield* pipe(
            Schema.decodeUnknown(fieldSchema)(value) as Effect.Effect<unknown, ParseResult.ParseError, R>,
            Effect.tap(() =>
              Effect.sync(() => {
                // Clear field-sourced error on success (keep refinement errors until re-submit)
                const currentErrors = get(errorsAtom)
                const existingError = currentErrors.get(fieldPath)
                if (existingError && existingError.source === "field") {
                  const newErrors = new Map(currentErrors)
                  newErrors.delete(fieldPath)
                  get.set(errorsAtom, newErrors)
                }
              })
            ),
            Effect.tapError((parseError) =>
              Effect.sync(() => {
                // Extract first error and set for this field
                const errorMessage = Validation.extractFirstError(parseError)
                if (Option.isSome(errorMessage)) {
                  const currentErrors = get(errorsAtom)
                  const newErrors = new Map(currentErrors)
                  newErrors.set(fieldPath, { message: errorMessage.value, source: "field" as const })
                  get.set(errorsAtom, newErrors)
                }
              })
            ),
            Effect.asVoid,
          )
        })
      ).pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<unknown, void, ParseResult.ParseError>
      : runtime.fn<unknown>()(() => Effect.void).pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<
        unknown,
        void,
        ParseResult.ParseError
      >

    const isValidatingAtom = Atom.readable((get) => {
      const result = get(triggerValidationAtom)
      return result.waiting
    }).pipe(Atom.setIdleTTL(0))

    // Computed visible error based on mode, touched, dirty, submitCount
    const visibleErrorAtom = Atom.readable((get) => {
      const error = get(errorAtom)
      if (Option.isNone(error)) return Option.none<string>()

      const touched = get(touchedAtom)
      const submitCount = get(submitCountAtom)
      const dirtyFields = get(dirtyFieldsAtom)
      const isDirty = isPathOrParentDirty(dirtyFields, fieldPath)

      const shouldShow = parsedMode.validation === "onSubmit"
        ? submitCount > 0
        : parsedMode.validation === "onBlur"
        ? (touched || submitCount > 0)
        : (isDirty || submitCount > 0)

      if (!shouldShow) return Option.none<string>()

      return Option.some(error.value.message)
    }).pipe(Atom.setIdleTTL(0))

    // onChange handler: sets value, triggers validation, and triggers auto-submit based on mode
    const onChangeAtom = Atom.fnSync<unknown>()((value: unknown, get) => {
      // Set value
      const currentState = Option.getOrThrow(get(stateAtom))
      const newState = operations.setFieldValue(currentState, fieldPath, value)
      get.set(stateAtom, Option.some(newState))

      // Trigger validation based on mode
      const touched = get(touchedAtom)
      const submitCount = get(submitCountAtom)
      const shouldValidate = parsedMode.validation === "onChange" ||
        (parsedMode.validation === "onBlur" && touched) ||
        (parsedMode.validation === "onSubmit" && submitCount > 0)

      if (shouldValidate) {
        get.set(triggerValidationAtom, value)
      }

      // Trigger auto-submit for onChange mode (debounced)
      if (parsedMode.autoSubmit && parsedMode.validation === "onChange") {
        const submitResult = get(submitAtom)
        if (submitResult.waiting) {
          get.set(autoSubmitPendingAtom, true)
        } else {
          autoSubmitCounter++
          get.set(debouncedAutoSubmitAtom, autoSubmitCounter)
        }
      }
    }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

    // onBlur handler: sets touched and triggers validation if mode is onBlur
    const onBlurAtom = Atom.fnSync<void>()((_: void, get) => {
      // Set touched
      const currentState = Option.getOrThrow(get(stateAtom))
      get.set(
        stateAtom,
        Option.some({
          ...currentState,
          touched: setNestedValue(currentState.touched, fieldPath, true),
        } as FormBuilder.FormState<TFields>),
      )

      // Trigger validation if mode is onBlur
      if (parsedMode.validation === "onBlur") {
        const value = getNestedValue(currentState.values, fieldPath)
        get.set(triggerValidationAtom, value)
      }
    }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

    const atoms: FieldAtoms = {
      valueAtom,
      initialValueAtom,
      touchedAtom,
      errorAtom,
      visibleErrorAtom,
      isValidatingAtom,
      triggerValidationAtom,
      onChangeAtom,
      onBlurAtom,
    }
    fieldAtomsRegistry.set(fieldPath, atoms)
    return atoms
  }

  const resetValidationAtoms = (ctx: { set: <R, W>(atom: Atom.Writable<R, W>, value: W) => void }) => {
    for (const validationAtom of validationAtomsRegistry.values()) {
      ctx.set(validationAtom, Atom.Reset)
    }
    validationAtomsRegistry.clear()
    fieldAtomsRegistry.clear()
  }

  const submitAtom = runtime.fn<SubmitArgs>()((args, get) =>
    Effect.gen(function*() {
      const state = get(stateAtom)
      if (Option.isNone(state)) return yield* Effect.die("Form not initialized")
      const values = state.value.values
      get.set(errorsAtom, new Map())
      const decoded = yield* pipe(
        Schema.decodeUnknown(combinedSchema, { errors: "all" })(values) as Effect.Effect<
          Field.DecodedFromFields<TFields>,
          ParseResult.ParseError,
          R
        >,
        Effect.tapError((parseError) =>
          Effect.sync(() => {
            const routedErrors = Validation.routeErrorsWithSource(parseError)
            get.set(errorsAtom, routedErrors)
            get.set(stateAtom, Option.some(operations.createSubmitState(state.value)))
          })
        ),
      )
      const submitState = operations.createSubmitState(state.value)
      get.set(
        stateAtom,
        Option.some({
          ...submitState,
          lastSubmittedValues: Option.some({ encoded: values, decoded }),
        }),
      )
      const result = config.onSubmit(args, { decoded, encoded: values, get })
      if (Effect.isEffect(result)) {
        return yield* (result as Effect.Effect<A, E, R>)
      }
      return result as A
    })
  ).pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<SubmitArgs, A, E | ParseResult.ParseError>

  const fieldRefs = Object.fromEntries(
    Object.keys(fields).map((key) => [key, FormBuilder.makeFieldRef(key)]),
  ) as FieldRefs<TFields>

  const operations: FormOperations<TFields> = {
    createInitialState: (defaultValues) => ({
      values: defaultValues,
      initialValues: defaultValues,
      lastSubmittedValues: Option.none(),
      touched: Field.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
      submitCount: 0,
      dirtyFields: new Set(),
    }),

    createResetState: (state) => ({
      values: state.initialValues,
      initialValues: state.initialValues,
      lastSubmittedValues: Option.none(),
      touched: Field.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
      submitCount: 0,
      dirtyFields: new Set(),
    }),

    createSubmitState: (state) => ({
      ...state,
      touched: Field.createTouchedRecord(fields, true) as { readonly [K in keyof TFields]: boolean },
      submitCount: state.submitCount + 1,
    }),

    setFieldValue: (state, fieldPath, value) => {
      const newValues = setNestedValue(state.values, fieldPath, value)
      const newDirtyFields = recalculateDirtySubtree(
        state.dirtyFields,
        state.initialValues,
        newValues,
        fieldPath,
      )
      return {
        ...state,
        values: newValues as Field.EncodedFromFields<TFields>,
        dirtyFields: newDirtyFields,
      }
    },

    setFormValues: (state, values) => {
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
    },

    setFieldTouched: (state, fieldPath, touched) => ({
      ...state,
      touched: setNestedValue(state.touched, fieldPath, touched) as { readonly [K in keyof TFields]: boolean },
    }),

    appendArrayItem: (state, arrayPath, itemSchema, value) => {
      const newItem = value ?? Field.getDefaultFromSchema(itemSchema)
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      const newItems = [...currentItems, newItem]
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Field.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems),
      }
    },

    removeArrayItem: (state, arrayPath, index) => {
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      const newItems = currentItems.filter((_, i) => i !== index)
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Field.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems),
      }
    },

    swapArrayItems: (state, arrayPath, indexA, indexB) => {
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      if (
        indexA < 0 || indexA >= currentItems.length ||
        indexB < 0 || indexB >= currentItems.length ||
        indexA === indexB
      ) {
        return state
      }
      const newItems = [...currentItems]
      const temp = newItems[indexA]
      newItems[indexA] = newItems[indexB]
      newItems[indexB] = temp
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Field.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems),
      }
    },

    moveArrayItem: (state, arrayPath, fromIndex, toIndex) => {
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      if (
        fromIndex < 0 || fromIndex >= currentItems.length ||
        toIndex < 0 || toIndex > currentItems.length ||
        fromIndex === toIndex
      ) {
        return state
      }
      const newItems = [...currentItems]
      const [item] = newItems.splice(fromIndex, 1)
      newItems.splice(toIndex, 0, item)
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Field.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems),
      }
    },

    revertToLastSubmit: (state) => {
      if (Option.isNone(state.lastSubmittedValues)) {
        return state
      }

      const lastEncoded = state.lastSubmittedValues.value.encoded
      if (state.values === lastEncoded) {
        return state
      }

      const newDirtyFields = recalculateDirtySubtree(
        state.dirtyFields,
        state.initialValues,
        lastEncoded,
        "",
      )

      return {
        ...state,
        values: lastEncoded,
        dirtyFields: newDirtyFields,
      }
    },
  }

  const resetAtom = Atom.fnSync<void>()((_: void, get) => {
    const state = get(stateAtom)
    if (Option.isNone(state)) return
    get.set(stateAtom, Option.some(operations.createResetState(state.value)))
    get.set(errorsAtom, new Map())
    resetValidationAtoms(get)
    get.set(submitAtom, Atom.Reset)
  }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

  const revertToLastSubmitAtom = Atom.fnSync<void>()((_: void, get) => {
    const state = get(stateAtom)
    if (Option.isNone(state)) return
    get.set(stateAtom, Option.some(operations.revertToLastSubmit(state.value)))
    get.set(errorsAtom, new Map())
  }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

  const setValuesAtom = Atom.fnSync<Field.EncodedFromFields<TFields>>()((_values, get) => {
    const state = get(stateAtom)
    if (Option.isNone(state)) return
    get.set(stateAtom, Option.some(operations.setFormValues(state.value, _values)))
    get.set(errorsAtom, new Map())
  }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

  const setValueAtomsRegistry = createWeakRegistry<Atom.Writable<void, any>>()

  const setValue = <S>(field: FormBuilder.FieldRef<S>): Atom.Writable<void, S | ((prev: S) => S)> => {
    const cached = setValueAtomsRegistry.get(field.key)
    if (cached) return cached

    const atom = Atom.fnSync<S | ((prev: S) => S)>()((update, get) => {
      const state = get(stateAtom)
      if (Option.isNone(state)) return

      const currentValue = getNestedValue(state.value.values, field.key) as S
      const newValue = typeof update === "function"
        ? (update as (prev: S) => S)(currentValue)
        : update

      get.set(stateAtom, Option.some(operations.setFieldValue(state.value, field.key, newValue)))
      // Don't clear errors - display logic handles showing/hiding based on source + validation state
    }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

    setValueAtomsRegistry.set(field.key, atom)
    return atom
  }

  const getFieldAtom = <S>(field: FormBuilder.FieldRef<S>): Atom.Atom<Option.Option<S>> => {
    const existing = publicFieldAtomRegistry.get(field.key)
    if (existing) return existing as Atom.Atom<Option.Option<S>>

    const safeAtom = Atom.readable((get) =>
      Option.map(get(stateAtom), (state) => getNestedValue(state.values, field.key) as S)
    ).pipe(Atom.setIdleTTL(0))

    publicFieldAtomRegistry.set(field.key, safeAtom)
    return safeAtom
  }

  const publicFieldAtomsRegistry = createWeakRegistry<PublicFieldAtoms<unknown>>()

  const getField = <S>(field: FormBuilder.FieldRef<S>): PublicFieldAtoms<S> => {
    const existing = publicFieldAtomsRegistry.get(field.key)
    if (existing) return existing as PublicFieldAtoms<S>

    const fieldAtoms = getOrCreateFieldAtoms(field.key)

    // Safe value atom (returns None if form not initialized)
    const valueAtom = Atom.readable((get) =>
      Option.map(get(stateAtom), (state) => getNestedValue(state.values, field.key) as S)
    ).pipe(Atom.setIdleTTL(0))

    // Safe initial value atom
    const initialValueAtom = Atom.readable((get) =>
      Option.map(get(stateAtom), (state) => getNestedValue(state.initialValues, field.key) as S)
    ).pipe(Atom.setIdleTTL(0))

    // isDirty computed atom
    const isDirtyAtom = Atom.readable((get) =>
      isPathOrParentDirty(get(dirtyFieldsAtom), field.key)
    ).pipe(Atom.setIdleTTL(0))

    // Safe isTouched (false if form not initialized)
    const isTouchedAtom = Atom.readable((get) => {
      const state = get(stateAtom)
      if (Option.isNone(state)) return false
      return (getNestedValue(state.value.touched, field.key) ?? false) as boolean
    }).pipe(Atom.setIdleTTL(0))

    // Typed onChange atom
    const typedOnChangeAtom = Atom.writable(
      () => undefined as void,
      (ctx, value: S) => ctx.set(fieldAtoms.onChangeAtom, value)
    ).pipe(Atom.setIdleTTL(0))

    const result: PublicFieldAtoms<S> = {
      value: valueAtom,
      initialValue: initialValueAtom,
      error: fieldAtoms.visibleErrorAtom,
      isTouched: isTouchedAtom,
      isDirty: isDirtyAtom,
      isValidating: fieldAtoms.isValidatingAtom,
      setValue: setValue(field),
      onChange: typedOnChangeAtom,
      onBlur: fieldAtoms.onBlurAtom,
      key: field.key,
    }

    publicFieldAtomsRegistry.set(field.key, result as PublicFieldAtoms<unknown>)
    return result
  }

  const mountAtom = Atom.readable((get) => {
    get(stateAtom)
    get(errorsAtom)
    get(submitAtom)
  }).pipe(Atom.setIdleTTL(0))

  const keepAliveActiveAtom = Atom.make(false).pipe(Atom.setIdleTTL(0))

  // Initialize atom - sets initial state if not already initialized (respects keepAlive)
  const initializeAtom = Atom.fnSync<Field.EncodedFromFields<TFields>>()((defaultValues, get) => {
    const isKeptAlive = get(keepAliveActiveAtom)
    const currentState = get(stateAtom)

    if (!isKeptAlive) {
      // Not in keepAlive mode - always initialize
      get.set(stateAtom, Option.some(operations.createInitialState(defaultValues)))
    } else if (Option.isNone(currentState)) {
      // In keepAlive mode but no state yet - initialize
      get.set(stateAtom, Option.some(operations.createInitialState(defaultValues)))
    }
    // Otherwise: keepAlive is active and state exists - do nothing
  }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))


  // Trigger auto-submit for onBlur mode (call this on field blur)
  const triggerAutoSubmitOnBlurAtom = Atom.fnSync<void>()((_: void, get) => {
    if (!parsedMode.autoSubmit || parsedMode.validation !== "onBlur") return

    const state = get(stateAtom)
    if (Option.isNone(state)) return

    const { values, lastSubmittedValues } = state.value

    // Skip if values match last submitted
    if (Option.isSome(lastSubmittedValues) && values === lastSubmittedValues.value.encoded) return

    get.set(submitAtom, undefined as SubmitArgs)
  }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-Submit coordination atoms
  // ─────────────────────────────────────────────────────────────────────────────

  // Track the last values reference to detect actual value changes (for React subscription)
  const autoSubmitLastValuesAtom = Atom.make<unknown>(null).pipe(Atom.setIdleTTL(0))

  // Called on every state change from React - handles value tracking and submit triggering
  const triggerAutoSubmitOnChangeAtom = Atom.fnSync<void>()((_: void, get) => {
    if (!parsedMode.autoSubmit || parsedMode.validation !== "onChange") return

    const state = get(stateAtom)
    if (Option.isNone(state)) return

    const currentValues = state.value.values
    const lastValues = get(autoSubmitLastValuesAtom)

    // Reference equality check - skip if values haven't changed
    if (currentValues === lastValues) return
    get.set(autoSubmitLastValuesAtom, currentValues)

    const submitResult = get(submitAtom)
    if (submitResult.waiting) {
      get.set(autoSubmitPendingAtom, true)
    } else {
      autoSubmitCounter++
      get.set(debouncedAutoSubmitAtom, autoSubmitCounter)
    }
  }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

  // Called when submit completes to flush pending auto-submit
  const flushAutoSubmitPendingAtom = Atom.fnSync<boolean>()((wasSubmitting: boolean, get) => {
    if (!parsedMode.autoSubmit || parsedMode.validation !== "onChange") return

    const submitResult = get(submitAtom)
    const isSubmitting = submitResult.waiting

    // Only flush when transitioning from submitting to not submitting
    if (wasSubmitting && !isSubmitting) {
      const pending = get(autoSubmitPendingAtom)
      if (pending) {
        get.set(autoSubmitPendingAtom, false)
        autoSubmitCounter++
        get.set(debouncedAutoSubmitAtom, autoSubmitCounter)
      }
    }
  }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

  return {
    stateAtom,
    errorsAtom,
    rootErrorAtom,
    valuesAtom,
    dirtyFieldsAtom,
    isDirtyAtom,
    submitCountAtom,
    lastSubmittedValuesAtom,
    changedSinceSubmitFieldsAtom,
    hasChangedSinceSubmitAtom,
    submitAtom,
    combinedSchema,
    fieldRefs,
    validationAtomsRegistry,
    fieldAtomsRegistry,
    getOrCreateValidationAtom,
    getOrCreateFieldAtoms,
    resetValidationAtoms,
    operations,
    resetAtom,
    revertToLastSubmitAtom,
    setValuesAtom,
    setValue,
    getFieldAtom,
    getField,
    mountAtom,
    keepAliveActiveAtom,
    initializeAtom,
    parsedMode,
    triggerAutoSubmitOnBlurAtom,
    triggerAutoSubmitOnChangeAtom,
    flushAutoSubmitPendingAtom,
    autoSubmitReadyAtom,
    autoSubmitRequestIdAtom,
    isAutoSubmitDebouncingAtom: isAutoSubmitDebouncing,
  } as FormAtoms<TFields, R, A, E, SubmitArgs>
}
