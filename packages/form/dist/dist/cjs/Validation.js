"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.routeErrorsWithSource = exports.routeErrors = exports.extractFirstError = void 0;
var Option = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/Option"));
var ParseResult = /*#__PURE__*/_interopRequireWildcard(/*#__PURE__*/require("effect/ParseResult"));
var _Path = /*#__PURE__*/require("./Path.js");
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
const getBaseAST = ast => {
  switch (ast._tag) {
    case "Refinement":
    case "Transformation":
      return getBaseAST(ast.from);
    default:
      return ast;
  }
};
const isCompositeType = ast => {
  const base = getBaseAST(ast);
  switch (base._tag) {
    case "TypeLiteral": // Schema.Struct
    case "TupleType": // Schema.Tuple
    case "Declaration": // Schema.Class, Schema.TaggedClass
    case "Union": // Schema.Union
    case "Suspend":
      // Recursive schemas
      return true;
    default:
      return false;
  }
};
const extractFirstError = error => {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error);
  if (issues.length === 0) {
    return Option.none();
  }
  return Option.some(issues[0].message);
};
exports.extractFirstError = extractFirstError;
const routeErrors = error => {
  const result = new Map();
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error);
  for (const issue of issues) {
    const fieldPath = (0, _Path.schemaPathToFieldPath)(issue.path);
    if (fieldPath && !result.has(fieldPath)) {
      result.set(fieldPath, issue.message);
    }
  }
  return result;
};
exports.routeErrors = routeErrors;
const determineErrorSources = error => {
  const sources = new Map();
  const walk = (issue, path, source) => {
    switch (issue._tag) {
      case "Refinement":
        if (issue.kind === "Predicate" && isCompositeType(issue.ast.from) && path.length === 0) {
          walk(issue.issue, path, "refinement");
        } else {
          walk(issue.issue, path, source);
        }
        break;
      case "Pointer":
        {
          const pointerPath = Array.isArray(issue.path) ? issue.path : [issue.path];
          walk(issue.issue, [...path, ...pointerPath], source);
          break;
        }
      case "Composite":
        {
          const issues = Array.isArray(issue.issues) ? issue.issues : [issue.issues];
          for (const sub of issues) {
            walk(sub, path, source);
          }
          break;
        }
      case "Type":
      case "Missing":
      case "Unexpected":
      case "Forbidden":
        {
          const fieldPath = (0, _Path.schemaPathToFieldPath)(path);
          const key = fieldPath ?? "";
          if (!sources.has(key)) {
            sources.set(key, source);
          }
          break;
        }
      case "Transformation":
        if (issue.kind === "Transformation" && issue.ast.transformation._tag === "FinalTransformation" && isCompositeType(issue.ast.from) && path.length === 0) {
          walk(issue.issue, path, "refinement");
        } else {
          walk(issue.issue, path, source);
        }
        break;
    }
  };
  walk(error.issue, [], "field");
  return sources;
};
const routeErrorsWithSource = error => {
  const result = new Map();
  const formattedIssues = ParseResult.ArrayFormatter.formatErrorSync(error);
  const sources = determineErrorSources(error);
  for (const issue of formattedIssues) {
    const fieldPath = (0, _Path.schemaPathToFieldPath)(issue.path);
    const key = fieldPath ?? "";
    if (!result.has(key)) {
      const source = sources.get(key) ?? "field";
      result.set(key, {
        message: issue.message,
        source
      });
    }
  }
  return result;
};
exports.routeErrorsWithSource = routeErrorsWithSource;
//# sourceMappingURL=Validation.js.map