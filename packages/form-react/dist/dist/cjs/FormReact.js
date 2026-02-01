"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.make = void 0;
var _jsxRuntime = /*#__PURE__*/require("react/jsx-runtime");
var _atomReact = /*#__PURE__*/require("@effect-atom/atom-react");
var Atom = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("@effect-atom/atom/Atom"));
var _effectForm = /*#__PURE__*/require("@lucas-barake/effect-form");
var _Path = /*#__PURE__*/require("@lucas-barake/effect-form/Path");
var Layer = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/Layer"));
var Option = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/Option"));
var AST = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/SchemaAST"));
var _react = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("react"));
var React = _react;
function _interopRequireWildcard(e, t) {
  if ("function" == typeof WeakMap) var r = new WeakMap(),
    n = new WeakMap();
  return (_interopRequireWildcard = function (e, t) {
    if (!t && e && e.__esModule) return e;
    var o,
      i,
      f = {
        __proto__: null,
        default: e
      };
    if (null === e || "object" != typeof e && "function" != typeof e) return f;
    if (o = t ? n : r) {
      if (o.has(e)) return o.get(e);
      o.set(e, f);
    }
    for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);
    return f;
  })(e, t);
}
const ArrayItemContext = /*#__PURE__*/(0, _react.createContext)(null);
const AutoSubmitContext = /*#__PURE__*/(0, _react.createContext)(null);
const makeFieldComponent = (fieldKey, _fieldDef, dirtyFieldsAtom, getOrCreateFieldAtoms, Component) => {
  const FieldComponent = extraProps => {
    const arrayCtx = (0, _react.useContext)(ArrayItemContext);
    const autoSubmitOnBlur = (0, _react.useContext)(AutoSubmitContext);
    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey;
    const fieldAtoms = React.useMemo(() => getOrCreateFieldAtoms(fieldPath), [fieldPath]);
    // Read from atoms - all logic is in FormAtoms
    const value = (0, _atomReact.useAtomValue)(fieldAtoms.valueAtom);
    const isTouched = (0, _atomReact.useAtomValue)(fieldAtoms.touchedAtom);
    const visibleError = (0, _atomReact.useAtomValue)(fieldAtoms.visibleErrorAtom);
    const isValidating = (0, _atomReact.useAtomValue)(fieldAtoms.isValidatingAtom);
    const dirtyFields = (0, _atomReact.useAtomValue)(dirtyFieldsAtom);
    // Write to atoms - handlers just call atom setters
    const setOnChange = (0, _atomReact.useAtomSet)(fieldAtoms.onChangeAtom);
    const setOnBlur = (0, _atomReact.useAtomSet)(fieldAtoms.onBlurAtom);
    const onChange = React.useCallback(newValue => {
      setOnChange(newValue);
    }, [setOnChange]);
    const onBlur = React.useCallback(() => {
      setOnBlur();
      autoSubmitOnBlur?.();
    }, [setOnBlur, autoSubmitOnBlur]);
    const isDirty = React.useMemo(() => (0, _Path.isPathOrParentDirty)(dirtyFields, fieldPath), [dirtyFields, fieldPath]);
    const fieldState = React.useMemo(() => ({
      value,
      onChange,
      onBlur,
      error: visibleError,
      isTouched,
      isValidating,
      isDirty
    }), [value, onChange, onBlur, visibleError, isTouched, isValidating, isDirty]);
    return (0, _jsxRuntime.jsx)(Component, {
      field: fieldState,
      props: extraProps
    });
  };
  return React.memo(FieldComponent);
};
const makeArrayFieldComponent = (fieldKey, def, stateAtom, dirtyFieldsAtom, getOrCreateFieldAtoms, operations, componentMap) => {
  const isStructSchema = AST.isTypeLiteral(def.itemSchema.ast);
  const ArrayWrapper = ({
    children
  }) => {
    const arrayCtx = (0, _react.useContext)(ArrayItemContext);
    const [formStateOption, setFormState] = (0, _atomReact.useAtom)(stateAtom);
    const formState = Option.getOrThrow(formStateOption);
    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey;
    const items = React.useMemo(() => (0, _Path.getNestedValue)(formState.values, fieldPath) ?? [], [formState.values, fieldPath]);
    // Get array field atoms for triggering validation after operations
    const arrayFieldAtoms = React.useMemo(() => getOrCreateFieldAtoms(fieldPath), [fieldPath]);
    const triggerArrayValidation = (0, _atomReact.useAtomSet)(arrayFieldAtoms.triggerValidationAtom);
    const append = React.useCallback(value => {
      setFormState(prev => {
        if (Option.isNone(prev)) return prev;
        const newState = operations.appendArrayItem(prev.value, fieldPath, def.itemSchema, value);
        // Trigger array validation after append
        const newArrayValue = (0, _Path.getNestedValue)(newState.values, fieldPath);
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
        const newArrayValue = (0, _Path.getNestedValue)(newState.values, fieldPath);
        setTimeout(() => triggerArrayValidation(newArrayValue), 0);
        return Option.some(newState);
      });
    }, [fieldPath, setFormState, triggerArrayValidation]);
    const swap = React.useCallback((indexA, indexB) => {
      setFormState(prev => {
        if (Option.isNone(prev)) return prev;
        const newState = operations.swapArrayItems(prev.value, fieldPath, indexA, indexB);
        // Trigger array validation after swap
        const newArrayValue = (0, _Path.getNestedValue)(newState.values, fieldPath);
        setTimeout(() => triggerArrayValidation(newArrayValue), 0);
        return Option.some(newState);
      });
    }, [fieldPath, setFormState, triggerArrayValidation]);
    const move = React.useCallback((from, to) => {
      setFormState(prev => {
        if (Option.isNone(prev)) return prev;
        const newState = operations.moveArrayItem(prev.value, fieldPath, from, to);
        // Trigger array validation after move
        const newArrayValue = (0, _Path.getNestedValue)(newState.values, fieldPath);
        setTimeout(() => triggerArrayValidation(newArrayValue), 0);
        return Option.some(newState);
      });
    }, [fieldPath, setFormState, triggerArrayValidation]);
    return (0, _jsxRuntime.jsx)(_jsxRuntime.Fragment, {
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
    const arrayCtx = (0, _react.useContext)(ArrayItemContext);
    const setFormState = (0, _atomReact.useAtomSet)(stateAtom);
    const parentPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey;
    const itemPath = `${parentPath}[${index}]`;
    // Get array field atoms for triggering validation after remove
    const arrayFieldAtoms = React.useMemo(() => getOrCreateFieldAtoms(parentPath), [parentPath]);
    const triggerArrayValidation = (0, _atomReact.useAtomSet)(arrayFieldAtoms.triggerValidationAtom);
    const remove = React.useCallback(() => {
      setFormState(prev => {
        if (Option.isNone(prev)) return prev;
        let newState = operations.removeArrayItem(prev.value, parentPath, index);
        // Mark array as touched since user interacted with it
        newState = operations.setFieldTouched(newState, parentPath, true);
        // Trigger array validation after remove
        const newArrayValue = (0, _Path.getNestedValue)(newState.values, parentPath);
        setTimeout(() => triggerArrayValidation(newArrayValue), 0);
        return Option.some(newState);
      });
    }, [parentPath, index, setFormState, triggerArrayValidation]);
    return (0, _jsxRuntime.jsx)(ArrayItemContext.Provider, {
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
  if (isStructSchema) {
    const ast = def.itemSchema.ast;
    for (const prop of ast.propertySignatures) {
      const itemKey = prop.name;
      const itemSchema = {
        ast: prop.type
      };
      const itemDef = _effectForm.Field.makeField(itemKey, itemSchema);
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
    if (_effectForm.Field.isArrayFieldDef(def)) {
      const arrayComponentMap = componentMap[key];
      components[key] = makeArrayFieldComponent(key, def, stateAtom, dirtyFieldsAtom, getOrCreateFieldAtoms, operations, arrayComponentMap);
    } else if (_effectForm.Field.isFieldDef(def)) {
      const fieldComponent = componentMap[key];
      components[key] = makeFieldComponent(key, def, dirtyFieldsAtom, getOrCreateFieldAtoms, fieldComponent);
    }
  }
  return components;
};
const make = (self, options) => {
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
  const formAtoms = _effectForm.FormAtoms.make({
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
    const state = (0, _atomReact.useAtomValue)(stateAtom);
    const callInitialize = (0, _atomReact.useAtomSet)(initializeAtom);
    const callSubmit = (0, _atomReact.useAtomSet)(submitAtom);
    const callFlushAutoSubmitPending = (0, _atomReact.useAtomSet)(flushAutoSubmitPendingAtom);
    const callTriggerAutoSubmitOnBlur = (0, _atomReact.useAtomSet)(triggerAutoSubmitOnBlurAtom);
    const setAutoSubmitReady = (0, _atomReact.useAtomSet)(autoSubmitReadyAtom);
    const wasSubmittingRef = React.useRef(false);
    const lastRequestIdRef = React.useRef(0);
    // Subscribe to keep debounced auto-submit effect alive
    (0, _atomReact.useAtomValue)(isAutoSubmitDebouncingAtom);
    // Initialize on mount - all logic is in FormAtoms
    React.useEffect(() => {
      callInitialize(defaultValues);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
    }, [callInitialize]);
    // Subscribe to auto-submit request - when FormAtoms signals ready, call submit
    // All debouncing logic is in FormAtoms; React just executes the submit
    (0, _atomReact.useAtomSubscribe)(autoSubmitRequestIdAtom, React.useCallback(requestId => {
      if (requestId > lastRequestIdRef.current) {
        lastRequestIdRef.current = requestId;
        setAutoSubmitReady(false);
        callSubmit(undefined);
      }
    }, [callSubmit, setAutoSubmitReady]), {
      immediate: false
    });
    // Subscribe to submit completion - flush pending auto-submit when submit completes
    (0, _atomReact.useAtomSubscribe)(submitAtom, React.useCallback(result => {
      const wasSubmitting = wasSubmittingRef.current;
      wasSubmittingRef.current = result.waiting;
      callFlushAutoSubmitPending(wasSubmitting);
    }, [callFlushAutoSubmitPending]), {
      immediate: false
    });
    if (Option.isNone(state)) return null;
    return (0, _jsxRuntime.jsx)(AutoSubmitContext.Provider, {
      value: callTriggerAutoSubmitOnBlur,
      children: children
    });
  };
  const fieldComponents = makeFieldComponents(fields, stateAtom, dirtyFieldsAtom, getOrCreateFieldAtoms, operations, components);
  const KeepAlive = () => {
    const setKeepAliveActive = (0, _atomReact.useAtomSet)(keepAliveActiveAtom);
    React.useLayoutEffect(() => {
      setKeepAliveActive(true);
      return () => setKeepAliveActive(false);
    }, [setKeepAliveActive]);
    (0, _atomReact.useAtomMount)(mountAtom);
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
exports.make = make;
//# sourceMappingURL=FormReact.js.map