import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useAtom, useAtomMount, useAtomSet, useAtomSubscribe, useAtomValue } from "@effect-atom/atom-react";
import * as Atom from "@effect-atom/atom/Atom";
import { Field, FormAtoms } from "@lucas-barake/effect-form";
import { getNestedValue, isPathOrParentDirty } from "@lucas-barake/effect-form/Path";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as AST from "effect/SchemaAST";
import * as React from "react";
import { createContext, useContext } from "react";
const ArrayItemContext = /*#__PURE__*/createContext(null);
const AutoSubmitContext = /*#__PURE__*/createContext(null);
const makeFieldComponent = (fieldKey, _fieldDef, dirtyFieldsAtom, getOrCreateFieldAtoms, Component) => {
  const FieldComponent = extraProps => {
    const arrayCtx = useContext(ArrayItemContext);
    const autoSubmitOnBlur = useContext(AutoSubmitContext);
    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey;
    const fieldAtoms = React.useMemo(() => getOrCreateFieldAtoms(fieldPath), [fieldPath]);
    // Read from atoms - all logic is in FormAtoms
    const value = useAtomValue(fieldAtoms.valueAtom);
    const isTouched = useAtomValue(fieldAtoms.touchedAtom);
    const visibleError = useAtomValue(fieldAtoms.visibleErrorAtom);
    const isValidating = useAtomValue(fieldAtoms.isValidatingAtom);
    const dirtyFields = useAtomValue(dirtyFieldsAtom);
    // Write to atoms - handlers just call atom setters
    const setOnChange = useAtomSet(fieldAtoms.onChangeAtom);
    const setOnBlur = useAtomSet(fieldAtoms.onBlurAtom);
    const onChange = React.useCallback(newValue => {
      setOnChange(newValue);
    }, [setOnChange]);
    const onBlur = React.useCallback(() => {
      setOnBlur();
      autoSubmitOnBlur?.();
    }, [setOnBlur, autoSubmitOnBlur]);
    const isDirty = React.useMemo(() => isPathOrParentDirty(dirtyFields, fieldPath), [dirtyFields, fieldPath]);
    const fieldState = React.useMemo(() => ({
      value,
      onChange,
      onBlur,
      error: visibleError,
      isTouched,
      isValidating,
      isDirty
    }), [value, onChange, onBlur, visibleError, isTouched, isValidating, isDirty]);
    return _jsx(Component, {
      field: fieldState,
      props: extraProps
    });
  };
  return React.memo(FieldComponent);
};
/**
 * Helper to extract TypeLiteral AST from a schema, unwrapping refinements if present.
 * Returns the TypeLiteral if found, otherwise undefined.
 */
const extractTypeLiteralAST = ast => {
  if (AST.isTypeLiteral(ast)) {
    return ast;
  }
  if (AST.isRefinement(ast)) {
    return extractTypeLiteralAST(ast.from);
  }
  return undefined;
};
const makeArrayFieldComponent = (fieldKey, def, stateAtom, dirtyFieldsAtom, getOrCreateFieldAtoms, operations, componentMap) => {
  const structAST = extractTypeLiteralAST(def.itemSchema.ast);
  const ArrayWrapper = ({
    children
  }) => {
    const arrayCtx = useContext(ArrayItemContext);
    const [formStateOption, setFormState] = useAtom(stateAtom);
    const formState = Option.getOrThrow(formStateOption);
    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey;
    const items = React.useMemo(() => getNestedValue(formState.values, fieldPath) ?? [], [formState.values, fieldPath]);
    // Get array field atoms for triggering validation after operations
    const arrayFieldAtoms = React.useMemo(() => getOrCreateFieldAtoms(fieldPath), [fieldPath]);
    const triggerArrayValidation = useAtomSet(arrayFieldAtoms.triggerValidationAtom);
    const append = React.useCallback(value => {
      setFormState(prev => {
        if (Option.isNone(prev)) return prev;
        let newState = operations.appendArrayItem(prev.value, fieldPath, def.itemSchema, value);
        // Mark array as touched since user interacted with it
        newState = operations.setFieldTouched(newState, fieldPath, true);
        // Trigger array validation after append
        const newArrayValue = getNestedValue(newState.values, fieldPath);
        setTimeout(() => triggerArrayValidation(newArrayValue), 0);
        return Option.some(newState);
      });
    }, [fieldPath, setFormState, triggerArrayValidation]);
    const remove = React.useCallback(index => {
      setFormState(prev => {
        if (Option.isNone(prev)) return prev;
        let newState = operations.removeArrayItem(prev.value, fieldPath, index);
        // Mark array as touched since user interacted with it
        newState = operations.setFieldTouched(newState, fieldPath, true);
        // Trigger array validation after remove
        const newArrayValue = getNestedValue(newState.values, fieldPath);
        setTimeout(() => triggerArrayValidation(newArrayValue), 0);
        return Option.some(newState);
      });
    }, [fieldPath, setFormState, triggerArrayValidation]);
    const swap = React.useCallback((indexA, indexB) => {
      setFormState(prev => {
        if (Option.isNone(prev)) return prev;
        let newState = operations.swapArrayItems(prev.value, fieldPath, indexA, indexB);
        // Mark array as touched since user interacted with it
        newState = operations.setFieldTouched(newState, fieldPath, true);
        // Trigger array validation after swap
        const newArrayValue = getNestedValue(newState.values, fieldPath);
        setTimeout(() => triggerArrayValidation(newArrayValue), 0);
        return Option.some(newState);
      });
    }, [fieldPath, setFormState, triggerArrayValidation]);
    const move = React.useCallback((from, to) => {
      setFormState(prev => {
        if (Option.isNone(prev)) return prev;
        let newState = operations.moveArrayItem(prev.value, fieldPath, from, to);
        // Mark array as touched since user interacted with it
        newState = operations.setFieldTouched(newState, fieldPath, true);
        // Trigger array validation after move
        const newArrayValue = getNestedValue(newState.values, fieldPath);
        setTimeout(() => triggerArrayValidation(newArrayValue), 0);
        return Option.some(newState);
      });
    }, [fieldPath, setFormState, triggerArrayValidation]);
    return _jsx(_Fragment, {
      children: children({
        items,
        append,
        remove,
        swap,
        move
      })
    });
  };
  const ItemWrapper = ({
    children,
    index
  }) => {
    const arrayCtx = useContext(ArrayItemContext);
    const setFormState = useAtomSet(stateAtom);
    const parentPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey;
    const itemPath = `${parentPath}[${index}]`;
    // Get array field atoms for triggering validation after remove
    const arrayFieldAtoms = React.useMemo(() => getOrCreateFieldAtoms(parentPath), [parentPath]);
    const triggerArrayValidation = useAtomSet(arrayFieldAtoms.triggerValidationAtom);
    const remove = React.useCallback(() => {
      setFormState(prev => {
        if (Option.isNone(prev)) return prev;
        let newState = operations.removeArrayItem(prev.value, parentPath, index);
        // Mark array as touched since user interacted with it
        newState = operations.setFieldTouched(newState, parentPath, true);
        // Trigger array validation after remove
        const newArrayValue = getNestedValue(newState.values, parentPath);
        setTimeout(() => triggerArrayValidation(newArrayValue), 0);
        return Option.some(newState);
      });
    }, [parentPath, index, setFormState, triggerArrayValidation]);
    return _jsx(ArrayItemContext.Provider, {
      value: {
        index,
        parentPath: itemPath
      },
      children: typeof children === "function" ? children({
        remove
      }) : children
    });
  };
  const itemFieldComponents = {};
  if (structAST !== undefined) {
    for (const prop of structAST.propertySignatures) {
      const itemKey = prop.name;
      const itemSchema = {
        ast: prop.type
      };
      const itemDef = Field.makeField(itemKey, itemSchema);
      const itemComponent = componentMap[itemKey];
      itemFieldComponents[itemKey] = makeFieldComponent(itemKey, itemDef, dirtyFieldsAtom, getOrCreateFieldAtoms, itemComponent);
    }
  }
  const properties = {
    Item: ItemWrapper,
    ...itemFieldComponents
  };
  return new Proxy(ArrayWrapper, {
    get(target, prop) {
      if (prop in properties) {
        return properties[prop];
      }
      return Reflect.get(target, prop);
    }
  });
};
const makeFieldComponents = (fields, stateAtom, dirtyFieldsAtom, getOrCreateFieldAtoms, operations, componentMap) => {
  const components = {};
  for (const [key, def] of Object.entries(fields)) {
    if (Field.isArrayFieldDef(def)) {
      const arrayComponentMap = componentMap[key];
      components[key] = makeArrayFieldComponent(key, def, stateAtom, dirtyFieldsAtom, getOrCreateFieldAtoms, operations, arrayComponentMap);
    } else if (Field.isFieldDef(def)) {
      const fieldComponent = componentMap[key];
      components[key] = makeFieldComponent(key, def, dirtyFieldsAtom, getOrCreateFieldAtoms, fieldComponent);
    }
  }
  return components;
};
export const make = (self, options) => {
  const {
    fields: components,
    mode,
    onSubmit,
    runtime: providedRuntime
  } = options;
  const runtime = providedRuntime ?? Atom.runtime(Layer.empty);
  const {
    fields
  } = self;
  const formAtoms = FormAtoms.make({
    formBuilder: self,
    runtime,
    onSubmit,
    mode
  });
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
    valuesAtom
  } = formAtoms;
  const InitializeComponent = ({
    children,
    defaultValues
  }) => {
    const state = useAtomValue(stateAtom);
    const callInitialize = useAtomSet(initializeAtom);
    const callSubmit = useAtomSet(submitAtom);
    const callFlushAutoSubmitPending = useAtomSet(flushAutoSubmitPendingAtom);
    const callTriggerAutoSubmitOnBlur = useAtomSet(triggerAutoSubmitOnBlurAtom);
    const setAutoSubmitReady = useAtomSet(autoSubmitReadyAtom);
    const wasSubmittingRef = React.useRef(false);
    const lastRequestIdRef = React.useRef(0);
    // Subscribe to keep debounced auto-submit effect alive
    useAtomValue(isAutoSubmitDebouncingAtom);
    // Initialize on mount - all logic is in FormAtoms
    React.useEffect(() => {
      callInitialize(defaultValues);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
    }, [callInitialize]);
    // Subscribe to auto-submit request - when FormAtoms signals ready, call submit
    // All debouncing logic is in FormAtoms; React just executes the submit
    useAtomSubscribe(autoSubmitRequestIdAtom, React.useCallback(requestId => {
      if (requestId > lastRequestIdRef.current) {
        lastRequestIdRef.current = requestId;
        setAutoSubmitReady(false);
        callSubmit(undefined);
      }
    }, [callSubmit, setAutoSubmitReady]), {
      immediate: false
    });
    // Subscribe to submit completion - flush pending auto-submit when submit completes
    useAtomSubscribe(submitAtom, React.useCallback(result => {
      const wasSubmitting = wasSubmittingRef.current;
      wasSubmittingRef.current = result.waiting;
      callFlushAutoSubmitPending(wasSubmitting);
    }, [callFlushAutoSubmitPending]), {
      immediate: false
    });
    if (Option.isNone(state)) return null;
    return _jsx(AutoSubmitContext.Provider, {
      value: callTriggerAutoSubmitOnBlur,
      children: children
    });
  };
  const fieldComponents = makeFieldComponents(fields, stateAtom, dirtyFieldsAtom, getOrCreateFieldAtoms, operations, components);
  const KeepAlive = () => {
    const setKeepAliveActive = useAtomSet(keepAliveActiveAtom);
    React.useLayoutEffect(() => {
      setKeepAliveActive(true);
      return () => setKeepAliveActive(false);
    }, [setKeepAliveActive]);
    useAtomMount(mountAtom);
    return null;
  };
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
    ...fieldComponents
  };
};
//# sourceMappingURL=FormReact.js.map