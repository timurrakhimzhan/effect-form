/**
 * @since 1.0.0
 */
import { RegistryContext, useAtom, useAtomSet, useAtomSubscribe, useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import type * as Registry from "@effect-atom/atom/Registry"
import type * as Result from "@effect-atom/atom/Result"
import { Form, Mode, Validation } from "@lucas-barake/effect-form"
import { recalculateDirtyFieldsForArray, recalculateDirtySubtree } from "@lucas-barake/effect-form/internal/dirty"
import {
  getNestedValue,
  isPathOrParentDirty,
  schemaPathToFieldPath,
  setNestedValue,
} from "@lucas-barake/effect-form/internal/path"
import { createWeakRegistry } from "@lucas-barake/effect-form/internal/weak-registry"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import * as Utils from "effect/Utils"
import * as React from "react"
import { createContext, useContext } from "react"
import { useDebounced } from "./internal/use-debounced.js"

// ================================
// Field Component Props
// ================================

/**
 * Props passed to field components.
 *
 * @since 1.0.0
 * @category Models
 */
export interface FieldComponentProps<S extends Schema.Schema.Any> {
  readonly value: Schema.Schema.Encoded<S>
  readonly onChange: (value: Schema.Schema.Encoded<S>) => void
  readonly onBlur: () => void
  readonly error: Option.Option<string>
  readonly isTouched: boolean
  readonly isValidating: boolean
  readonly isDirty: boolean
}

// ================================
// Component Map Type
// ================================

/**
 * Maps field names to their React components.
 *
 * @since 1.0.0
 * @category Models
 */
export type FieldComponentMap<TFields extends Form.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Form.FieldDef<any, infer S> ? React.FC<FieldComponentProps<S>>
    : TFields[K] extends Form.ArrayFieldDef<any, infer F> ? FieldComponentMap<F["fields"]>
    : never
}

/**
 * Maps field names to their type-safe Field references for setValue operations.
 *
 * @since 1.0.0
 * @category Models
 */
export type FieldRefs<TFields extends Form.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Form.FieldDef<any, infer S> ? Form.Field<Schema.Schema.Encoded<S>>
    : TFields[K] extends Form.ArrayFieldDef<any, infer F>
      ? Form.Field<ReadonlyArray<Form.EncodedFromFields<F["fields"]>>>
    : never
}

// ================================
// Array Field Operations
// ================================

/**
 * Operations available for array fields.
 *
 * @since 1.0.0
 * @category Models
 */
export interface ArrayFieldOperations<TItem> {
  readonly items: ReadonlyArray<TItem>
  readonly append: (value?: TItem) => void
  readonly remove: (index: number) => void
  readonly swap: (indexA: number, indexB: number) => void
  readonly move: (from: number, to: number) => void
}

// ================================
// Subscribe State
// ================================

/**
 * State exposed to form.Subscribe render prop.
 *
 * @since 1.0.0
 * @category Models
 */
export interface SubscribeState<TFields extends Form.FieldsRecord> {
  readonly values: Form.EncodedFromFields<TFields>
  readonly isDirty: boolean
  readonly submitResult: Result.Result<unknown, unknown>
  readonly submit: () => void
  readonly reset: () => void
  readonly setValue: <S>(field: Form.Field<S>, update: S | ((prev: S) => S)) => void
  readonly setValues: (values: Form.EncodedFromFields<TFields>) => void
}

// ================================
// Built Form Type
// ================================

/**
 * The result of building a form, containing all components and utilities needed
 * for form rendering and submission.
 *
 * @since 1.0.0
 * @category Models
 */
export type BuiltForm<TFields extends Form.FieldsRecord, R> = {
  readonly atom: Atom.Writable<Option.Option<Form.FormState<TFields>>, Option.Option<Form.FormState<TFields>>>
  readonly schema: Schema.Schema<Form.DecodedFromFields<TFields>, Form.EncodedFromFields<TFields>, R>
  readonly fields: FieldRefs<TFields>

  readonly Form: React.FC<{
    readonly defaultValues: Form.EncodedFromFields<TFields>
    readonly onSubmit: Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown>
    readonly children: React.ReactNode
  }>

  readonly Subscribe: React.FC<{
    readonly children: (state: SubscribeState<TFields>) => React.ReactNode
  }>

  readonly useForm: () => {
    readonly submit: () => void
    readonly reset: () => void
    readonly isDirty: boolean
    readonly submitResult: Result.Result<unknown, unknown>
    readonly values: Form.EncodedFromFields<TFields>
    readonly setValue: <S>(field: Form.Field<S>, update: S | ((prev: S) => S)) => void
    readonly setValues: (values: Form.EncodedFromFields<TFields>) => void
  }

  readonly submit: <A, E>(
    fn: (values: Form.DecodedFromFields<TFields>, get: Atom.FnContext) => Effect.Effect<A, E, R>,
  ) => Atom.AtomResultFn<Form.DecodedFromFields<TFields>, A, E>
} & FieldComponents<TFields>

type FieldComponents<TFields extends Form.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Form.FieldDef<any, any> ? React.FC
    : TFields[K] extends Form.ArrayFieldDef<any, infer F>
      ? ArrayFieldComponent<F extends Form.FormBuilder<infer IF, any> ? IF : never>
    : never
}

type ArrayFieldComponent<TItemFields extends Form.FieldsRecord> =
  & React.FC<{
    readonly children: (ops: ArrayFieldOperations<Form.EncodedFromFields<TItemFields>>) => React.ReactNode
  }>
  & {
    readonly Item: React.FC<{
      readonly index: number
      readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
    }>
  }
  & {
    readonly [K in keyof TItemFields]: TItemFields[K] extends Form.FieldDef<any, any> ? React.FC
      : TItemFields[K] extends Form.ArrayFieldDef<any, infer F>
        ? ArrayFieldComponent<F extends Form.FormBuilder<infer IF, any> ? IF : never>
      : never
  }

// ================================
// Internal Types
// ================================

interface FieldAtoms {
  readonly valueAtom: Atom.Writable<unknown, unknown>
  readonly initialValueAtom: Atom.Atom<unknown>
  readonly touchedAtom: Atom.Writable<boolean, boolean>
  readonly crossFieldErrorAtom: Atom.Atom<Option.Option<string>>
}

// ================================
// Internal Contexts
// ================================

interface ArrayItemContextValue {
  readonly index: number
  readonly parentPath: string
}

const ArrayItemContext = createContext<ArrayItemContextValue | null>(null)
const AutoSubmitContext = createContext<(() => void) | null>(null)

// ================================
// Field Component Factory
// ================================

const makeFieldComponent = <S extends Schema.Schema.Any>(
  fieldKey: string,
  fieldDef: Form.FieldDef<string, S>,
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
  submitCountAtom: Atom.Atom<number>,
  dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>,
  parsedMode: Mode.ParsedMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  getOrCreateFieldAtoms: (fieldPath: string) => FieldAtoms,
  Component: React.FC<FieldComponentProps<S>>,
): React.FC => {
  const FieldComponent: React.FC = () => {
    const arrayCtx = useContext(ArrayItemContext)
    const autoSubmitOnBlur = useContext(AutoSubmitContext)
    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey

    const { crossFieldErrorAtom, touchedAtom, valueAtom } = React.useMemo(
      () => getOrCreateFieldAtoms(fieldPath),
      [fieldPath],
    )

    const [value, setValue] = useAtom(valueAtom) as [Schema.Schema.Encoded<S>, (v: unknown) => void]
    const [isTouched, setTouched] = useAtom(touchedAtom)
    const crossFieldError = useAtomValue(crossFieldErrorAtom)
    const setCrossFieldErrors = useAtomSet(crossFieldErrorsAtom)
    const submitCount = useAtomValue(submitCountAtom)

    const validationAtom = React.useMemo(
      () => getOrCreateValidationAtom(fieldPath, fieldDef.schema),
      [fieldPath],
    )
    const validationResult = useAtomValue(validationAtom)
    const validateImmediate = useAtomSet(validationAtom)

    const shouldDebounceValidation = parsedMode.validation === "onChange"
      && parsedMode.debounce !== null
      && !parsedMode.autoSubmit
    const validate = useDebounced(validateImmediate, shouldDebounceValidation ? parsedMode.debounce : null)

    // Reactive validation for programmatic setValue/setValues. prevValueRef avoids
    // race condition where React batches mount + setValue in a single render.
    const prevValueRef = React.useRef(value)
    React.useEffect(() => {
      if (prevValueRef.current === value) {
        return
      }
      prevValueRef.current = value

      const shouldValidate = parsedMode.validation === "onChange"
        || (parsedMode.validation === "onBlur" && isTouched)

      if (shouldValidate) {
        validate(value)
      }
    }, [value, isTouched, validate])

    const perFieldError: Option.Option<string> = React.useMemo(() => {
      if (validationResult._tag === "Failure") {
        const parseError = Cause.failureOption(validationResult.cause)
        if (Option.isSome(parseError) && ParseResult.isParseError(parseError.value)) {
          return Validation.extractFirstError(parseError.value)
        }
      }
      return Option.none()
    }, [validationResult])

    const validationError = Option.isSome(perFieldError) ? perFieldError : crossFieldError

    const onChange = React.useCallback(
      (newValue: Schema.Schema.Encoded<S>) => {
        setValue(newValue)
        setCrossFieldErrors((prev) => {
          if (prev.has(fieldPath)) {
            const next = new Map(prev)
            next.delete(fieldPath)
            return next
          }
          return prev
        })
        if (parsedMode.validation === "onChange") {
          validate(newValue)
        }
      },
      [fieldPath, setValue, setCrossFieldErrors, validate],
    )

    const onBlur = React.useCallback(() => {
      setTouched(true)
      if (parsedMode.validation === "onBlur") {
        validate(value)
      }
      autoSubmitOnBlur?.()
    }, [setTouched, validate, value, autoSubmitOnBlur])

    const dirtyFields = useAtomValue(dirtyFieldsAtom)
    const isDirty = React.useMemo(
      () => isPathOrParentDirty(dirtyFields, fieldPath),
      [dirtyFields, fieldPath],
    )
    const isValidating = validationResult.waiting
    const shouldShowError = isTouched || submitCount > 0

    return (
      <Component
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={shouldShowError ? validationError : Option.none<string>()}
        isTouched={isTouched}
        isValidating={isValidating}
        isDirty={isDirty}
      />
    )
  }

  return FieldComponent
}

// ================================
// Array Field Component Factory
// ================================

const makeArrayFieldComponent = <TItemFields extends Form.FieldsRecord>(
  fieldKey: string,
  def: Form.ArrayFieldDef<string, Form.FormBuilder<TItemFields, any>>,
  stateAtom: Atom.Writable<Option.Option<Form.FormState<any>>, Option.Option<Form.FormState<any>>>,
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
  submitCountAtom: Atom.Atom<number>,
  dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>,
  parsedMode: Mode.ParsedMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  getOrCreateFieldAtoms: (fieldPath: string) => FieldAtoms,
  componentMap: FieldComponentMap<TItemFields>,
): ArrayFieldComponent<TItemFields> => {
  const ArrayWrapper: React.FC<{
    readonly children: (ops: ArrayFieldOperations<Form.EncodedFromFields<TItemFields>>) => React.ReactNode
  }> = ({ children }) => {
    const arrayCtx = useContext(ArrayItemContext)
    const [formStateOption, setFormState] = useAtom(stateAtom)
    const formState = Option.getOrThrow(formStateOption)

    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey
    const items = React.useMemo(
      () => (getNestedValue(formState.values, fieldPath) ?? []) as ReadonlyArray<Form.EncodedFromFields<TItemFields>>,
      [formState.values, fieldPath],
    )

    const append = React.useCallback(
      (value?: Form.EncodedFromFields<TItemFields>) => {
        const newItem = (value ?? Form.getDefaultEncodedValues(def.itemForm.fields)) as Form.EncodedFromFields<
          TItemFields
        >
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          const state = prev.value
          const currentItems = (getNestedValue(state.values, fieldPath) ?? []) as ReadonlyArray<
            Form.EncodedFromFields<TItemFields>
          >
          const newItems = [...currentItems, newItem]
          return Option.some({
            ...state,
            values: setNestedValue(state.values, fieldPath, newItems),
            dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, fieldPath, newItems),
          })
        })
      },
      [fieldPath, setFormState],
    )

    const remove = React.useCallback(
      (index: number) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          const state = prev.value
          const currentItems = (getNestedValue(state.values, fieldPath) ?? []) as ReadonlyArray<
            Form.EncodedFromFields<TItemFields>
          >
          const newItems = currentItems.filter((_, i) => i !== index)
          return Option.some({
            ...state,
            values: setNestedValue(state.values, fieldPath, newItems),
            dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, fieldPath, newItems),
          })
        })
      },
      [fieldPath, setFormState],
    )

    const swap = React.useCallback(
      (indexA: number, indexB: number) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          const state = prev.value
          const currentItems = (getNestedValue(state.values, fieldPath) ?? []) as ReadonlyArray<
            Form.EncodedFromFields<TItemFields>
          >
          const newItems = [...currentItems]
          const temp = newItems[indexA]
          newItems[indexA] = newItems[indexB]
          newItems[indexB] = temp
          return Option.some({
            ...state,
            values: setNestedValue(state.values, fieldPath, newItems),
            dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, fieldPath, newItems),
          })
        })
      },
      [fieldPath, setFormState],
    )

    const move = React.useCallback(
      (from: number, to: number) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          const state = prev.value
          const currentItems = (getNestedValue(state.values, fieldPath) ?? []) as ReadonlyArray<
            Form.EncodedFromFields<TItemFields>
          >
          const newItems = [...currentItems]
          const [item] = newItems.splice(from, 1)
          newItems.splice(to, 0, item)
          return Option.some({
            ...state,
            values: setNestedValue(state.values, fieldPath, newItems),
            dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, fieldPath, newItems),
          })
        })
      },
      [fieldPath, setFormState],
    )

    return <>{children({ items, append, remove, swap, move })}</>
  }

  const ItemWrapper: React.FC<{
    readonly index: number
    readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
  }> = ({ children, index }) => {
    const arrayCtx = useContext(ArrayItemContext)
    const setFormState = useAtomSet(stateAtom)

    const parentPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey
    const itemPath = `${parentPath}[${index}]`

    const remove = React.useCallback(() => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        const state = prev.value
        const currentItems = (getNestedValue(state.values, parentPath) ?? []) as Array<any>
        const newItems = currentItems.filter((_, i) => i !== index)
        return Option.some({
          ...state,
          values: setNestedValue(state.values, parentPath, newItems),
          dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, parentPath, newItems),
        })
      })
    }, [parentPath, index, setFormState])

    return (
      <ArrayItemContext.Provider value={{ index, parentPath: itemPath }}>
        {typeof children === "function" ? children({ remove }) : children}
      </ArrayItemContext.Provider>
    )
  }

  const itemFieldComponents: Record<string, React.FC> = {}
  for (const [itemKey, itemDef] of Object.entries(def.itemForm.fields)) {
    if (Form.isFieldDef(itemDef)) {
      const itemComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any>>>)[itemKey]
      itemFieldComponents[itemKey] = makeFieldComponent(
        itemKey,
        itemDef,
        crossFieldErrorsAtom,
        submitCountAtom,
        dirtyFieldsAtom,
        parsedMode,
        getOrCreateValidationAtom,
        getOrCreateFieldAtoms,
        itemComponent,
      )
    }
  }

  const properties: Record<string, unknown> = {
    Item: ItemWrapper,
    ...itemFieldComponents,
  }

  return new Proxy(ArrayWrapper, {
    get(target, prop) {
      if (prop in properties) {
        return properties[prop as string]
      }
      return Reflect.get(target, prop)
    },
  }) as ArrayFieldComponent<TItemFields>
}

// ================================
// Field Components Factory
// ================================

const makeFieldComponents = <TFields extends Form.FieldsRecord>(
  fields: TFields,
  stateAtom: Atom.Writable<Option.Option<Form.FormState<TFields>>, Option.Option<Form.FormState<TFields>>>,
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
  submitCountAtom: Atom.Atom<number>,
  dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>,
  parsedMode: Mode.ParsedMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  getOrCreateFieldAtoms: (fieldPath: string) => FieldAtoms,
  componentMap: FieldComponentMap<TFields>,
): FieldComponents<TFields> => {
  const components: Record<string, any> = {}

  for (const [key, def] of Object.entries(fields)) {
    if (Form.isArrayFieldDef(def)) {
      const arrayComponentMap = (componentMap as Record<string, FieldComponentMap<any>>)[key]
      components[key] = makeArrayFieldComponent(
        key,
        def,
        stateAtom,
        crossFieldErrorsAtom,
        submitCountAtom,
        dirtyFieldsAtom,
        parsedMode,
        getOrCreateValidationAtom,
        getOrCreateFieldAtoms,
        arrayComponentMap,
      )
    } else if (Form.isFieldDef(def)) {
      const fieldComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any>>>)[key]
      components[key] = makeFieldComponent(
        key,
        def,
        crossFieldErrorsAtom,
        submitCountAtom,
        dirtyFieldsAtom,
        parsedMode,
        getOrCreateValidationAtom,
        getOrCreateFieldAtoms,
        fieldComponent,
      )
    }
  }

  return components as FieldComponents<TFields>
}

// ================================
// Build Function
// ================================

/**
 * Builds a React form from a FormBuilder.
 *
 * @example
 * ```tsx
 * import { Form } from "@lucas-barake/effect-form"
 * import { FormReact } from "@lucas-barake/effect-form-react"
 * import * as Atom from "@effect-atom/atom/Atom"
 * import * as Schema from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const runtime = Atom.runtime(Layer.empty)
 *
 * const loginForm = Form.empty
 *   .addField("email", Schema.String)
 *   .addField("password", Schema.String)
 *
 * const form = FormReact.build(loginForm, {
 *   runtime,
 *   fields: { email: TextInput, password: PasswordInput },
 * })
 *
 * function LoginDialog({ onClose }) {
 *   const handleSubmit = form.submit((values) =>
 *     Effect.gen(function* () {
 *       yield* saveUser(values)
 *       onClose()
 *     })
 *   )
 *
 *   return (
 *     <form.Form defaultValues={{ email: "", password: "" }} onSubmit={handleSubmit}>
 *       <form.email />
 *       <form.password />
 *       <form.Subscribe>
 *         {({ isDirty, submit }) => (
 *           <button onClick={submit} disabled={!isDirty}>Login</button>
 *         )}
 *       </form.Subscribe>
 *     </form.Form>
 *   )
 * }
 * ```
 *
 * @since 1.0.0
 * @category Constructors
 */
export const build = <TFields extends Form.FieldsRecord, R, ER = never>(
  self: Form.FormBuilder<TFields, R>,
  options: {
    readonly runtime: Atom.AtomRuntime<R, ER>
    readonly fields: FieldComponentMap<TFields>
    readonly mode?: Mode.FormMode
  },
): BuiltForm<TFields, R> => {
  const { fields: components, mode, runtime } = options
  const parsedMode = Mode.parse(mode)
  const { fields } = self

  const combinedSchema = Form.buildSchema(self)

  const stateAtom = Atom.make(Option.none<Form.FormState<TFields>>()).pipe(Atom.setIdleTTL(0))
  const crossFieldErrorsAtom = Atom.make<Map<string, string>>(new Map()).pipe(Atom.setIdleTTL(0))

  const dirtyFieldsAtom = Atom.readable((get) => Option.getOrThrow(get(stateAtom)).dirtyFields).pipe(Atom.setIdleTTL(0))

  const isDirtyAtom = Atom.readable((get) => Option.getOrThrow(get(stateAtom)).dirtyFields.size > 0).pipe(
    Atom.setIdleTTL(0),
  )
  const submitCountAtom = Atom.readable((get) => Option.getOrThrow(get(stateAtom)).submitCount).pipe(Atom.setIdleTTL(0))
  const onSubmitAtom = Atom.make<Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown> | null>(null)
    .pipe(Atom.setIdleTTL(0))

  const updateDirtyFields = (
    state: Form.FormState<TFields>,
    fieldPath: string,
    newValue: unknown,
  ): ReadonlySet<string> => {
    const initialValue = getNestedValue(state.initialValues, fieldPath)
    const isEqual = Utils.structuralRegion(() => Equal.equals(newValue, initialValue))

    const newDirtyFields = new Set(state.dirtyFields)
    if (!isEqual) {
      newDirtyFields.add(fieldPath)
    } else {
      newDirtyFields.delete(fieldPath)
    }
    return newDirtyFields
  }

  const validationAtomsRegistry = createWeakRegistry<Atom.AtomResultFn<unknown, void, ParseResult.ParseError>>()
  const fieldAtomsRegistry = createWeakRegistry<FieldAtoms>()

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

  const getOrCreateFieldAtoms = (fieldPath: string): FieldAtoms => {
    const existing = fieldAtomsRegistry.get(fieldPath)
    if (existing) return existing

    const valueAtom = Atom.writable(
      (get) => getNestedValue(Option.getOrThrow(get(stateAtom)).values, fieldPath),
      (ctx, value) => {
        const currentState = Option.getOrThrow(ctx.get(stateAtom))
        ctx.set(
          stateAtom,
          Option.some({
            ...currentState,
            values: setNestedValue(currentState.values, fieldPath, value),
            dirtyFields: updateDirtyFields(currentState, fieldPath, value),
          }),
        )
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

    const crossFieldErrorAtom = Atom.readable((get) => {
      const errors = get(crossFieldErrorsAtom)
      const error = errors.get(fieldPath)
      return error !== undefined ? Option.some(error) : Option.none<string>()
    }).pipe(Atom.setIdleTTL(0))

    const atoms: FieldAtoms = { valueAtom, initialValueAtom, touchedAtom, crossFieldErrorAtom }
    fieldAtomsRegistry.set(fieldPath, atoms)
    return atoms
  }

  const resetValidationAtoms = (registry: Registry.Registry) => {
    for (const validationAtom of validationAtomsRegistry.values()) {
      registry.set(validationAtom, Atom.Reset)
    }
    validationAtomsRegistry.clear()
    fieldAtomsRegistry.clear()
  }

  const decodeAndSubmit = runtime.fn<Form.EncodedFromFields<TFields>>()((values, get) =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(combinedSchema)(values) as Effect.Effect<
        Form.DecodedFromFields<TFields>,
        ParseResult.ParseError,
        R
      >
      const onSubmit = get(onSubmitAtom)!
      get.set(onSubmit, decoded)
      return yield* get.result(onSubmit, { suspendOnWaiting: true })
    })
  ).pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<Form.EncodedFromFields<TFields>, unknown, unknown>

  const FormComponent: React.FC<{
    readonly defaultValues: Form.EncodedFromFields<TFields>
    readonly onSubmit: Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown>
    readonly children: React.ReactNode
  }> = ({ children, defaultValues, onSubmit }) => {
    const registry = React.useContext(RegistryContext)
    const state = useAtomValue(stateAtom)
    const setFormState = useAtomSet(stateAtom)
    const setOnSubmit = useAtomSet(onSubmitAtom)
    const callDecodeAndSubmit = useAtomSet(decodeAndSubmit)

    React.useEffect(() => {
      setOnSubmit(onSubmit)
    }, [onSubmit, setOnSubmit])

    React.useEffect(() => {
      setFormState(Option.some({
        values: defaultValues,
        initialValues: defaultValues,
        touched: Form.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
        submitCount: 0,
        dirtyFields: new Set(),
      }))
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
    }, [])

    const debouncedAutoSubmit = useDebounced(() => {
      const stateOption = registry.get(stateAtom)
      if (Option.isNone(stateOption)) return
      callDecodeAndSubmit(stateOption.value.values)
    }, parsedMode.autoSubmit && parsedMode.validation === "onChange" ? parsedMode.debounce : null)

    useAtomSubscribe(
      stateAtom,
      React.useCallback(() => {
        if (parsedMode.autoSubmit && parsedMode.validation === "onChange") {
          debouncedAutoSubmit()
        }
      }, [debouncedAutoSubmit]),
      { immediate: false },
    )

    const onBlurAutoSubmit = React.useCallback(() => {
      if (parsedMode.autoSubmit && parsedMode.validation === "onBlur") {
        const stateOption = registry.get(stateAtom)
        if (Option.isNone(stateOption)) return
        callDecodeAndSubmit(stateOption.value.values)
      }
    }, [registry, callDecodeAndSubmit])

    if (Option.isNone(state)) return null

    return (
      <AutoSubmitContext.Provider value={onBlurAutoSubmit}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {children}
        </form>
      </AutoSubmitContext.Provider>
    )
  }

  const useFormHook = () => {
    const registry = React.useContext(RegistryContext)
    const formValues = Option.getOrThrow(useAtomValue(stateAtom)).values
    const setFormState = useAtomSet(stateAtom)
    const setCrossFieldErrors = useAtomSet(crossFieldErrorsAtom)
    const [decodeAndSubmitResult, callDecodeAndSubmit] = useAtom(decodeAndSubmit)
    const isDirty = useAtomValue(isDirtyAtom)

    React.useEffect(() => {
      if (decodeAndSubmitResult._tag === "Failure") {
        const parseError = Cause.failureOption(decodeAndSubmitResult.cause)
        if (Option.isSome(parseError) && ParseResult.isParseError(parseError.value)) {
          const issues = ParseResult.ArrayFormatter.formatErrorSync(parseError.value)

          const fieldErrors = new Map<string, string>()
          for (const issue of issues) {
            if (issue.path.length > 0) {
              const fieldPath = schemaPathToFieldPath(issue.path)
              if (!fieldErrors.has(fieldPath)) {
                fieldErrors.set(fieldPath, issue.message)
              }
            }
          }

          if (fieldErrors.size > 0) {
            setCrossFieldErrors(fieldErrors)
          }
        }
      }
    }, [decodeAndSubmitResult, setCrossFieldErrors])

    const submit = React.useCallback(() => {
      const stateOption = registry.get(stateAtom)
      if (Option.isNone(stateOption)) return

      setCrossFieldErrors(new Map())

      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        const state = prev.value
        return Option.some({
          ...state,
          touched: Form.createTouchedRecord(fields, true) as { readonly [K in keyof TFields]: boolean },
          submitCount: state.submitCount + 1,
        })
      })

      callDecodeAndSubmit(stateOption.value.values)
    }, [setFormState, callDecodeAndSubmit, setCrossFieldErrors, registry])

    const reset = React.useCallback(() => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        const state = prev.value
        return Option.some({
          values: state.initialValues,
          initialValues: state.initialValues,
          touched: Form.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
          submitCount: 0,
          dirtyFields: new Set(),
        })
      })
      setCrossFieldErrors(new Map())
      resetValidationAtoms(registry)
      callDecodeAndSubmit(Atom.Reset)
    }, [setFormState, setCrossFieldErrors, callDecodeAndSubmit, registry])

    const setValue = React.useCallback(<S,>(
      field: Form.Field<S>,
      update: S | ((prev: S) => S),
    ) => {
      const path = field.key

      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        const state = prev.value

        const currentValue = getNestedValue(state.values, path) as S
        const newValue = typeof update === "function"
          ? (update as (prev: S) => S)(currentValue)
          : update

        const newValues = setNestedValue(state.values, path, newValue)
        const newDirtyFields = recalculateDirtySubtree(
          state.dirtyFields,
          state.initialValues,
          newValues,
          path,
        )

        return Option.some({
          ...state,
          values: newValues,
          dirtyFields: newDirtyFields,
        })
      })

      setCrossFieldErrors((prev) => {
        let changed = false
        const next = new Map(prev)
        for (const errorPath of prev.keys()) {
          if (errorPath === path || errorPath.startsWith(path + ".") || errorPath.startsWith(path + "[")) {
            next.delete(errorPath)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, [setFormState, setCrossFieldErrors])

    const setValues = React.useCallback((values: Form.EncodedFromFields<TFields>) => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        const state = prev.value

        const newDirtyFields = recalculateDirtySubtree(
          state.dirtyFields,
          state.initialValues,
          values,
          "",
        )

        return Option.some({
          ...state,
          values,
          dirtyFields: newDirtyFields,
        })
      })

      setCrossFieldErrors(new Map())
    }, [setFormState, setCrossFieldErrors])

    return { submit, reset, isDirty, submitResult: decodeAndSubmitResult, values: formValues, setValue, setValues }
  }

  const SubscribeComponent: React.FC<{
    readonly children: (state: SubscribeState<TFields>) => React.ReactNode
  }> = ({ children }) => {
    const { isDirty, reset, setValue, setValues, submit, submitResult, values } = useFormHook()

    return <>{children({ values, isDirty, submitResult, submit, reset, setValue, setValues })}</>
  }

  const submitHelper = <A, E>(
    fn: (values: Form.DecodedFromFields<TFields>, get: Atom.FnContext) => Effect.Effect<A, E, R>,
  ) => runtime.fn<Form.DecodedFromFields<TFields>>()(fn) as Atom.AtomResultFn<Form.DecodedFromFields<TFields>, A, E>

  const fieldComponents = makeFieldComponents(
    fields,
    stateAtom,
    crossFieldErrorsAtom,
    submitCountAtom,
    dirtyFieldsAtom,
    parsedMode,
    getOrCreateValidationAtom,
    getOrCreateFieldAtoms,
    components,
  )

  const fieldRefs = Object.fromEntries(
    Object.keys(fields).map((key) => [key, Form.makeFieldRef(key)]),
  ) as FieldRefs<TFields>

  return {
    atom: stateAtom,
    schema: combinedSchema,
    fields: fieldRefs,
    Form: FormComponent,
    Subscribe: SubscribeComponent,
    useForm: useFormHook,
    submit: submitHelper,
    ...fieldComponents,
  } as BuiltForm<TFields, R>
}
