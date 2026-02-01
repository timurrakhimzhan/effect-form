import * as Schema from "effect/Schema"
import { describe, expect, it } from "vitest"
import * as Field from "../src/Field.js"

describe("Field", () => {
  describe("getDefaultEncodedValues", () => {
    it("returns empty string for scalar fields", () => {
      const EmailField = Field.makeField("email", Schema.String)
      const AgeField = Field.makeField("age", Schema.Number)

      const fields = {
        email: EmailField,
        age: AgeField,
      }

      const defaults = Field.getDefaultEncodedValues(fields)

      expect(defaults).toEqual({ email: "", age: "" })
    })

    it("returns empty array for array fields", () => {
      const TitleField = Field.makeField("title", Schema.String)
      const ItemsField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))

      const fields = {
        title: TitleField,
        items: ItemsField,
      }

      const defaults = Field.getDefaultEncodedValues(fields)

      expect(defaults).toEqual({ title: "", items: [] })
    })
  })

  describe("makeArrayField with modify", () => {
    it("applies schema modifications to array schema", () => {
      const ItemsField = Field.makeArrayField(
        "items",
        Schema.Struct({ name: Schema.String }),
        (schema) => schema.pipe(Schema.minItems(1)),
      )

      expect(ItemsField._tag).toBe("array")
      expect(ItemsField.key).toBe("items")

      // arraySchema should have the minItems constraint
      const result = Schema.decodeUnknownEither(ItemsField.arraySchema)([])
      expect(result._tag).toBe("Left") // Empty array should fail validation

      const validResult = Schema.decodeUnknownEither(ItemsField.arraySchema)([{ name: "test" }])
      expect(validResult._tag).toBe("Right")
    })

    it("works without modify function (default behavior)", () => {
      const ItemsField = Field.makeArrayField(
        "items",
        Schema.Struct({ name: Schema.String }),
      )

      // arraySchema should just be Schema.Array without constraints
      const result = Schema.decodeUnknownEither(ItemsField.arraySchema)([])
      expect(result._tag).toBe("Right") // Empty array should pass
    })
  })

  describe("type guards", () => {
    it("isFieldDef identifies scalar field definitions", () => {
      const EmailField = Field.makeField("email", Schema.String)
      const ItemsField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))

      expect(Field.isFieldDef(EmailField)).toBe(true)
      expect(Field.isFieldDef(ItemsField)).toBe(false)
    })

    it("isArrayFieldDef identifies array field definitions", () => {
      const EmailField = Field.makeField("email", Schema.String)
      const ItemsField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))

      expect(Field.isArrayFieldDef(ItemsField)).toBe(true)
      expect(Field.isArrayFieldDef(EmailField)).toBe(false)
    })
  })
})
