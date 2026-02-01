"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeField = exports.makeArrayField = exports.isFieldDef = exports.isArrayFieldDef = exports.getDefaultFromSchema = exports.getDefaultEncodedValues = exports.createTouchedRecord = exports.TypeId = void 0;
var Schema = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/Schema"));
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
const TypeId = exports.TypeId = /*#__PURE__*/Symbol.for("@lucas-barake/effect-form/Field");
const isArrayFieldDef = def => def._tag === "array";
exports.isArrayFieldDef = isArrayFieldDef;
const isFieldDef = def => def._tag === "field";
exports.isFieldDef = isFieldDef;
const makeField = (key, schema) => ({
  _tag: "field",
  key,
  schema
});
exports.makeField = makeField;
const makeArrayField = (key, itemSchema) => ({
  _tag: "array",
  key,
  itemSchema
});
exports.makeArrayField = makeArrayField;
const getDefaultFromSchema = schema => {
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
exports.getDefaultFromSchema = getDefaultFromSchema;
const getDefaultEncodedValues = fields => {
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
exports.getDefaultEncodedValues = getDefaultEncodedValues;
const createTouchedRecord = (fields, value) => {
  const result = {};
  for (const key of Object.keys(fields)) {
    result[key] = value;
  }
  return result;
};
exports.createTouchedRecord = createTouchedRecord;
//# sourceMappingURL=Field.js.map