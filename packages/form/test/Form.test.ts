import { Form } from "@lucas-barake/effect-form"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { describe, expect, it } from "vitest"

describe("Form", () => {
  describe("FormBuilder", () => {
    it("empty creates an empty FormBuilder", () => {
      expect(Form.isFormBuilder(Form.empty)).toBe(true)
      expect(Form.empty.fields).toEqual({})
    })

    it("addField adds a field to the builder", () => {
      const builder = Form.empty.addField(Form.makeField("email", Schema.String))

      expect(Form.isFormBuilder(builder)).toBe(true)
      expect(builder.fields).toHaveProperty("email")
      expect(builder.fields.email._tag).toBe("field")
    })

    it("multiple addField calls accumulate fields", () => {
      const builder = Form.empty
        .addField(Form.makeField("email", Schema.String))
        .addField(Form.makeField("password", Schema.String))
        .addField(Form.makeField("age", Schema.Number))

      expect(Object.keys(builder.fields)).toEqual(["email", "password", "age"])
    })

    it("addArray adds an array field", () => {
      const itemForm = Form.empty
        .addField(Form.makeField("street", Schema.String))
        .addField(Form.makeField("city", Schema.String))

      const builder = Form.empty
        .addField(Form.makeField("name", Schema.String))
        .addField(Form.makeArrayField("addresses", itemForm))

      expect(builder.fields.addresses._tag).toBe("array")
      expect(Form.isArrayFieldDef(builder.fields.addresses)).toBe(true)
    })

    it("merge combines two form builders", () => {
      const addressFields = Form.empty
        .addField(Form.makeField("street", Schema.String))
        .addField(Form.makeField("city", Schema.String))

      const builder = Form.empty
        .addField(Form.makeField("name", Schema.String))
        .merge(addressFields)

      expect(Object.keys(builder.fields)).toEqual(["name", "street", "city"])
    })
  })

  describe("buildSchema", () => {
    it("builds a Schema from simple fields", () => {
      const builder = Form.empty
        .addField(Form.makeField("email", Schema.String))
        .addField(Form.makeField("age", Schema.Number))

      const schema = Form.buildSchema(builder)
      const result = Schema.decodeUnknownSync(schema)({ email: "test@example.com", age: 25 })

      expect(result).toEqual({ email: "test@example.com", age: 25 })
    })

    it("builds a Schema with array fields", () => {
      const itemForm = Form.empty.addField(Form.makeField("name", Schema.String))

      const builder = Form.empty
        .addField(Form.makeField("title", Schema.String))
        .addField(Form.makeArrayField("items", itemForm))

      const schema = Form.buildSchema(builder)
      const result = Schema.decodeUnknownSync(schema)({
        title: "My List",
        items: [{ name: "Item 1" }, { name: "Item 2" }],
      })

      expect(result).toEqual({
        title: "My List",
        items: [{ name: "Item 1" }, { name: "Item 2" }],
      })
    })

    it("validates with schema constraints", () => {
      const Email = Schema.String.pipe(Schema.pattern(/@/))

      const builder = Form.empty.addField(Form.makeField("email", Email))

      const schema = Form.buildSchema(builder)

      expect(() => Schema.decodeUnknownSync(schema)({ email: "invalid" })).toThrow()
      expect(Schema.decodeUnknownSync(schema)({ email: "valid@example.com" })).toEqual({
        email: "valid@example.com",
      })
    })

    it("applies refinements in buildSchema", () => {
      const builder = Form.empty
        .addField(Form.makeField("password", Schema.String))
        .addField(Form.makeField("confirmPassword", Schema.String))
        .refine((values, ctx) => {
          if (values.password !== values.confirmPassword) {
            return ctx.error("confirmPassword", "Passwords must match")
          }
        })

      const schema = Form.buildSchema(builder)

      expect(() => Schema.decodeUnknownSync(schema)({ password: "secret", confirmPassword: "different" })).toThrow()

      expect(
        Schema.decodeUnknownSync(schema)({ password: "secret", confirmPassword: "secret" }),
      ).toEqual({ password: "secret", confirmPassword: "secret" })
    })

    it("applies async refinements with refineEffect", async () => {
      const builder = Form.empty
        .addField(Form.makeField("username", Schema.String))
        .refineEffect((values, ctx) =>
          Effect.gen(function*() {
            yield* Effect.sleep("1 millis")
            if (values.username === "taken") {
              return ctx.error("username", "Username is already taken")
            }
          })
        )

      const schema = Form.buildSchema(builder)

      await expect(
        Effect.runPromise(Schema.decodeUnknown(schema)({ username: "taken" })),
      ).rejects.toThrow()

      const result = await Effect.runPromise(
        Schema.decodeUnknown(schema)({ username: "available" }),
      )
      expect(result).toEqual({ username: "available" })
    })

    it("applies multiple chained refinements", () => {
      const builder = Form.empty
        .addField(Form.makeField("a", Schema.String))
        .addField(Form.makeField("b", Schema.String))
        .refine((values, ctx) => {
          if (values.a === "error") {
            return ctx.error("a", "First refinement failed")
          }
        })
        .refine((values, ctx) => {
          if (values.b === "error") {
            return ctx.error("b", "Second refinement failed")
          }
        })

      const schema = Form.buildSchema(builder)

      // First refinement fails
      expect(() => Schema.decodeUnknownSync(schema)({ a: "error", b: "ok" })).toThrow(/First refinement failed/)

      // Second refinement fails
      expect(() => Schema.decodeUnknownSync(schema)({ a: "ok", b: "error" })).toThrow(/Second refinement failed/)

      // Both pass
      expect(Schema.decodeUnknownSync(schema)({ a: "ok", b: "ok" })).toEqual({ a: "ok", b: "ok" })
    })
  })

  describe("helpers", () => {
    it("getDefaultEncodedValues returns empty values", () => {
      const builder = Form.empty
        .addField(Form.makeField("email", Schema.String))
        .addField(Form.makeField("age", Schema.Number))

      const defaults = Form.getDefaultEncodedValues(builder.fields)

      expect(defaults).toEqual({ email: "", age: "" })
    })

    it("getDefaultEncodedValues returns empty array for array fields", () => {
      const itemForm = Form.empty.addField(Form.makeField("name", Schema.String))
      const builder = Form.empty
        .addField(Form.makeField("title", Schema.String))
        .addField(Form.makeArrayField("items", itemForm))

      const defaults = Form.getDefaultEncodedValues(builder.fields)

      expect(defaults).toEqual({ title: "", items: [] })
    })

    it("createTouchedRecord creates record with given value", () => {
      const builder = Form.empty
        .addField(Form.makeField("email", Schema.String))
        .addField(Form.makeField("password", Schema.String))

      const touched = Form.createTouchedRecord(builder.fields, false)
      expect(touched).toEqual({ email: false, password: false })

      const allTouched = Form.createTouchedRecord(builder.fields, true)
      expect(allTouched).toEqual({ email: true, password: true })
    })
  })

  describe("type guards", () => {
    it("isFormBuilder correctly identifies FormBuilder", () => {
      expect(Form.isFormBuilder(Form.empty)).toBe(true)
      expect(Form.isFormBuilder({})).toBe(false)
    })

    it("isFieldDef and isArrayFieldDef work correctly", () => {
      const itemForm = Form.empty.addField(Form.makeField("name", Schema.String))
      const builder = Form.empty
        .addField(Form.makeField("email", Schema.String))
        .addField(Form.makeArrayField("items", itemForm))

      expect(Form.isFieldDef(builder.fields.email)).toBe(true)
      expect(Form.isArrayFieldDef(builder.fields.email)).toBe(false)

      expect(Form.isArrayFieldDef(builder.fields.items)).toBe(true)
      expect(Form.isFieldDef(builder.fields.items)).toBe(false)
    })
  })
})
