import * as Atom from "@effect-atom/atom/Atom";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Field from "./Field.js";
import * as FormBuilder from "./FormBuilder.js";
import { recalculateDirtyFieldsForArray, recalculateDirtySubtree } from "./internal/dirty.js";
import { createWeakRegistry } from "./internal/weak-registry.js";
import * as Mode from "./Mode.js";
import { getNestedValue, isPathOrParentDirty, setNestedValue } from "./Path.js";
import * as Validation from "./Validation.js";
export const make = config => {
  const {
    formBuilder,
    runtime
  } = config;
  const {
    fields
  } = formBuilder;
  const parsedMode = Mode.parse(config.mode);
  const debounceMs = config.validationDebounceMs ?? parsedMode.debounce ?? 0;
  const combinedSchema = FormBuilder.buildSchema(formBuilder);
  const stateAtom = Atom.make(Option.none()).pipe(Atom.setIdleTTL(0));
  const errorsAtom = Atom.make(new Map()).pipe(Atom.setIdleTTL(0));
  const rootErrorAtom = Atom.readable(get => {
    const errors = get(errorsAtom);
    const entry = errors.get("");
    return entry ? Option.some(entry.message) : Option.none();
  }).pipe(Atom.setIdleTTL(0));
  const valuesAtom = Atom.readable(get => Option.map(get(stateAtom), state => state.values)).pipe(Atom.setIdleTTL(0));
  const dirtyFieldsAtom = Atom.readable(get => Option.match(get(stateAtom), {
    onNone: () => new Set(),
    onSome: state => state.dirtyFields
  })).pipe(Atom.setIdleTTL(0));
  const isDirtyAtom = Atom.readable(get => Option.match(get(stateAtom), {
    onNone: () => false,
    onSome: state => state.dirtyFields.size > 0
  })).pipe(Atom.setIdleTTL(0));
  const submitCountAtom = Atom.readable(get => Option.match(get(stateAtom), {
    onNone: () => 0,
    onSome: state => state.submitCount
  })).pipe(Atom.setIdleTTL(0));
  const lastSubmittedValuesAtom = Atom.readable(get => Option.flatMap(get(stateAtom), state => state.lastSubmittedValues)).pipe(Atom.setIdleTTL(0));
  const changedSinceSubmitFieldsAtom = Atom.readable(get => Option.match(get(stateAtom), {
    onNone: () => new Set(),
    onSome: state => Option.match(state.lastSubmittedValues, {
      onNone: () => new Set(),
      onSome: lastSubmitted => recalculateDirtySubtree(new Set(), lastSubmitted.encoded, state.values, "")
    })
  })).pipe(Atom.setIdleTTL(0));
  const hasChangedSinceSubmitAtom = Atom.readable(get => Option.match(get(stateAtom), {
    onNone: () => false,
    onSome: state => {
      if (Option.isNone(state.lastSubmittedValues)) return false;
      if (state.values === state.lastSubmittedValues.value.encoded) return false;
      return get(changedSinceSubmitFieldsAtom).size > 0;
    }
  })).pipe(Atom.setIdleTTL(0));
  const validationAtomsRegistry = createWeakRegistry();
  const fieldAtomsRegistry = createWeakRegistry();
  const publicFieldAtomRegistry = createWeakRegistry();
  const getOrCreateValidationAtom = (fieldPath, schema) => {
    const existing = validationAtomsRegistry.get(fieldPath);
    if (existing) return existing;
    const validationAtom = runtime.fn()(value => pipe(Schema.decodeUnknown(schema)(value), Effect.asVoid)).pipe(Atom.setIdleTTL(0));
    validationAtomsRegistry.set(fieldPath, validationAtom);
    return validationAtom;
  };
  const getFieldSchema = fieldPath => {
    const parts = fieldPath.split(".");
    const rootFieldName = parts[0].replace(/\[\d+\]$/, "");
    const fieldDef = fields[rootFieldName];
    if (!fieldDef) return undefined;
    if (Field.isFieldDef(fieldDef)) {
      return fieldDef.schema;
    }
    if (Field.isArrayFieldDef(fieldDef)) {
      return fieldDef.itemSchema;
    }
    return undefined;
  };
  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-Submit atoms (defined before getOrCreateFieldAtoms so they're in scope)
  // ─────────────────────────────────────────────────────────────────────────────
  // Track pending changes while a submit is in progress
  const autoSubmitPendingAtom = Atom.make(false).pipe(Atom.setIdleTTL(0));
  // Flag set when debounced auto-submit should trigger
  const autoSubmitReadyAtom = Atom.make(false).pipe(Atom.setIdleTTL(0));
  // Counter to track unique auto-submit requests (for React to detect changes)
  const autoSubmitRequestIdAtom = Atom.make(0).pipe(Atom.setIdleTTL(0));
  // Debounced auto-submit - sets the ready flag after debounce
  // Uses number parameter to ensure each call creates a new fiber (like triggerValidationAtom)
  const debouncedAutoSubmitAtom = runtime.fn()((_requestId, get) => Effect.gen(function* () {
    if (debounceMs > 0) {
      yield* Effect.sleep(Duration.millis(debounceMs));
    }
    yield* Effect.sync(() => {
      get.set(autoSubmitReadyAtom, true);
      get.set(autoSubmitRequestIdAtom, get(autoSubmitRequestIdAtom) + 1);
    });
  })).pipe(Atom.setIdleTTL(0));
  // Counter for auto-submit requests
  let autoSubmitCounter = 0;
  // Atom to keep debouncedAutoSubmitAtom alive by subscribing to it
  const isAutoSubmitDebouncing = Atom.readable(get => {
    const result = get(debouncedAutoSubmitAtom);
    return result.waiting;
  }).pipe(Atom.setIdleTTL(0));
  const getOrCreateFieldAtoms = fieldPath => {
    const existing = fieldAtomsRegistry.get(fieldPath);
    if (existing) return existing;
    const fieldSchema = getFieldSchema(fieldPath);
    const valueAtom = Atom.writable(get => getNestedValue(Option.getOrThrow(get(stateAtom)).values, fieldPath), (ctx, value) => {
      const currentState = Option.getOrThrow(ctx.get(stateAtom));
      ctx.set(stateAtom, Option.some(operations.setFieldValue(currentState, fieldPath, value)));
    }).pipe(Atom.setIdleTTL(0));
    const initialValueAtom = Atom.readable(get => getNestedValue(Option.getOrThrow(get(stateAtom)).initialValues, fieldPath)).pipe(Atom.setIdleTTL(0));
    const touchedAtom = Atom.writable(get => getNestedValue(Option.getOrThrow(get(stateAtom)).touched, fieldPath) ?? false, (ctx, value) => {
      const currentState = Option.getOrThrow(ctx.get(stateAtom));
      ctx.set(stateAtom, Option.some({
        ...currentState,
        touched: setNestedValue(currentState.touched, fieldPath, value)
      }));
    }).pipe(Atom.setIdleTTL(0));
    const errorAtom = Atom.readable(get => {
      const errors = get(errorsAtom);
      const entry = errors.get(fieldPath);
      return entry ? Option.some(entry) : Option.none();
    }).pipe(Atom.setIdleTTL(0));
    // Debounced validation that writes results to errorsAtom
    const triggerValidationAtom = fieldSchema ? runtime.fn()((value, get) => Effect.gen(function* () {
      // Debounce
      if (debounceMs > 0) {
        yield* Effect.sleep(Duration.millis(debounceMs));
      }
      yield* pipe(Schema.decodeUnknown(fieldSchema)(value), Effect.tap(() => Effect.sync(() => {
        // Clear field-sourced error on success (keep refinement errors until re-submit)
        const currentErrors = get(errorsAtom);
        const existingError = currentErrors.get(fieldPath);
        if (existingError && existingError.source === "field") {
          const newErrors = new Map(currentErrors);
          newErrors.delete(fieldPath);
          get.set(errorsAtom, newErrors);
        }
      })), Effect.tapError(parseError => Effect.sync(() => {
        // Extract first error and set for this field
        const errorMessage = Validation.extractFirstError(parseError);
        if (Option.isSome(errorMessage)) {
          const currentErrors = get(errorsAtom);
          const newErrors = new Map(currentErrors);
          newErrors.set(fieldPath, {
            message: errorMessage.value,
            source: "field"
          });
          get.set(errorsAtom, newErrors);
        }
      })), Effect.asVoid);
    })).pipe(Atom.setIdleTTL(0)) : runtime.fn()(() => Effect.void).pipe(Atom.setIdleTTL(0));
    const isValidatingAtom = Atom.readable(get => {
      const result = get(triggerValidationAtom);
      return result.waiting;
    }).pipe(Atom.setIdleTTL(0));
    // Computed visible error based on mode, touched, dirty, submitCount
    const visibleErrorAtom = Atom.readable(get => {
      const error = get(errorAtom);
      if (Option.isNone(error)) return Option.none();
      const touched = get(touchedAtom);
      const submitCount = get(submitCountAtom);
      const dirtyFields = get(dirtyFieldsAtom);
      const isDirty = isPathOrParentDirty(dirtyFields, fieldPath);
      const shouldShow = parsedMode.validation === "onSubmit" ? submitCount > 0 : parsedMode.validation === "onBlur" ? touched || submitCount > 0 : isDirty || submitCount > 0;
      if (!shouldShow) return Option.none();
      return Option.some(error.value.message);
    }).pipe(Atom.setIdleTTL(0));
    // onChange handler: sets value, triggers validation, and triggers auto-submit based on mode
    const onChangeAtom = Atom.fnSync()((value, get) => {
      // Set value
      const currentState = Option.getOrThrow(get(stateAtom));
      const newState = operations.setFieldValue(currentState, fieldPath, value);
      get.set(stateAtom, Option.some(newState));
      // Trigger validation based on mode
      const touched = get(touchedAtom);
      const submitCount = get(submitCountAtom);
      const shouldValidate = parsedMode.validation === "onChange" || parsedMode.validation === "onBlur" && touched || parsedMode.validation === "onSubmit" && submitCount > 0;
      if (shouldValidate) {
        get.set(triggerValidationAtom, value);
      }
      // Trigger auto-submit for onChange mode (debounced)
      if (parsedMode.autoSubmit && parsedMode.validation === "onChange") {
        const submitResult = get(submitAtom);
        if (submitResult.waiting) {
          get.set(autoSubmitPendingAtom, true);
        } else {
          autoSubmitCounter++;
          get.set(debouncedAutoSubmitAtom, autoSubmitCounter);
        }
      }
    }, {
      initialValue: undefined
    }).pipe(Atom.setIdleTTL(0));
    // onBlur handler: sets touched and triggers validation if mode is onBlur
    const onBlurAtom = Atom.fnSync()((_, get) => {
      // Set touched
      const currentState = Option.getOrThrow(get(stateAtom));
      get.set(stateAtom, Option.some({
        ...currentState,
        touched: setNestedValue(currentState.touched, fieldPath, true)
      }));
      // Trigger validation if mode is onBlur
      if (parsedMode.validation === "onBlur") {
        const value = getNestedValue(currentState.values, fieldPath);
        get.set(triggerValidationAtom, value);
      }
    }, {
      initialValue: undefined
    }).pipe(Atom.setIdleTTL(0));
    const atoms = {
      valueAtom,
      initialValueAtom,
      touchedAtom,
      errorAtom,
      visibleErrorAtom,
      isValidatingAtom,
      triggerValidationAtom,
      onChangeAtom,
      onBlurAtom
    };
    fieldAtomsRegistry.set(fieldPath, atoms);
    return atoms;
  };
  const resetValidationAtoms = ctx => {
    for (const validationAtom of validationAtomsRegistry.values()) {
      ctx.set(validationAtom, Atom.Reset);
    }
    validationAtomsRegistry.clear();
    fieldAtomsRegistry.clear();
  };
  const submitAtom = runtime.fn()((args, get) => Effect.gen(function* () {
    const state = get(stateAtom);
    if (Option.isNone(state)) return yield* Effect.die("Form not initialized");
    const values = state.value.values;
    get.set(errorsAtom, new Map());
    const decoded = yield* pipe(Schema.decodeUnknown(combinedSchema, {
      errors: "all"
    })(values), Effect.tapError(parseError => Effect.sync(() => {
      const routedErrors = Validation.routeErrorsWithSource(parseError);
      get.set(errorsAtom, routedErrors);
      get.set(stateAtom, Option.some(operations.createSubmitState(state.value)));
    })));
    const submitState = operations.createSubmitState(state.value);
    get.set(stateAtom, Option.some({
      ...submitState,
      lastSubmittedValues: Option.some({
        encoded: values,
        decoded
      })
    }));
    const result = config.onSubmit(args, {
      decoded,
      encoded: values,
      get
    });
    if (Effect.isEffect(result)) {
      return yield* result;
    }
    return result;
  })).pipe(Atom.setIdleTTL(0));
  const fieldRefs = Object.fromEntries(Object.keys(fields).map(key => [key, FormBuilder.makeFieldRef(key)]));
  const operations = {
    createInitialState: defaultValues => ({
      values: defaultValues,
      initialValues: defaultValues,
      lastSubmittedValues: Option.none(),
      touched: Field.createTouchedRecord(fields, false),
      submitCount: 0,
      dirtyFields: new Set()
    }),
    createResetState: state => ({
      values: state.initialValues,
      initialValues: state.initialValues,
      lastSubmittedValues: Option.none(),
      touched: Field.createTouchedRecord(fields, false),
      submitCount: 0,
      dirtyFields: new Set()
    }),
    createSubmitState: state => ({
      ...state,
      touched: Field.createTouchedRecord(fields, true),
      submitCount: state.submitCount + 1
    }),
    setFieldValue: (state, fieldPath, value) => {
      const newValues = setNestedValue(state.values, fieldPath, value);
      const newDirtyFields = recalculateDirtySubtree(state.dirtyFields, state.initialValues, newValues, fieldPath);
      return {
        ...state,
        values: newValues,
        dirtyFields: newDirtyFields
      };
    },
    setFormValues: (state, values) => {
      const newDirtyFields = recalculateDirtySubtree(state.dirtyFields, state.initialValues, values, "");
      return {
        ...state,
        values,
        dirtyFields: newDirtyFields
      };
    },
    setFieldTouched: (state, fieldPath, touched) => ({
      ...state,
      touched: setNestedValue(state.touched, fieldPath, touched)
    }),
    appendArrayItem: (state, arrayPath, itemSchema, value) => {
      const newItem = value ?? Field.getDefaultFromSchema(itemSchema);
      const currentItems = getNestedValue(state.values, arrayPath) ?? [];
      const newItems = [...currentItems, newItem];
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems),
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems)
      };
    },
    removeArrayItem: (state, arrayPath, index) => {
      const currentItems = getNestedValue(state.values, arrayPath) ?? [];
      const newItems = currentItems.filter((_, i) => i !== index);
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems),
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems)
      };
    },
    swapArrayItems: (state, arrayPath, indexA, indexB) => {
      const currentItems = getNestedValue(state.values, arrayPath) ?? [];
      if (indexA < 0 || indexA >= currentItems.length || indexB < 0 || indexB >= currentItems.length || indexA === indexB) {
        return state;
      }
      const newItems = [...currentItems];
      const temp = newItems[indexA];
      newItems[indexA] = newItems[indexB];
      newItems[indexB] = temp;
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems),
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems)
      };
    },
    moveArrayItem: (state, arrayPath, fromIndex, toIndex) => {
      const currentItems = getNestedValue(state.values, arrayPath) ?? [];
      if (fromIndex < 0 || fromIndex >= currentItems.length || toIndex < 0 || toIndex > currentItems.length || fromIndex === toIndex) {
        return state;
      }
      const newItems = [...currentItems];
      const [item] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, item);
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems),
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems)
      };
    },
    revertToLastSubmit: state => {
      if (Option.isNone(state.lastSubmittedValues)) {
        return state;
      }
      const lastEncoded = state.lastSubmittedValues.value.encoded;
      if (state.values === lastEncoded) {
        return state;
      }
      const newDirtyFields = recalculateDirtySubtree(state.dirtyFields, state.initialValues, lastEncoded, "");
      return {
        ...state,
        values: lastEncoded,
        dirtyFields: newDirtyFields
      };
    }
  };
  const resetAtom = Atom.fnSync()((_, get) => {
    const state = get(stateAtom);
    if (Option.isNone(state)) return;
    get.set(stateAtom, Option.some(operations.createResetState(state.value)));
    get.set(errorsAtom, new Map());
    resetValidationAtoms(get);
    get.set(submitAtom, Atom.Reset);
  }, {
    initialValue: undefined
  }).pipe(Atom.setIdleTTL(0));
  const revertToLastSubmitAtom = Atom.fnSync()((_, get) => {
    const state = get(stateAtom);
    if (Option.isNone(state)) return;
    get.set(stateAtom, Option.some(operations.revertToLastSubmit(state.value)));
    get.set(errorsAtom, new Map());
  }, {
    initialValue: undefined
  }).pipe(Atom.setIdleTTL(0));
  const setValuesAtom = Atom.fnSync()((_values, get) => {
    const state = get(stateAtom);
    if (Option.isNone(state)) return;
    get.set(stateAtom, Option.some(operations.setFormValues(state.value, _values)));
    get.set(errorsAtom, new Map());
  }, {
    initialValue: undefined
  }).pipe(Atom.setIdleTTL(0));
  const setValueAtomsRegistry = createWeakRegistry();
  const setValue = field => {
    const cached = setValueAtomsRegistry.get(field.key);
    if (cached) return cached;
    const atom = Atom.fnSync()((update, get) => {
      const state = get(stateAtom);
      if (Option.isNone(state)) return;
      const currentValue = getNestedValue(state.value.values, field.key);
      const newValue = typeof update === "function" ? update(currentValue) : update;
      get.set(stateAtom, Option.some(operations.setFieldValue(state.value, field.key, newValue)));
      // Don't clear errors - display logic handles showing/hiding based on source + validation state
    }, {
      initialValue: undefined
    }).pipe(Atom.setIdleTTL(0));
    setValueAtomsRegistry.set(field.key, atom);
    return atom;
  };
  const getFieldAtom = field => {
    const existing = publicFieldAtomRegistry.get(field.key);
    if (existing) return existing;
    const safeAtom = Atom.readable(get => Option.map(get(stateAtom), state => getNestedValue(state.values, field.key))).pipe(Atom.setIdleTTL(0));
    publicFieldAtomRegistry.set(field.key, safeAtom);
    return safeAtom;
  };
  const publicFieldAtomsRegistry = createWeakRegistry();
  const getField = field => {
    const existing = publicFieldAtomsRegistry.get(field.key);
    if (existing) return existing;
    const fieldAtoms = getOrCreateFieldAtoms(field.key);
    // Safe value atom (returns None if form not initialized)
    const valueAtom = Atom.readable(get => Option.map(get(stateAtom), state => getNestedValue(state.values, field.key))).pipe(Atom.setIdleTTL(0));
    // Safe initial value atom
    const initialValueAtom = Atom.readable(get => Option.map(get(stateAtom), state => getNestedValue(state.initialValues, field.key))).pipe(Atom.setIdleTTL(0));
    // isDirty computed atom
    const isDirtyAtom = Atom.readable(get => isPathOrParentDirty(get(dirtyFieldsAtom), field.key)).pipe(Atom.setIdleTTL(0));
    // Safe isTouched (false if form not initialized)
    const isTouchedAtom = Atom.readable(get => {
      const state = get(stateAtom);
      if (Option.isNone(state)) return false;
      return getNestedValue(state.value.touched, field.key) ?? false;
    }).pipe(Atom.setIdleTTL(0));
    // Typed onChange atom
    const typedOnChangeAtom = Atom.writable(() => undefined, (ctx, value) => ctx.set(fieldAtoms.onChangeAtom, value)).pipe(Atom.setIdleTTL(0));
    const result = {
      value: valueAtom,
      initialValue: initialValueAtom,
      error: fieldAtoms.visibleErrorAtom,
      isTouched: isTouchedAtom,
      isDirty: isDirtyAtom,
      isValidating: fieldAtoms.isValidatingAtom,
      setValue: setValue(field),
      onChange: typedOnChangeAtom,
      onBlur: fieldAtoms.onBlurAtom,
      key: field.key
    };
    publicFieldAtomsRegistry.set(field.key, result);
    return result;
  };
  const mountAtom = Atom.readable(get => {
    get(stateAtom);
    get(errorsAtom);
    get(submitAtom);
  }).pipe(Atom.setIdleTTL(0));
  const keepAliveActiveAtom = Atom.make(false).pipe(Atom.setIdleTTL(0));
  // Initialize atom - sets initial state if not already initialized (respects keepAlive)
  const initializeAtom = Atom.fnSync()((defaultValues, get) => {
    const isKeptAlive = get(keepAliveActiveAtom);
    const currentState = get(stateAtom);
    if (!isKeptAlive) {
      // Not in keepAlive mode - always initialize
      get.set(stateAtom, Option.some(operations.createInitialState(defaultValues)));
    } else if (Option.isNone(currentState)) {
      // In keepAlive mode but no state yet - initialize
      get.set(stateAtom, Option.some(operations.createInitialState(defaultValues)));
    }
    // Otherwise: keepAlive is active and state exists - do nothing
  }, {
    initialValue: undefined
  }).pipe(Atom.setIdleTTL(0));
  // Trigger auto-submit for onBlur mode (call this on field blur)
  const triggerAutoSubmitOnBlurAtom = Atom.fnSync()((_, get) => {
    if (!parsedMode.autoSubmit || parsedMode.validation !== "onBlur") return;
    const state = get(stateAtom);
    if (Option.isNone(state)) return;
    const {
      values,
      lastSubmittedValues
    } = state.value;
    // Skip if values match last submitted
    if (Option.isSome(lastSubmittedValues) && values === lastSubmittedValues.value.encoded) return;
    get.set(submitAtom, undefined);
  }, {
    initialValue: undefined
  }).pipe(Atom.setIdleTTL(0));
  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-Submit coordination atoms
  // ─────────────────────────────────────────────────────────────────────────────
  // Track the last values reference to detect actual value changes (for React subscription)
  const autoSubmitLastValuesAtom = Atom.make(null).pipe(Atom.setIdleTTL(0));
  // Called on every state change from React - handles value tracking and submit triggering
  const triggerAutoSubmitOnChangeAtom = Atom.fnSync()((_, get) => {
    if (!parsedMode.autoSubmit || parsedMode.validation !== "onChange") return;
    const state = get(stateAtom);
    if (Option.isNone(state)) return;
    const currentValues = state.value.values;
    const lastValues = get(autoSubmitLastValuesAtom);
    // Reference equality check - skip if values haven't changed
    if (currentValues === lastValues) return;
    get.set(autoSubmitLastValuesAtom, currentValues);
    const submitResult = get(submitAtom);
    if (submitResult.waiting) {
      get.set(autoSubmitPendingAtom, true);
    } else {
      autoSubmitCounter++;
      get.set(debouncedAutoSubmitAtom, autoSubmitCounter);
    }
  }, {
    initialValue: undefined
  }).pipe(Atom.setIdleTTL(0));
  // Called when submit completes to flush pending auto-submit
  const flushAutoSubmitPendingAtom = Atom.fnSync()((wasSubmitting, get) => {
    if (!parsedMode.autoSubmit || parsedMode.validation !== "onChange") return;
    const submitResult = get(submitAtom);
    const isSubmitting = submitResult.waiting;
    // Only flush when transitioning from submitting to not submitting
    if (wasSubmitting && !isSubmitting) {
      const pending = get(autoSubmitPendingAtom);
      if (pending) {
        get.set(autoSubmitPendingAtom, false);
        autoSubmitCounter++;
        get.set(debouncedAutoSubmitAtom, autoSubmitCounter);
      }
    }
  }, {
    initialValue: undefined
  }).pipe(Atom.setIdleTTL(0));
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
    isAutoSubmitDebouncingAtom: isAutoSubmitDebouncing
  };
};
//# sourceMappingURL=FormAtoms.js.map