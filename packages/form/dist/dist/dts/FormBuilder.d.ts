import type * as Registry from "@effect-atom/atom/Registry";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { ArrayFieldDef, DecodedFromFields, EncodedFromFields, FieldDef, FieldsRecord } from "./Field.js";
export interface SubmittedValues<TFields extends FieldsRecord> {
    readonly encoded: EncodedFromFields<TFields>;
    readonly decoded: DecodedFromFields<TFields>;
}
export declare const FieldTypeId: unique symbol;
export type FieldTypeId = typeof FieldTypeId;
export interface FieldRef<S> {
    readonly [FieldTypeId]: FieldTypeId;
    readonly _S: S;
    readonly key: string;
}
export declare const makeFieldRef: <S>(key: string) => FieldRef<S>;
export declare const TypeId: unique symbol;
export type TypeId = typeof TypeId;
export interface FormState<TFields extends FieldsRecord> {
    readonly values: EncodedFromFields<TFields>;
    readonly initialValues: EncodedFromFields<TFields>;
    readonly lastSubmittedValues: Option.Option<SubmittedValues<TFields>>;
    readonly touched: {
        readonly [K in keyof TFields]: boolean;
    };
    readonly submitCount: number;
    readonly dirtyFields: ReadonlySet<string>;
}
interface SyncRefinement {
    readonly _tag: "sync";
    readonly fn: (values: unknown) => Schema.FilterOutput;
}
interface AsyncRefinement {
    readonly _tag: "async";
    readonly fn: (values: unknown) => Effect.Effect<Schema.FilterOutput, never, unknown>;
}
type Refinement = SyncRefinement | AsyncRefinement;
export interface FormBuilder<TFields extends FieldsRecord, R> {
    readonly [TypeId]: TypeId;
    readonly fields: TFields;
    readonly refinements: ReadonlyArray<Refinement>;
    readonly _R?: R;
    addField<K extends string, S extends Schema.Schema.Any>(this: FormBuilder<TFields, R>, field: FieldDef<K, S>): FormBuilder<TFields & {
        readonly [key in K]: FieldDef<K, S>;
    }, R | Schema.Schema.Context<S>>;
    addField<K extends string, S extends Schema.Schema.Any>(this: FormBuilder<TFields, R>, field: ArrayFieldDef<K, S>): FormBuilder<TFields & {
        readonly [key in K]: ArrayFieldDef<K, S>;
    }, R | Schema.Schema.Context<S>>;
    addField<K extends string, S extends Schema.Schema.Any>(this: FormBuilder<TFields, R>, key: K, schema: S): FormBuilder<TFields & {
        readonly [key in K]: FieldDef<K, S>;
    }, R | Schema.Schema.Context<S>>;
    merge<TFields2 extends FieldsRecord, R2>(this: FormBuilder<TFields, R>, other: FormBuilder<TFields2, R2>): FormBuilder<TFields & TFields2, R | R2>;
    refine(this: FormBuilder<TFields, R>, predicate: (values: DecodedFromFields<TFields>) => Schema.FilterOutput): FormBuilder<TFields, R>;
    refineEffect<RD>(this: FormBuilder<TFields, R>, predicate: (values: DecodedFromFields<TFields>) => Effect.Effect<Schema.FilterOutput, never, RD>): FormBuilder<TFields, R | Exclude<RD, Registry.AtomRegistry>>;
}
export declare const isFormBuilder: (u: unknown) => u is FormBuilder<any, any>;
export declare const empty: FormBuilder<{}, never>;
export declare const buildSchema: <TFields extends FieldsRecord, R>(self: FormBuilder<TFields, R>) => Schema.Schema<DecodedFromFields<TFields>, EncodedFromFields<TFields>, R>;
export {};
//# sourceMappingURL=FormBuilder.d.ts.map