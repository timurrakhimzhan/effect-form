"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  Field: true,
  FormAtoms: true,
  FormBuilder: true,
  FormReact: true,
  useFormField: true,
  useArrayField: true,
  FormProvider: true,
  useFormContext: true
};
Object.defineProperty(exports, "Field", {
  enumerable: true,
  get: function () {
    return _effectForm.Field;
  }
});
Object.defineProperty(exports, "FormAtoms", {
  enumerable: true,
  get: function () {
    return _effectForm.FormAtoms;
  }
});
Object.defineProperty(exports, "FormBuilder", {
  enumerable: true,
  get: function () {
    return _effectForm.FormBuilder;
  }
});
Object.defineProperty(exports, "FormProvider", {
  enumerable: true,
  get: function () {
    return _FormProvider.FormProvider;
  }
});
exports.FormReact = void 0;
Object.defineProperty(exports, "useArrayField", {
  enumerable: true,
  get: function () {
    return _useArrayField.useArrayField;
  }
});
Object.defineProperty(exports, "useFormContext", {
  enumerable: true,
  get: function () {
    return _FormProvider.useFormContext;
  }
});
Object.defineProperty(exports, "useFormField", {
  enumerable: true,
  get: function () {
    return _useFormField.useFormField;
  }
});
var _effectForm = /*#__PURE__*/require("@lucas-barake/effect-form");
var _FormReact = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("./FormReact.js"));
exports.FormReact = _FormReact;
Object.keys(_FormReact).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _FormReact[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _FormReact[key];
    }
  });
});
var _useFormField = /*#__PURE__*/require("./useFormField.js");
var _useArrayField = /*#__PURE__*/require("./useArrayField.js");
var _FormProvider = /*#__PURE__*/require("./FormProvider.js");
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
//# sourceMappingURL=index.js.map