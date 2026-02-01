import * as Equal from "effect/Equal";
import * as Utils from "effect/Utils";
import { getNestedValue, isPathUnderRoot } from "../Path.js";
export const recalculateDirtyFieldsForArray = (dirtyFields, initialValues, arrayPath, newItems) => {
  const initialItems = getNestedValue(initialValues, arrayPath) ?? [];
  if (newItems === initialItems) {
    return dirtyFields;
  }
  const nextDirty = new Set(Array.from(dirtyFields).filter(path => !isPathUnderRoot(path, arrayPath)));
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
export const recalculateDirtySubtree = (currentDirty, allInitial, allValues, rootPath = "") => {
  const targetValue = rootPath ? getNestedValue(allValues, rootPath) : allValues;
  const targetInitial = rootPath ? getNestedValue(allInitial, rootPath) : allInitial;
  if (targetValue === targetInitial) {
    if (rootPath === "") {
      return new Set();
    }
    let changed = false;
    const nextDirty = new Set(currentDirty);
    for (const path of currentDirty) {
      if (isPathUnderRoot(path, rootPath)) {
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
      if (isPathUnderRoot(path, rootPath)) {
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
//# sourceMappingURL=dirty.js.map