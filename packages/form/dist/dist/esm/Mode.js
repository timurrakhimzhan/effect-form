import * as Duration from "effect/Duration";
export const parse = (mode = "onSubmit") => {
  if (typeof mode === "string") {
    return {
      validation: mode,
      debounce: null,
      autoSubmit: false
    };
  }
  if ("onBlur" in mode) {
    return {
      validation: "onBlur",
      debounce: null,
      autoSubmit: true
    };
  }
  const debounceMs = Duration.toMillis(mode.onChange.debounce);
  const autoSubmit = mode.onChange.autoSubmit === true;
  return {
    validation: "onChange",
    debounce: debounceMs,
    autoSubmit
  };
};
//# sourceMappingURL=Mode.js.map