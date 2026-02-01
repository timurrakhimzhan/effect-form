import { useAtom, useAtomMount, useAtomSet, useAtomSubscribe, useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import { Field, FormAtoms } from "@lucas-barake/effect-form"
import type * as FormBuilder from "@lucas-barake/effect-form/FormBuilder"
import type * as Mode from "@lucas-barake/effect-form/Mode"
import { getNestedValue, isPathOrParentDirty } from "@lucas-barake/effect-form/Path"
import type * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as ParseResult from "effect/ParseResult"
import type * as Schema from "effect/Schema"
import * as AST from "effect/SchemaAST"
import * as React from "react"
import { createContext, useContext } from "react"

export type FieldValue<T> = T extends Schema.Schema.Any ? Schema.Schema.Encoded<T> : T

export interface FieldState<E> {
  readonly value: E
  readonly onChange: (value: E) => void
  readonly onBlur: () => void
  readonly error: Option.Option<string>
  readonly isTouched: boolean
  readonly isValidating: boolean
  readonly isDirty: boolean
}

export interface FieldComponentProps<E, P = Record<string, never>> {
  readonly field: FieldState<E>
  readonly props: P
}

export type FieldComponent<T, P = Record<string, never>> = React.FC<FieldComponentProps<FieldValue<T>, P>>

export type ExtractExtraProps<C> = C extends React.FC<FieldComponentProps<any, infer P>> ? P : Record<string, never>

/**
 * Helper type to extract struct fields from a schema, handling filter/refine wrappers.
 * Follows Effect's HasFields pattern: Schema.Struct or { [RefineSchemaId]: HasFields }
 */
type ExtractStructFields<S extends Schema.Schema.Any> =
  S extends Schema.Struct<infer Fields> ? Fields
  : S extends { readonly [Schema.RefineSchemaId]: infer From }
    ? From extends Schema.Schema.Any ? ExtractStructFields<From> : never
  : never

export type ArrayItemComponentMap<S extends Schema.Schema.Any> =
  ExtractStructFields<S> extends never
    ? React.FC<FieldComponentProps<Schema.Schema.Encoded<S>, any>>
    : {
        readonly [K in keyof ExtractStructFields<S>]: ExtractStructFields<S>[K] extends Schema.Schema.Any
          ? React.FC<FieldComponentProps<Schema.Schema.Encoded<ExtractStructFields<S>[K]>, any>>
          : never
      }

export type FieldComponentMap<TFields extends Field.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S>
    ? React.FC<FieldComponentProps<Schema.Schema.Encoded<S>, any>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S, any> ? ArrayItemComponentMap<S>
    : never
}

export type FieldRefs<TFields extends Field.FieldsRecord> = FormAtoms.FieldRefs<TFields>

export interface ArrayFieldOperations<TItem> {
  readonly items: ReadonlyArray<TItem>
  readonly append: (value?: TItem) => void
  readonly remove: (index: number) => void
  readonly swap: (indexA: number, indexB: number) => void
  readonly move: (from: number, to: number) => void
}

export type BuiltForm<
  TFields extends Field.FieldsRecord,
  R,
  A = void,
  E = never,
  SubmitArgs = void,
  CM extends FieldComponentMap<TFields> = FieldComponentMap<TFields>,
> = {
  readonly values: Atom.Atom<Option.Option<Field.EncodedFromFields<TFields>>>
  readonly isDirty: Atom.Atom<boolean>
  readonly hasChangedSinceSubmit: Atom.Atom<boolean>
  readonly lastSubmittedValues: Atom.Atom<Option.Option<FormBuilder.SubmittedValues<TFields>>>
  readonly submitCount: Atom.Atom<number>

  readonly schema: Schema.Schema<Field.DecodedFromFields<TFields>, Field.EncodedFromFields<TFields>, R>
  readonly fields: FieldRefs<TFields>

  readonly Initialize: React.FC<{
    readonly defaultValues: Field.EncodedFromFields<TFields>
    readonly children: React.ReactNode
  }>

  readonly submit: Atom.AtomResultFn<SubmitArgs, A, E | ParseResult.ParseError>
  readonly reset: Atom.Writable<void, void>
  readonly revertToLastSubmit: Atom.Writable<void, void>
  readonly setValues: Atom.Writable<void, Field.EncodedFromFields<TFields>>
  readonly setValue: <S>(field: FormBuilder.FieldRef<S> | FormBuilder.ArrayFieldRef<S>) => Atom.Writable<void, S | ((prev: S) => S)>
  readonly getFieldAtom: {
    <S>(field: FormBuilder.FieldRef<S>): Atom.Atom<Option.Option<S>>
    <S>(field: FormBuilder.ArrayFieldRef<S>): Atom.Atom<Option.Option<ReadonlyArray<S>>>
  }
  readonly getField: <S>(field: FormBuilder.FieldRef<S>) => FormAtoms.PublicFieldAtoms<S>
  readonly getArrayField: <S>(field: FormBuilder.ArrayFieldRef<S>) => FormAtoms.PublicArrayFieldAtoms<S>

  readonly mount: Atom.Atom<void>
  readonly KeepAlive: React.FC
} & FieldComponents<TFields, CM>

type FieldComponents<TFields extends Field.FieldsRecord, CM extends FieldComponentMap<TFields>> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, any> ? React.FC<ExtractExtraProps<CM[K]>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S, any>
      ? ArrayFieldComponent<S, ExtractArrayItemExtraProps<CM[K], S>>
    : never
}

type ExtractArrayItemExtraProps<CM, S extends Schema.Schema.Any> =
  ExtractStructFields<S> extends never
    ? CM extends React.FC<FieldComponentProps<any, infer P>> ? P : never
    : { readonly [K in keyof ExtractStructFields<S>]: CM extends { readonly [P in K]: infer C } ? ExtractExtraProps<C> : never }

type ArrayFieldComponent<S extends Schema.Schema.Any, ExtraPropsMap> =
  & React.FC<{
    readonly children: (ops: ArrayFieldOperations<Schema.Schema.Encoded<S>>) => React.ReactNode
  }>
  & {
    readonly Item: React.FC<{
      readonly index: number
      readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
    }>
  }
  & (ExtractStructFields<S> extends never ? unknown : {
      readonly [K in keyof ExtractStructFields<S>]: React.FC<
        ExtraPropsMap extends { readonly [P in K]: infer EP } ? EP : Record<string, never>
      >
    })

interface ArrayItemContextValue {
  readonly index: number
  readonly parentPath: string
}

const ArrayItemContext = createContext<ArrayItemContextValue | null>(null)
const AutoSubmitContext = createContext<(() => void) | null>(null)

const makeFieldComponent = <S extends Schema.Schema.Any, P>(
  fieldKey: string,
  _fieldDef: Field.FieldDef<string, S>,
  dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>,
  getOrCreateFieldAtoms: (fieldPath: string) => FormAtoms.FieldAtoms,
  Component: React.FC<FieldComponentProps<Schema.Schema.Encoded<S>, P>>,
): React.FC<P> => {
  const FieldComponent: React.FC<P> = (extraProps) => {
    const arrayCtx = useContext(ArrayItemContext)
    const autoSubmitOnBlur = useContext(AutoSubmitContext)
    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey

    const fieldAtoms = React.useMemo(
      () => getOrCreateFieldAtoms(fieldPath),
      [fieldPath],
    )

    // Read from atoms - all logic is in FormAtoms
    const value = useAtomValue(fieldAtoms.valueAtom) as Schema.Schema.Encoded<S>
    const isTouched = useAtomValue(fieldAtoms.touchedAtom)
    const visibleError = useAtomValue(fieldAtoms.visibleErrorAtom)
    const isValidating = useAtomValue(fieldAtoms.isValidatingAtom)
    const dirtyFields = useAtomValue(dirtyFieldsAtom)

    // Write to atoms - handlers just call atom setters
    const setOnChange = useAtomSet(fieldAtoms.onChangeAtom)
    const setOnBlur = useAtomSet(fieldAtoms.onBlurAtom)

    const onChange = React.useCallback(
      (newValue: Schema.Schema.Encoded<S>) => {
        setOnChange(newValue)
      },
      [setOnChange],
    )

    const onBlur = React.useCallback(() => {
      setOnBlur()
      autoSubmitOnBlur?.()
    }, [setOnBlur, autoSubmitOnBlur])

    const isDirty = React.useMemo(
      () => isPathOrParentDirty(dirtyFields, fieldPath),
      [dirtyFields, fieldPath],
    )

    const fieldState: FieldState<Schema.Schema.Encoded<S>> = React.useMemo(() => ({
      value,
      onChange,
      onBlur,
      error: visibleError,
      isTouched,
      isValidating,
      isDirty,
    }), [value, onChange, onBlur, visibleError, isTouched, isValidating, isDirty])

    return <Component field={fieldState} props={extraProps} />
  }

  return React.memo(FieldComponent) as React.FC<P>
}

/**
 * Helper to extract TypeLiteral AST from a schema, unwrapping refinements if present.
 * Returns the TypeLiteral if found, otherwise undefined.
 */
const extractTypeLiteralAST = (ast: AST.AST): AST.TypeLiteral | undefined => {
  if (AST.isTypeLiteral(ast)) {
    return ast
  }
  if (AST.isRefinement(ast)) {
    return extractTypeLiteralAST(ast.from)
  }
  return undefined
}

const makeArrayFieldComponent = <S extends Schema.Schema.Any>(
  fieldKey: string,
  def: Field.ArrayFieldDef<string, S>,
  stateAtom: Atom.Writable<
    Option.Option<FormBuilder.FormState<Field.FieldsRecord>>,
    Option.Option<FormBuilder.FormState<Field.FieldsRecord>>
  >,
  dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>,
  getOrCreateFieldAtoms: (fieldPath: string) => FormAtoms.FieldAtoms,
  operations: FormAtoms.FormOperations<Field.FieldsRecord>,
  componentMap: ArrayItemComponentMap<S>,
): ArrayFieldComponent<S, unknown> => {
  const structAST = extractTypeLiteralAST(def.itemSchema.ast)

  const ArrayWrapper: React.FC<{
    readonly children: (ops: ArrayFieldOperations<Schema.Schema.Encoded<S>>) => React.ReactNode
  }> = ({ children }) => {
    const arrayCtx = useContext(ArrayItemContext)
    const [formStateOption, setFormState] = useAtom(stateAtom)
    const formState = Option.getOrThrow(formStateOption)

    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey
    const items = React.useMemo(
      () => (getNestedValue(formState.values, fieldPath) ?? []) as ReadonlyArray<Schema.Schema.Encoded<S>>,
      [formState.values, fieldPath],
    )

    // Get array field atoms for triggering validation after operations
    const arrayFieldAtoms = React.useMemo(
      () => getOrCreateFieldAtoms(fieldPath),
      [fieldPath],
    )
    const triggerArrayValidation = useAtomSet(arrayFieldAtoms.triggerValidationAtom)

    const append = React.useCallback(
      (value?: Schema.Schema.Encoded<S>) => {
        setFormState((prev: Option.Option<FormBuilder.FormState<Field.FieldsRecord>>) => {
          if (Option.isNone(prev)) return prev
          let newState = operations.appendArrayItem(prev.value, fieldPath, def.itemSchema, value)
          // Mark array as touched since user interacted with it
          newState = operations.setFieldTouched(newState, fieldPath, true)
          // Trigger array validation after append
          const newArrayValue = getNestedValue(newState.values, fieldPath)
          setTimeout(() => triggerArrayValidation(newArrayValue), 0)
          return Option.some(newState)
        })
      },
      [fieldPath, setFormState, triggerArrayValidation],
    )

    const remove = React.useCallback(
      (index: number) => {
        setFormState((prev: Option.Option<FormBuilder.FormState<Field.FieldsRecord>>) => {
          if (Option.isNone(prev)) return prev
          let newState = operations.removeArrayItem(prev.value, fieldPath, index)
          // Mark array as touched since user interacted with it
          newState = operations.setFieldTouched(newState, fieldPath, true)
          // Trigger array validation after remove
          const newArrayValue = getNestedValue(newState.values, fieldPath)
          setTimeout(() => triggerArrayValidation(newArrayValue), 0)
          return Option.some(newState)
        })
      },
      [fieldPath, setFormState, triggerArrayValidation],
    )

    const swap = React.useCallback(
      (indexA: number, indexB: number) => {
        setFormState((prev: Option.Option<FormBuilder.FormState<Field.FieldsRecord>>) => {
          if (Option.isNone(prev)) return prev
          let newState = operations.swapArrayItems(prev.value, fieldPath, indexA, indexB)
          // Mark array as touched since user interacted with it
          newState = operations.setFieldTouched(newState, fieldPath, true)
          // Trigger array validation after swap
          const newArrayValue = getNestedValue(newState.values, fieldPath)
          setTimeout(() => triggerArrayValidation(newArrayValue), 0)
          return Option.some(newState)
        })
      },
      [fieldPath, setFormState, triggerArrayValidation],
    )

    const move = React.useCallback(
      (from: number, to: number) => {
        setFormState((prev: Option.Option<FormBuilder.FormState<Field.FieldsRecord>>) => {
          if (Option.isNone(prev)) return prev
          let newState = operations.moveArrayItem(prev.value, fieldPath, from, to)
          // Mark array as touched since user interacted with it
          newState = operations.setFieldTouched(newState, fieldPath, true)
          // Trigger array validation after move
          const newArrayValue = getNestedValue(newState.values, fieldPath)
          setTimeout(() => triggerArrayValidation(newArrayValue), 0)
          return Option.some(newState)
        })
      },
      [fieldPath, setFormState, triggerArrayValidation],
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

    // Get array field atoms for triggering validation after remove
    const arrayFieldAtoms = React.useMemo(
      () => getOrCreateFieldAtoms(parentPath),
      [parentPath],
    )
    const triggerArrayValidation = useAtomSet(arrayFieldAtoms.triggerValidationAtom)

    const remove = React.useCallback(() => {
      setFormState((prev: Option.Option<FormBuilder.FormState<Field.FieldsRecord>>) => {
        if (Option.isNone(prev)) return prev
        let newState = operations.removeArrayItem(prev.value, parentPath, index)
        // Mark array as touched since user interacted with it
        newState = operations.setFieldTouched(newState, parentPath, true)
        // Trigger array validation after remove
        const newArrayValue = getNestedValue(newState.values, parentPath)
        setTimeout(() => triggerArrayValidation(newArrayValue), 0)
        return Option.some(newState)
      })
    }, [parentPath, index, setFormState, triggerArrayValidation])

    return (
      <ArrayItemContext.Provider value={{ index, parentPath: itemPath }}>
        {typeof children === "function" ? children({ remove }) : children}
      </ArrayItemContext.Provider>
    )
  }

  const itemFieldComponents: Record<string, React.FC> = {}

  if (structAST !== undefined) {
    for (const prop of structAST.propertySignatures) {
      const itemKey = prop.name as string
      const itemSchema = { ast: prop.type } as Schema.Schema.Any
      const itemDef = Field.makeField(itemKey, itemSchema)
      const itemComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any, any>>>)[itemKey]
      itemFieldComponents[itemKey] = makeFieldComponent(
        itemKey,
        itemDef,
        dirtyFieldsAtom,
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
  }) as ArrayFieldComponent<S, any>
}

const makeFieldComponents = <
  TFields extends Field.FieldsRecord,
  CM extends FieldComponentMap<TFields>,
>(
  fields: TFields,
  stateAtom: Atom.Writable<
    Option.Option<FormBuilder.FormState<TFields>>,
    Option.Option<FormBuilder.FormState<TFields>>
  >,
  dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>,
  getOrCreateFieldAtoms: (fieldPath: string) => FormAtoms.FieldAtoms,
  operations: FormAtoms.FormOperations<TFields>,
  componentMap: CM,
): FieldComponents<TFields, CM> => {
  const components: Record<string, unknown> = {}

  for (const [key, def] of Object.entries(fields)) {
    if (Field.isArrayFieldDef(def)) {
      const arrayComponentMap = (componentMap as Record<string, unknown>)[key]
      components[key] = makeArrayFieldComponent(
        key,
        def as Field.ArrayFieldDef<string, Schema.Schema.Any>,
        stateAtom as Atom.Writable<
          Option.Option<FormBuilder.FormState<Field.FieldsRecord>>,
          Option.Option<FormBuilder.FormState<Field.FieldsRecord>>
        >,
        dirtyFieldsAtom,
        getOrCreateFieldAtoms,
        operations as FormAtoms.FormOperations<Field.FieldsRecord>,
        arrayComponentMap as ArrayItemComponentMap<Schema.Schema.Any>,
      )
    } else if (Field.isFieldDef(def)) {
      const fieldComponent = (componentMap as Record<string, React.FC<FieldComponentProps<unknown, unknown>>>)[key]
      components[key] = makeFieldComponent(
        key,
        def,
        dirtyFieldsAtom,
        getOrCreateFieldAtoms,
        fieldComponent,
      )
    }
  }

  return components as FieldComponents<TFields, CM>
}

export const make: {
  <
    TFields extends Field.FieldsRecord,
    A,
    E,
    SubmitArgs = void,
    CM extends FieldComponentMap<TFields> = FieldComponentMap<TFields>,
  >(
    self: FormBuilder.FormBuilder<TFields, never>,
    options: {
      readonly runtime?: Atom.AtomRuntime<never, never>
      readonly fields: CM
      readonly mode?: SubmitArgs extends void ? Mode.FormMode : Mode.FormModeWithoutAutoSubmit
      readonly onSubmit: (
        args: SubmitArgs,
        ctx: {
          readonly decoded: Field.DecodedFromFields<TFields>
          readonly encoded: Field.EncodedFromFields<TFields>
          readonly get: Atom.FnContext
        },
      ) => A | Effect.Effect<A, E, never>
    },
  ): BuiltForm<TFields, never, A, E, SubmitArgs, CM>

  <
    TFields extends Field.FieldsRecord,
    R,
    A,
    E,
    SubmitArgs = void,
    ER = never,
    CM extends FieldComponentMap<TFields> = FieldComponentMap<TFields>,
  >(
    self: FormBuilder.FormBuilder<TFields, R>,
    options: {
      readonly runtime: Atom.AtomRuntime<R, ER>
      readonly fields: CM
      readonly mode?: SubmitArgs extends void ? Mode.FormMode : Mode.FormModeWithoutAutoSubmit
      readonly onSubmit: (
        args: SubmitArgs,
        ctx: {
          readonly decoded: Field.DecodedFromFields<TFields>
          readonly encoded: Field.EncodedFromFields<TFields>
          readonly get: Atom.FnContext
        },
      ) => A | Effect.Effect<A, E, R>
    },
  ): BuiltForm<TFields, R, A, E, SubmitArgs, CM>
} = (self: any, options: any): any => {
  const { fields: components, mode, onSubmit, runtime: providedRuntime } = options
  const runtime = providedRuntime ?? Atom.runtime(Layer.empty)
  const { fields } = self

  const formAtoms = FormAtoms.make({
    formBuilder: self,
    runtime,
    onSubmit,
    mode,
  })

  const {
    autoSubmitReadyAtom,
    autoSubmitRequestIdAtom,
    combinedSchema,
    dirtyFieldsAtom,
    fieldRefs,
    flushAutoSubmitPendingAtom,
    getArrayField,
    getField,
    getFieldAtom,
    getOrCreateFieldAtoms,
    hasChangedSinceSubmitAtom,
    initializeAtom,
    isAutoSubmitDebouncingAtom,
    isDirtyAtom,
    keepAliveActiveAtom,
    lastSubmittedValuesAtom,
    mountAtom,
    operations,
    resetAtom,
    revertToLastSubmitAtom,
    rootErrorAtom,
    setValue,
    setValuesAtom,
    stateAtom,
    submitAtom,
    submitCountAtom,
    triggerAutoSubmitOnBlurAtom,
    valuesAtom,
  } = formAtoms

  const InitializeComponent: React.FC<{
    readonly defaultValues: any
    readonly children: React.ReactNode
  }> = ({ children, defaultValues }) => {
    const state = useAtomValue(stateAtom)
    const callInitialize = useAtomSet(initializeAtom)
    const callSubmit = useAtomSet(submitAtom)
    const callFlushAutoSubmitPending = useAtomSet(flushAutoSubmitPendingAtom)
    const callTriggerAutoSubmitOnBlur = useAtomSet(triggerAutoSubmitOnBlurAtom)
    const setAutoSubmitReady = useAtomSet(autoSubmitReadyAtom)
    const wasSubmittingRef = React.useRef(false)
    const lastRequestIdRef = React.useRef(0)

    // Subscribe to keep debounced auto-submit effect alive
    useAtomValue(isAutoSubmitDebouncingAtom)

    // Initialize on mount - all logic is in FormAtoms
    React.useEffect(() => {
      callInitialize(defaultValues)
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
    }, [callInitialize])

    // Subscribe to auto-submit request - when FormAtoms signals ready, call submit
    // All debouncing logic is in FormAtoms; React just executes the submit
    useAtomSubscribe(
      autoSubmitRequestIdAtom,
      React.useCallback(
        (requestId) => {
          if (requestId > lastRequestIdRef.current) {
            lastRequestIdRef.current = requestId
            setAutoSubmitReady(false)
            callSubmit(undefined)
          }
        },
        [callSubmit, setAutoSubmitReady],
      ),
      { immediate: false },
    )

    // Subscribe to submit completion - flush pending auto-submit when submit completes
    useAtomSubscribe(
      submitAtom,
      React.useCallback(
        (result) => {
          const wasSubmitting = wasSubmittingRef.current
          wasSubmittingRef.current = result.waiting
          callFlushAutoSubmitPending(wasSubmitting)
        },
        [callFlushAutoSubmitPending],
      ),
      { immediate: false },
    )

    if (Option.isNone(state)) return null

    return <AutoSubmitContext.Provider value={callTriggerAutoSubmitOnBlur}>{children}</AutoSubmitContext.Provider>
  }

  const fieldComponents = makeFieldComponents(
    fields,
    stateAtom,
    dirtyFieldsAtom,
    getOrCreateFieldAtoms,
    operations,
    components as FieldComponentMap<Field.FieldsRecord>,
  )

  const KeepAlive: React.FC = () => {
    const setKeepAliveActive = useAtomSet(keepAliveActiveAtom)

    React.useLayoutEffect(() => {
      setKeepAliveActive(true)
      return () => setKeepAliveActive(false)
    }, [setKeepAliveActive])

    useAtomMount(mountAtom)
    return null
  }

  return {
    values: valuesAtom,
    isDirty: isDirtyAtom,
    hasChangedSinceSubmit: hasChangedSinceSubmitAtom,
    lastSubmittedValues: lastSubmittedValuesAtom,
    submitCount: submitCountAtom,
    rootError: rootErrorAtom,
    schema: combinedSchema,
    fields: fieldRefs,
    Initialize: InitializeComponent,
    submit: submitAtom,
    reset: resetAtom,
    revertToLastSubmit: revertToLastSubmitAtom,
    setValues: setValuesAtom,
    setValue,
    getFieldAtom,
    getField,
    getArrayField,
    mount: mountAtom,
    KeepAlive,
    ...fieldComponents,
  }
}
