import * as Schema from "effect/Schema";
export const TypeId = /*#__PURE__*/Symbol.for("@lucas-barake/effect-form/Field");
export const isArrayFieldDef = def => def._tag === "array";
export const isFieldDef = def => def._tag === "field";
export const makeField = (key, schema) => ({
  _tag: "field",
  key,
  schema
});
export const makeArrayField = (key, itemSchema, modify) => ({
  _tag: "array",
  key,
  itemSchema,
  arraySchema: modify ? modify(Schema.Array(itemSchema)) : Schema.Array(itemSchema)
});
export const getDefaultFromSchema = schema => {
  const ast = schema.ast;
  switch (ast._tag) {
    case "StringKeyword":
    case "TemplateLiteral":
      return "";
    case "NumberKeyword":
      return 0;
    case "BooleanKeyword":
      return false;
    case "TypeLiteral":
      {
        const result = {};
        for (const prop of ast.propertySignatures) {
          result[prop.name] = getDefaultFromSchema(Schema.make(prop.type));
        }
        return result;
      }
    case "Transformation":
      return getDefaultFromSchema(Schema.make(ast.from));
    case "Refinement":
      return getDefaultFromSchema(Schema.make(ast.from));
    case "Suspend":
      return getDefaultFromSchema(Schema.make(ast.f()));
    default:
      return "";
  }
};
export const getDefaultEncodedValues = fields => {
  const result = {};
  for (const [key, def] of Object.entries(fields)) {
    if (isArrayFieldDef(def)) {
      result[key] = [];
    } else {
      result[key] = "";
    }
  }
  return result;
};
export const createTouchedRecord = (fields, value) => {
  const result = {};
  for (const key of Object.keys(fields)) {
    result[key] = value;
  }
  return result;
};
//# sourceMappingURL=Field.js.map