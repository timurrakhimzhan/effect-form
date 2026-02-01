"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setNestedValue = exports.schemaPathToFieldPath = exports.isPathUnderRoot = exports.isPathOrParentDirty = exports.getNestedValue = void 0;
const BRACKET_NOTATION_REGEX = /\[(\d+)\]/g;
const schemaPathToFieldPath = path => {
  if (path.length === 0) return "";
  let result = String(path[0]);
  for (let i = 1; i < path.length; i++) {
    const segment = path[i];
    if (typeof segment === "number") {
      result += `[${segment}]`;
    } else {
      result += `.${String(segment)}`;
    }
  }
  return result;
};
exports.schemaPathToFieldPath = schemaPathToFieldPath;
const isPathUnderRoot = (path, rootPath) => path === rootPath || path.startsWith(rootPath + ".") || path.startsWith(rootPath + "[");
exports.isPathUnderRoot = isPathUnderRoot;
const isPathOrParentDirty = (dirtyFields, path) => {
  if (dirtyFields.has(path)) return true;
  let parent = path;
  while (true) {
    const lastDot = parent.lastIndexOf(".");
    const lastBracket = parent.lastIndexOf("[");
    const splitIndex = Math.max(lastDot, lastBracket);
    if (splitIndex === -1) break;
    parent = parent.substring(0, splitIndex);
    if (dirtyFields.has(parent)) return true;
  }
  return false;
};
exports.isPathOrParentDirty = isPathOrParentDirty;
const getNestedValue = (obj, path) => {
  if (path === "") return obj;
  const parts = path.replace(BRACKET_NOTATION_REGEX, ".$1").split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
};
exports.getNestedValue = getNestedValue;
const setNestedValue = (obj, path, value) => {
  if (path === "") return value;
  const parts = path.replace(BRACKET_NOTATION_REGEX, ".$1").split(".");
  const result = {
    ...obj
  };
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (Array.isArray(current[part])) {
      current[part] = [...current[part]];
    } else {
      current[part] = {
        ...current[part]
      };
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
  return result;
};
exports.setNestedValue = setNestedValue;
//# sourceMappingURL=Path.js.map