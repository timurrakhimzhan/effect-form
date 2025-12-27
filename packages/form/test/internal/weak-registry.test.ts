import { describe, expect, it } from "vitest"
import { createWeakRegistry } from "../../src/internal/weak-registry.js"

describe("WeakRegistry", () => {
  describe("get/set operations", () => {
    it("sets and gets a value", () => {
      const registry = createWeakRegistry<{ value: number }>()

      const obj = { value: 42 }
      registry.set("key1", obj)

      expect(registry.get("key1")).toBe(obj)
    })

    it("returns undefined for non-existent key", () => {
      const registry = createWeakRegistry<{ value: number }>()

      expect(registry.get("nonexistent")).toBeUndefined()
    })

    it("stores multiple values with different keys", () => {
      const registry = createWeakRegistry<{ value: number }>()

      const obj1 = { value: 1 }
      const obj2 = { value: 2 }
      const obj3 = { value: 3 }

      registry.set("a", obj1)
      registry.set("b", obj2)
      registry.set("c", obj3)

      expect(registry.get("a")).toBe(obj1)
      expect(registry.get("b")).toBe(obj2)
      expect(registry.get("c")).toBe(obj3)
    })
  })

  describe("overwrites on duplicate keys", () => {
    it("overwrites existing value when setting same key", () => {
      const registry = createWeakRegistry<{ value: number }>()

      const obj1 = { value: 1 }
      const obj2 = { value: 2 }

      registry.set("key", obj1)
      expect(registry.get("key")).toBe(obj1)

      registry.set("key", obj2)
      expect(registry.get("key")).toBe(obj2)
    })
  })

  describe("delete operation", () => {
    it("deletes an existing key and returns true", () => {
      const registry = createWeakRegistry<{ value: number }>()

      const obj = { value: 42 }
      registry.set("key", obj)

      const result = registry.delete("key")

      expect(result).toBe(true)
      expect(registry.get("key")).toBeUndefined()
    })

    it("returns false when deleting non-existent key", () => {
      const registry = createWeakRegistry<{ value: number }>()

      const result = registry.delete("nonexistent")

      expect(result).toBe(false)
    })
  })

  describe("clear operation", () => {
    it("removes all entries", () => {
      const registry = createWeakRegistry<{ value: number }>()

      registry.set("a", { value: 1 })
      registry.set("b", { value: 2 })
      registry.set("c", { value: 3 })

      registry.clear()

      expect(registry.get("a")).toBeUndefined()
      expect(registry.get("b")).toBeUndefined()
      expect(registry.get("c")).toBeUndefined()
    })
  })

  describe("values iterator", () => {
    it("iterates over all values", () => {
      const registry = createWeakRegistry<{ value: number }>()

      const obj1 = { value: 1 }
      const obj2 = { value: 2 }
      const obj3 = { value: 3 }

      registry.set("a", obj1)
      registry.set("b", obj2)
      registry.set("c", obj3)

      const values = Array.from(registry.values())

      expect(values).toHaveLength(3)
      expect(values).toContain(obj1)
      expect(values).toContain(obj2)
      expect(values).toContain(obj3)
    })

    it("returns empty iterator for empty registry", () => {
      const registry = createWeakRegistry<{ value: number }>()

      const values = Array.from(registry.values())

      expect(values).toHaveLength(0)
    })

    it("reflects current state after modifications", () => {
      const registry = createWeakRegistry<{ value: number }>()

      const obj1 = { value: 1 }
      const obj2 = { value: 2 }
      const obj3 = { value: 3 }

      registry.set("a", obj1)
      registry.set("b", obj2)

      let values = Array.from(registry.values())
      expect(values).toHaveLength(2)

      registry.set("c", obj3)
      values = Array.from(registry.values())
      expect(values).toHaveLength(3)

      registry.delete("b")
      values = Array.from(registry.values())
      expect(values).toHaveLength(2)
      expect(values).not.toContain(obj2)
    })
  })

})
