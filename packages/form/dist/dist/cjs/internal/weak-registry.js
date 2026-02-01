"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createWeakRegistry = void 0;
const createWeakRegistry = () => {
  if (typeof WeakRef === "undefined" || typeof FinalizationRegistry === "undefined") {
    const map = new Map();
    return {
      get: key => map.get(key),
      set: (key, value) => {
        map.set(key, value);
      },
      delete: key => map.delete(key),
      clear: () => map.clear(),
      values: () => map.values()
    };
  }
  const map = new Map();
  const registry = new FinalizationRegistry(key => {
    map.delete(key);
  });
  return {
    get: key => map.get(key)?.deref(),
    set: (key, value) => {
      map.set(key, new WeakRef(value));
      registry.register(value, key);
    },
    delete: key => map.delete(key),
    clear: () => map.clear(),
    *values() {
      for (const ref of map.values()) {
        const value = ref.deref();
        if (value !== undefined) yield value;
      }
    }
  };
};
exports.createWeakRegistry = createWeakRegistry;
//# sourceMappingURL=weak-registry.js.map