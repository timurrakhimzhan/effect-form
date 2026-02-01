import * as React from "react";
export const useDebounced = (fn, delayMs) => {
  const timeoutRef = React.useRef(null);
  const fnRef = React.useRef(fn);
  React.useEffect(() => {
    fnRef.current = fn;
  });
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  return React.useMemo(() => (...args) => {
    if (delayMs === null || delayMs === 0) {
      fnRef.current(...args);
      return;
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      fnRef.current(...args);
      timeoutRef.current = null;
    }, delayMs);
  }, [delayMs]);
};
//# sourceMappingURL=use-debounced.js.map