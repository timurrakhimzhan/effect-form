"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeFieldRef = exports.makeArrayFieldRef = exports.isFormBuilder = exports.empty = exports.buildSchema = exports.TypeId = exports.FieldTypeId = exports.ArrayFieldTypeId = void 0;
var Predicate = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/Predicate"));
var Schema = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/Schema"));
var _Field = /*#__PURE__*/require("./Field.js");
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
const FieldTypeId = exports.FieldTypeId = /*#__PURE__*/Symbol.for("@lucas-barake/effect-form/Field");
const ArrayFieldTypeId = exports.ArrayFieldTypeId = /*#__PURE__*/Symbol.for("@lucas-barake/effect-form/ArrayField");
const makeFieldRef = key => ({
  [FieldTypeId]: FieldTypeId,
  _S: undefined,
  key
});
exports.makeFieldRef = makeFieldRef;
const makeArrayFieldRef = key => ({
  [ArrayFieldTypeId]: ArrayFieldTypeId,
  _S: undefined,
  key
});
exports.makeArrayFieldRef = makeArrayFieldRef;
const TypeId = exports.TypeId = /*#__PURE__*/Symbol.for("@lucas-barake/effect-form/Form");
const FormBuilderProto = {
  [TypeId]: TypeId,
  addField(keyOrField, schema) {
    const field = typeof keyOrField === "string" ? (0, _Field.makeField)(keyOrField, schema) : keyOrField;
    const newSelf = Object.create(FormBuilderProto);
    newSelf.fields = {
      ...this.fields,
      [field.key]: field
    };
    newSelf.refinements = this.refinements;
    return newSelf;
  },
  merge(other) {
    const newSelf = Object.create(FormBuilderProto);
    newSelf.fields = {
      ...this.fields,
      ...other.fields
    };
    newSelf.refinements = [...this.refinements, ...other.refinements];
    return newSelf;
  },
  refine(predicate) {
    const newSelf = Object.create(FormBuilderProto);
    newSelf.fields = this.fields;
    newSelf.refinements = [...this.refinements, {
      _tag: "sync",
      fn: values => predicate(values)
    }];
    return newSelf;
  },
  refineEffect(predicate) {
    const newSelf = Object.create(FormBuilderProto);
    newSelf.fields = this.fields;
    newSelf.refinements = [...this.refinements, {
      _tag: "async",
      fn: values => predicate(values)
    }];
    return newSelf;
  }
};
const isFormBuilder = u => Predicate.hasProperty(u, TypeId);
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
exports.isFormBuilder = isFormBuilder;
const empty = exports.empty = /*#__PURE__*/(() => {
  const self = /*#__PURE__*/Object.create(FormBuilderProto);
  self.fields = {};
  self.refinements = [];
  return self;
})();
const buildSchema = self => {
  const schemaFields = {};
  for (const [key, def] of Object.entries(self.fields)) {
    if ((0, _Field.isArrayFieldDef)(def)) {
      schemaFields[key] = def.arraySchema;
    } else if ((0, _Field.isFieldDef)(def)) {
      schemaFields[key] = def.schema;
    }
  }
  let schema = Schema.Struct(schemaFields);
  for (const refinement of self.refinements) {
    if (refinement._tag === "sync") {
      schema = schema.pipe(Schema.filter(refinement.fn));
    } else {
      schema = schema.pipe(Schema.filterEffect(refinement.fn));
    }
  }
  return schema;
};
exports.buildSchema = buildSchema;
//# sourceMappingURL=FormBuilder.js.map