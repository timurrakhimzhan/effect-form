import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import { isArrayFieldDef, isFieldDef, makeField } from "./Field.js";
export const FieldTypeId = /*#__PURE__*/Symbol.for("@lucas-barake/effect-form/Field");
export const makeFieldRef = key => ({
  [FieldTypeId]: FieldTypeId,
  _S: undefined,
  key
});
export const TypeId = /*#__PURE__*/Symbol.for("@lucas-barake/effect-form/Form");
const FormBuilderProto = {
  [TypeId]: TypeId,
  addField(keyOrField, schema) {
    const field = typeof keyOrField === "string" ? makeField(keyOrField, schema) : keyOrField;
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
export const isFormBuilder = u => Predicate.hasProperty(u, TypeId);
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const empty = /*#__PURE__*/(() => {
  const self = /*#__PURE__*/Object.create(FormBuilderProto);
  self.fields = {};
  self.refinements = [];
  return self;
})();
export const buildSchema = self => {
  const schemaFields = {};
  for (const [key, def] of Object.entries(self.fields)) {
    if (isArrayFieldDef(def)) {
      schemaFields[key] = Schema.Array(def.itemSchema);
    } else if (isFieldDef(def)) {
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
//# sourceMappingURL=FormBuilder.js.map