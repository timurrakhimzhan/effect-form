/**
 * @since 1.0.0
 */
import { useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import { Form } from "@lucas-barake/effect-form"
import * as Cause from "effect/Cause"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import * as React from "react"
import { createContext, useContext } from "react"

// ================================
// Validation Mode
// ================================

/**
 * Controls when field validation is triggered.
 *
 * - `"onSubmit"`: Validation only runs when the form is submitted (default)
 * - `"onBlur"`: Validation runs when a field loses focus
 * - `"onChange"`: Validation runs on every value change
 *
 * @since 1.0.0
 * @category Models
 */
export type ValidationMode = "onChange" | "onBlur" | "onSubmit"

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
  readonly [K in keyof TFields]: TFields[K] extends Form.FieldDef<infer S> ? React.FC<FieldComponentProps<S>>
    : TFields[K] extends Form.ArrayFieldDef<infer F> ? FieldComponentMap<F["fields"]>
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
  readonly isSubmitting: boolean
  readonly submit: () => void
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
  readonly atom: Atom.Writable<Form.FormState<TFields>, Form.FormState<TFields>>
  readonly schema: Schema.Schema<Form.DecodedFromFields<TFields>, Form.EncodedFromFields<TFields>, R>

  readonly Form: React.FC<{
    readonly defaultValues: Form.EncodedFromFields<TFields>
    readonly onSubmit: Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown>
    readonly debounce?: Duration.DurationInput
    readonly children: React.ReactNode
  }>

  readonly Subscribe: React.FC<{
    readonly children: (state: SubscribeState<TFields>) => React.ReactNode
  }>

  readonly useForm: () => {
    readonly submit: () => void
    readonly isDirty: boolean
    readonly isSubmitting: boolean
  }

  readonly submit: <A, E>(
    fn: (values: Form.DecodedFromFields<TFields>, get: Atom.FnContext) => Effect.Effect<A, E, R>,
  ) => Atom.AtomResultFn<Form.DecodedFromFields<TFields>, A, E>
} & FieldComponents<TFields>

type FieldComponents<TFields extends Form.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Form.FieldDef<any> ? React.FC
    : TFields[K] extends Form.ArrayFieldDef<infer F>
      ? ArrayFieldComponent<F extends Form.FormBuilder<infer IF, any> ? IF : never>
    : never
}

interface ArrayFieldComponent<TItemFields extends Form.FieldsRecord> extends
  React.FC<{
    readonly children: (ops: ArrayFieldOperations<Form.EncodedFromFields<TItemFields>>) => React.ReactNode
  }>
{
  readonly Item: React.FC<{
    readonly index: number
    readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
  }>
}

// ================================
// Internal Types
// ================================

type ValidationAtomRegistry = Map<string, Atom.AtomResultFn<unknown, void, ParseResult.ParseError>>

interface ArrayItemContextValue {
  readonly index: number
  readonly parentPath: string
}

const ArrayItemContext = createContext<ArrayItemContextValue | null>(null)

// ================================
// Utilities
// ================================

const getNestedValue = (obj: unknown, path: string): unknown => {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".")
  let current: any = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

const setNestedValue = <T,>(obj: T, path: string, value: unknown): T => {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".")
  const result = { ...obj } as any

  let current = result
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (Array.isArray(current[part])) {
      current[part] = [...current[part]]
    } else {
      current[part] = { ...current[part] }
    }
    current = current[part]
  }

  current[parts[parts.length - 1]] = value
  return result
}

const extractFirstError = (error: ParseResult.ParseError): Option.Option<string> => {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error)
  if (issues.length === 0) {
    return Option.none()
  }
  return Option.some(issues[0].message)
}

// ================================
// Field Component Factory
// ================================

const makeFieldComponent = <S extends Schema.Schema.Any>(
  fieldKey: string,
  fieldDef: Form.FieldDef<S>,
  stateAtom: Atom.Writable<Form.FormState<any>, any>,
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
  validationMode: ValidationMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  Component: React.FC<FieldComponentProps<S>>,
): React.FC => {
  const FieldComponent: React.FC = () => {
    const arrayCtx = useContext(ArrayItemContext)
    const [formState, setFormState] = useAtom(stateAtom)
    const [crossFieldErrors, setCrossFieldErrors] = useAtom(crossFieldErrorsAtom)

    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey

    const validationAtom = React.useMemo(
      () => getOrCreateValidationAtom(fieldPath, fieldDef.schema),
      [fieldPath],
    )
    const validationResult = useAtomValue(validationAtom)
    const validate = useAtomSet(validationAtom)

    const value = getNestedValue(formState.values, fieldPath) as Schema.Schema.Encoded<S>
    const initialValue = getNestedValue(formState.initialValues, fieldPath) as Schema.Schema.Encoded<S>
    const isTouched = (getNestedValue(formState.touched, fieldPath) ?? false) as boolean

    const perFieldError: Option.Option<string> = React.useMemo(() => {
      if (validationResult._tag === "Failure") {
        const parseError = Cause.failureOption(validationResult.cause)
        if (Option.isSome(parseError) && ParseResult.isParseError(parseError.value)) {
          return extractFirstError(parseError.value)
        }
      }
      return Option.none()
    }, [validationResult])

    const crossFieldError: Option.Option<string> = React.useMemo(() => {
      const error = crossFieldErrors.get(fieldPath)
      return error !== undefined ? Option.some(error) : Option.none()
    }, [crossFieldErrors, fieldPath])

    const validationError = Option.isSome(perFieldError) ? perFieldError : crossFieldError

    const onChange = React.useCallback(
      (newValue: Schema.Schema.Encoded<S>) => {
        setFormState((prev: Form.FormState<any>) => ({
          ...prev,
          values: setNestedValue(prev.values, fieldPath, newValue),
        }))
        setCrossFieldErrors((prev) => {
          if (prev.has(fieldPath)) {
            const next = new Map(prev)
            next.delete(fieldPath)
            return next
          }
          return prev
        })
        if (validationMode === "onChange") {
          validate(newValue)
        }
      },
      [fieldPath, setFormState, setCrossFieldErrors, validate],
    )

    const onBlur = React.useCallback(() => {
      setFormState((prev: Form.FormState<any>) => ({
        ...prev,
        touched: setNestedValue(prev.touched, fieldPath, true),
      }))
      if (validationMode === "onBlur") {
        validate(value)
      }
    }, [fieldPath, setFormState, validate, value])

    const isDirty = !Equal.equals(value, initialValue)
    const isValidating = validationResult.waiting

    return (
      <Component
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={isTouched ? validationError : Option.none<string>()}
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
  def: Form.ArrayFieldDef<Form.FormBuilder<TItemFields, any>>,
  stateAtom: Atom.Writable<Form.FormState<any>, any>,
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
  validationMode: ValidationMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  componentMap: FieldComponentMap<TItemFields>,
): ArrayFieldComponent<TItemFields> => {
  const ArrayWrapper: React.FC<{
    readonly children: (ops: ArrayFieldOperations<Form.EncodedFromFields<TItemFields>>) => React.ReactNode
  }> = ({ children }) => {
    const arrayCtx = useContext(ArrayItemContext)
    const [formState, setFormState] = useAtom(stateAtom)

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
        setFormState((prev: Form.FormState<any>) => ({
          ...prev,
          values: setNestedValue(prev.values, fieldPath, [...items, newItem]),
        }))
      },
      [fieldPath, items, setFormState],
    )

    const remove = React.useCallback(
      (index: number) => {
        setFormState((prev: Form.FormState<any>) => ({
          ...prev,
          values: setNestedValue(
            prev.values,
            fieldPath,
            items.filter((_, i) => i !== index),
          ),
        }))
      },
      [fieldPath, items, setFormState],
    )

    const swap = React.useCallback(
      (indexA: number, indexB: number) => {
        const newItems = [...items]
        const temp = newItems[indexA]
        newItems[indexA] = newItems[indexB]
        newItems[indexB] = temp
        setFormState((prev: Form.FormState<any>) => ({
          ...prev,
          values: setNestedValue(prev.values, fieldPath, newItems),
        }))
      },
      [fieldPath, items, setFormState],
    )

    const move = React.useCallback(
      (from: number, to: number) => {
        const newItems = [...items]
        const [item] = newItems.splice(from, 1)
        newItems.splice(to, 0, item)
        setFormState((prev: Form.FormState<any>) => ({
          ...prev,
          values: setNestedValue(prev.values, fieldPath, newItems),
        }))
      },
      [fieldPath, items, setFormState],
    )

    return <>{children({ items, append, remove, swap, move })}</>
  }

  const ItemWrapper: React.FC<{
    readonly index: number
    readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
  }> = ({ children, index }) => {
    const arrayCtx = useContext(ArrayItemContext)
    const [formState, setFormState] = useAtom(stateAtom)

    const parentPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey
    const itemPath = `${parentPath}[${index}]`

    const items = React.useMemo(
      () => getNestedValue(formState.values, parentPath) ?? [],
      [formState.values, parentPath],
    )

    const remove = React.useCallback(() => {
      setFormState((prev: Form.FormState<any>) => ({
        ...prev,
        values: setNestedValue(
          prev.values,
          parentPath,
          (items as Array<any>).filter((_, i) => i !== index),
        ),
      }))
    }, [parentPath, items, index, setFormState])

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
        stateAtom,
        crossFieldErrorsAtom,
        validationMode,
        getOrCreateValidationAtom,
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
  stateAtom: Atom.Writable<Form.FormState<TFields>, any>,
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
  validationMode: ValidationMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
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
        validationMode,
        getOrCreateValidationAtom,
        arrayComponentMap,
      )
    } else if (Form.isFieldDef(def)) {
      const fieldComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any>>>)[key]
      components[key] = makeFieldComponent(
        key,
        def,
        stateAtom,
        crossFieldErrorsAtom,
        validationMode,
        getOrCreateValidationAtom,
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
    readonly validationMode?: ValidationMode
  },
): BuiltForm<TFields, R> => {
  const { fields: components, runtime, validationMode = "onSubmit" } = options
  const { fields } = self

  const combinedSchema = Form.buildSchema(self)

  const initialState: Form.FormState<TFields> = {
    values: Form.getDefaultEncodedValues(fields) as Form.EncodedFromFields<TFields>,
    initialValues: Form.getDefaultEncodedValues(fields) as Form.EncodedFromFields<TFields>,
    touched: Form.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
    submitCount: 0,
  }

  const stateAtom = Atom.make(initialState).pipe(Atom.setIdleTTL(0))
  const crossFieldErrorsAtom = Atom.make<Map<string, string>>(new Map()).pipe(Atom.setIdleTTL(0))
  const onSubmitAtom = Atom.make<Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown> | null>(null)
    .pipe(Atom.setIdleTTL(0))

  const validationAtomsRegistry: ValidationAtomRegistry = new Map()

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
    ) as Atom.AtomResultFn<unknown, void, ParseResult.ParseError>

    validationAtomsRegistry.set(fieldPath, validationAtom)
    return validationAtom
  }

  const decodeAndSubmit = runtime.fn<Form.EncodedFromFields<TFields>>()((values, get) =>
    pipe(
      Schema.decodeUnknown(combinedSchema)(values) as Effect.Effect<
        Form.DecodedFromFields<TFields>,
        ParseResult.ParseError,
        R
      >,
      Effect.tap((decoded) =>
        Effect.sync(() => {
          const onSubmit = get(onSubmitAtom)
          if (onSubmit) {
            get.set(onSubmit, decoded)
          }
        })
      ),
      Effect.asVoid,
    )
  ) as Atom.AtomResultFn<Form.EncodedFromFields<TFields>, void, ParseResult.ParseError>

  const FormComponent: React.FC<{
    readonly defaultValues: Form.EncodedFromFields<TFields>
    readonly onSubmit: Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown>
    readonly debounce?: Duration.DurationInput
    readonly children: React.ReactNode
  }> = ({ children, defaultValues, onSubmit }) => {
    const setFormState = useAtomSet(stateAtom)
    const setOnSubmit = useAtomSet(onSubmitAtom)

    React.useEffect(() => {
      setOnSubmit(onSubmit)
    }, [onSubmit, setOnSubmit])

    React.useEffect(() => {
      setFormState({
        values: defaultValues,
        initialValues: defaultValues,
        touched: Form.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
        submitCount: 0,
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only initialization
    }, [])

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        {children}
      </form>
    )
  }

  const useFormHook = () => {
    const [formState, setFormState] = useAtom(stateAtom)
    const setCrossFieldErrors = useAtomSet(crossFieldErrorsAtom)
    const [decodeAndSubmitResult, callDecodeAndSubmit] = useAtom(decodeAndSubmit)

    React.useEffect(() => {
      if (decodeAndSubmitResult._tag === "Failure") {
        const parseError = Cause.failureOption(decodeAndSubmitResult.cause)
        if (Option.isSome(parseError) && ParseResult.isParseError(parseError.value)) {
          const issues = ParseResult.ArrayFormatter.formatErrorSync(parseError.value)

          const fieldErrors = new Map<string, string>()
          for (const issue of issues) {
            if (issue.path.length > 0) {
              const fieldPath = String(issue.path[0])
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
      setCrossFieldErrors(new Map())

      setFormState((prev: Form.FormState<any>) => ({
        ...prev,
        touched: Form.createTouchedRecord(fields, true) as { readonly [K in keyof TFields]: boolean },
      }))

      callDecodeAndSubmit(formState.values)
    }, [formState.values, setFormState, callDecodeAndSubmit, setCrossFieldErrors])

    const isDirty = !Equal.equals(formState.values, formState.initialValues)
    const isSubmitting = decodeAndSubmitResult.waiting

    return { submit, isDirty, isSubmitting }
  }

  const SubscribeComponent: React.FC<{
    readonly children: (state: SubscribeState<TFields>) => React.ReactNode
  }> = ({ children }) => {
    const { isDirty, isSubmitting, submit } = useFormHook()
    const formState = useAtomValue(stateAtom)

    return <>{children({ values: formState.values, isDirty, isSubmitting, submit })}</>
  }

  const submitHelper = <A, E>(
    fn: (values: Form.DecodedFromFields<TFields>, get: Atom.FnContext) => Effect.Effect<A, E, R>,
  ) => runtime.fn<Form.DecodedFromFields<TFields>>()(fn) as Atom.AtomResultFn<Form.DecodedFromFields<TFields>, A, E>

  const fieldComponents = makeFieldComponents(
    fields,
    stateAtom,
    crossFieldErrorsAtom,
    validationMode,
    getOrCreateValidationAtom,
    components,
  )

  return {
    atom: stateAtom,
    schema: combinedSchema,
    Form: FormComponent,
    Subscribe: SubscribeComponent,
    useForm: useFormHook,
    submit: submitHelper,
    ...fieldComponents,
  } as BuiltForm<TFields, R>
}
