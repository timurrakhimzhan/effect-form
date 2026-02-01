"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useDebounced = void 0;
var React = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("react"));
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
const useDebounced = (fn, delayMs) => {
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
exports.useDebounced = useDebounced;
//# sourceMappingURL=use-debounced.js.map