import * as Schema from "effect/Schema";
export declare const TypeId: unique symbol;
export type TypeId = typeof TypeId;
export interface FieldDef<K extends string, S extends Schema.Schema.Any> {
    readonly _tag: "field";
    readonly key: K;
    readonly schema: S;
}
export interface ArrayFieldDef<K extends string, S extends Schema.Schema.Any> {
    readonly _tag: "array";
    readonly key: K;
    readonly itemSchema: S;
}
export type AnyFieldDef = FieldDef<string, Schema.Schema.Any> | ArrayFieldDef<string, Schema.Schema.Any>;
export type FieldsRecord = Record<string, AnyFieldDef>;
export declare const isArrayFieldDef: (def: AnyFieldDef) => def is ArrayFieldDef<string, Schema.Schema.Any>;
export declare const isFieldDef: (def: AnyFieldDef) => def is FieldDef<string, Schema.Schema.Any>;
export declare const makeField: <K extends string, S extends Schema.Schema.Any>(key: K, schema: S) => FieldDef<K, S>;
export declare const makeArrayField: <K extends string, S extends Schema.Schema.Any>(key: K, itemSchema: S) => ArrayFieldDef<K, S>;
export type EncodedFromFields<T extends FieldsRecord> = {
    readonly [K in keyof T]: T[K] extends FieldDef<any, infer S> ? Schema.Schema.Encoded<S> : T[K] extends ArrayFieldDef<any, infer S> ? ReadonlyArray<Schema.Schema.Encoded<S>> : never;
};
export type DecodedFromFields<T extends FieldsRecord> = {
    readonly [K in keyof T]: T[K] extends FieldDef<any, infer S> ? Schema.Schema.Type<S> : T[K] extends ArrayFieldDef<any, infer S> ? ReadonlyArray<Schema.Schema.Type<S>> : never;
};
export declare const getDefaultFromSchema: (schema: Schema.Schema.Any) => unknown;
export declare const getDefaultEncodedValues: (fields: FieldsRecord) => Record<string, unknown>;
export declare const createTouchedRecord: (fields: FieldsRecord, value: boolean) => Record<string, boolean>;
//# sourceMappingURL=Field.d.ts.map