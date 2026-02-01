"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.recalculateDirtySubtree = exports.recalculateDirtyFieldsForArray = void 0;
var Equal = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/Equal"));
var Utils = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/Utils"));
var _Path = /*#__PURE__*/require("../Path.js");
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
const recalculateDirtyFieldsForArray = (dirtyFields, initialValues, arrayPath, newItems) => {
  const initialItems = (0, _Path.getNestedValue)(initialValues, arrayPath) ?? [];
  if (newItems === initialItems) {
    return dirtyFields;
  }
  const nextDirty = new Set(Array.from(dirtyFields).filter(path => !(0, _Path.isPathUnderRoot)(path, arrayPath)));
  const loopLength = Math.max(newItems.length, initialItems.length);
  for (let i = 0; i < loopLength; i++) {
    const itemPath = `${arrayPath}[${i}]`;
    const newItem = newItems[i];
    const initialItem = initialItems[i];
    if (newItem === initialItem) continue;
    const isEqual = Utils.structuralRegion(() => Equal.equals(newItem, initialItem));
    if (!isEqual) {
      nextDirty.add(itemPath);
    }
  }
  if (newItems.length !== initialItems.length) {
    nextDirty.add(arrayPath);
  } else {
    nextDirty.delete(arrayPath);
  }
  return nextDirty;
};
exports.recalculateDirtyFieldsForArray = recalculateDirtyFieldsForArray;
const recalculateDirtySubtree = (currentDirty, allInitial, allValues, rootPath = "") => {
  const targetValue = rootPath ? (0, _Path.getNestedValue)(allValues, rootPath) : allValues;
  const targetInitial = rootPath ? (0, _Path.getNestedValue)(allInitial, rootPath) : allInitial;
  if (targetValue === targetInitial) {
    if (rootPath === "") {
      return new Set();
    }
    let changed = false;
    const nextDirty = new Set(currentDirty);
    for (const path of currentDirty) {
      if ((0, _Path.isPathUnderRoot)(path, rootPath)) {
        nextDirty.delete(path);
        changed = true;
      }
    }
    return changed ? nextDirty : currentDirty;
  }
  const nextDirty = new Set(currentDirty);
  if (rootPath === "") {
    nextDirty.clear();
  } else {
    for (const path of nextDirty) {
      if ((0, _Path.isPathUnderRoot)(path, rootPath)) {
        nextDirty.delete(path);
      }
    }
  }
  const recurse = (current, initial, path) => {
    if (current === initial) return;
    if (Array.isArray(current)) {
      const initialArr = initial ?? [];
      for (let i = 0; i < Math.max(current.length, initialArr.length); i++) {
        recurse(current[i], initialArr[i], path ? `${path}[${i}]` : `[${i}]`);
      }
    } else if (current !== null && typeof current === "object") {
      const initialObj = initial ?? {};
      for (const key in current) {
        recurse(current[key], initialObj[key], path ? `${path}.${key}` : key);
      }
      for (const key in initialObj) {
        if (!(key in current)) {
          recurse(undefined, initialObj[key], path ? `${path}.${key}` : key);
        }
      }
    } else {
      const isEqual = Utils.structuralRegion(() => Equal.equals(current, initial));
      if (!isEqual && path) nextDirty.add(path);
    }
  };
  recurse(targetValue, targetInitial, rootPath);
  return nextDirty;
};
exports.recalculateDirtySubtree = recalculateDirtySubtree;
//# sourceMappingURL=dirty.js.map