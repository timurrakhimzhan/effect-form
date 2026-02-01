import * as Atom from "@effect-atom/atom/Atom";
import { Field, FormAtoms } from "@lucas-barake/effect-form";
import type * as FormBuilder from "@lucas-barake/effect-form/FormBuilder";
import type * as Mode from "@lucas-barake/effect-form/Mode";
import type * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as ParseResult from "effect/ParseResult";
import type * as Schema from "effect/Schema";
import * as React from "react";
export type FieldValue<T> = T extends Schema.Schema.Any ? Schema.Schema.Encoded<T> : T;
export interface FieldState<E> {
    readonly value: E;
    readonly onChange: (value: E) => void;
    readonly onBlur: () => void;
    readonly error: Option.Option<string>;
    readonly isTouched: boolean;
    readonly isValidating: boolean;
    readonly isDirty: boolean;
}
export interface FieldComponentProps<E, P = Record<string, never>> {
    readonly field: FieldState<E>;
    readonly props: P;
}
export type FieldComponent<T, P = Record<string, never>> = React.FC<FieldComponentProps<FieldValue<T>, P>>;
export type ExtractExtraProps<C> = C extends React.FC<FieldComponentProps<any, infer P>> ? P : Record<string, never>;
/**
 * Helper type to extract struct fields from a schema, handling filter/refine wrappers.
 * Follows Effect's HasFields pattern: Schema.Struct or { [RefineSchemaId]: HasFields }
 */
type ExtractStructFields<S extends Schema.Schema.Any> = S extends Schema.Struct<infer Fields> ? Fields : S extends {
    readonly [Schema.RefineSchemaId]: infer From;
} ? From extends Schema.Schema.Any ? ExtractStructFields<From> : never : never;
export type ArrayItemComponentMap<S extends Schema.Schema.Any> = ExtractStructFields<S> extends never ? React.FC<FieldComponentProps<Schema.Schema.Encoded<S>, any>> : {
    readonly [K in keyof ExtractStructFields<S>]: ExtractStructFields<S>[K] extends Schema.Schema.Any ? React.FC<FieldComponentProps<Schema.Schema.Encoded<ExtractStructFields<S>[K]>, any>> : never;
};
export type FieldComponentMap<TFields extends Field.FieldsRecord> = {
    readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S> ? React.FC<FieldComponentProps<Schema.Schema.Encoded<S>, any>> : TFields[K] extends Field.ArrayFieldDef<any, infer S, any> ? ArrayItemComponentMap<S> : never;
};
export type FieldRefs<TFields extends Field.FieldsRecord> = FormAtoms.FieldRefs<TFields>;
export interface ArrayFieldOperations<TItem> {
    readonly items: ReadonlyArray<TItem>;
    readonly append: (value?: TItem) => void;
    readonly remove: (index: number) => void;
    readonly swap: (indexA: number, indexB: number) => void;
    readonly move: (from: number, to: number) => void;
}
export type BuiltForm<TFields extends Field.FieldsRecord, R, A = void, E = never, SubmitArgs = void, CM extends FieldComponentMap<TFields> = FieldComponentMap<TFields>> = {
    readonly values: Atom.Atom<Option.Option<Field.EncodedFromFields<TFields>>>;
    readonly isDirty: Atom.Atom<boolean>;
    readonly hasChangedSinceSubmit: Atom.Atom<boolean>;
    readonly lastSubmittedValues: Atom.Atom<Option.Option<FormBuilder.SubmittedValues<TFields>>>;
    readonly submitCount: Atom.Atom<number>;
    readonly schema: Schema.Schema<Field.DecodedFromFields<TFields>, Field.EncodedFromFields<TFields>, R>;
    readonly fields: FieldRefs<TFields>;
    readonly Initialize: React.FC<{
        readonly defaultValues: Field.EncodedFromFields<TFields>;
        readonly children: React.ReactNode;
    }>;
    readonly submit: Atom.AtomResultFn<SubmitArgs, A, E | ParseResult.ParseError>;
    readonly reset: Atom.Writable<void, void>;
    readonly revertToLastSubmit: Atom.Writable<void, void>;
    readonly setValues: Atom.Writable<void, Field.EncodedFromFields<TFields>>;
    readonly setValue: <S>(field: FormBuilder.FieldRef<S> | FormBuilder.ArrayFieldRef<S>) => Atom.Writable<void, S | ((prev: S) => S)>;
    readonly getFieldAtom: {
        <S>(field: FormBuilder.FieldRef<S>): Atom.Atom<Option.Option<S>>;
        <S>(field: FormBuilder.ArrayFieldRef<S>): Atom.Atom<Option.Option<ReadonlyArray<S>>>;
    };
    readonly getField: <S>(field: FormBuilder.FieldRef<S>) => FormAtoms.PublicFieldAtoms<S>;
    readonly getArrayField: <S>(field: FormBuilder.ArrayFieldRef<S>) => FormAtoms.PublicArrayFieldAtoms<S>;
    readonly mount: Atom.Atom<void>;
    readonly KeepAlive: React.FC;
} & FieldComponents<TFields, CM>;
type FieldComponents<TFields extends Field.FieldsRecord, CM extends FieldComponentMap<TFields>> = {
    readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, any> ? React.FC<ExtractExtraProps<CM[K]>> : TFields[K] extends Field.ArrayFieldDef<any, infer S, any> ? ArrayFieldComponent<S, ExtractArrayItemExtraProps<CM[K], S>> : never;
};
type ExtractArrayItemExtraProps<CM, S extends Schema.Schema.Any> = ExtractStructFields<S> extends never ? CM extends React.FC<FieldComponentProps<any, infer P>> ? P : never : {
    readonly [K in keyof ExtractStructFields<S>]: CM extends {
        readonly [P in K]: infer C;
    } ? ExtractExtraProps<C> : never;
};
type ArrayFieldComponent<S extends Schema.Schema.Any, ExtraPropsMap> = React.FC<{
    readonly children: (ops: ArrayFieldOperations<Schema.Schema.Encoded<S>>) => React.ReactNode;
}> & {
    readonly Item: React.FC<{
        readonly index: number;
        readonly children: React.ReactNode | ((props: {
            readonly remove: () => void;
        }) => React.ReactNode);
    }>;
} & (ExtractStructFields<S> extends never ? unknown : {
    readonly [K in keyof ExtractStructFields<S>]: React.FC<ExtraPropsMap extends {
        readonly [P in K]: infer EP;
    } ? EP : Record<string, never>>;
});
export declare const make: {
    <TFields extends Field.FieldsRecord, A, E, SubmitArgs = void, CM extends FieldComponentMap<TFields> = FieldComponentMap<TFields>>(self: FormBuilder.FormBuilder<TFields, never>, options: {
        readonly runtime?: Atom.AtomRuntime<never, never>;
        readonly fields: CM;
        readonly mode?: SubmitArgs extends void ? Mode.FormMode : Mode.FormModeWithoutAutoSubmit;
        readonly onSubmit: (args: SubmitArgs, ctx: {
            readonly decoded: Field.DecodedFromFields<TFields>;
            readonly encoded: Field.EncodedFromFields<TFields>;
            readonly get: Atom.FnContext;
        }) => A | Effect.Effect<A, E, never>;
    }): BuiltForm<TFields, never, A, E, SubmitArgs, CM>;
    <TFields extends Field.FieldsRecord, R, A, E, SubmitArgs = void, ER = never, CM extends FieldComponentMap<TFields> = FieldComponentMap<TFields>>(self: FormBuilder.FormBuilder<TFields, R>, options: {
        readonly runtime: Atom.AtomRuntime<R, ER>;
        readonly fields: CM;
        readonly mode?: SubmitArgs extends void ? Mode.FormMode : Mode.FormModeWithoutAutoSubmit;
        readonly onSubmit: (args: SubmitArgs, ctx: {
            readonly decoded: Field.DecodedFromFields<TFields>;
            readonly encoded: Field.EncodedFromFields<TFields>;
            readonly get: Atom.FnContext;
        }) => A | Effect.Effect<A, E, R>;
    }): BuiltForm<TFields, R, A, E, SubmitArgs, CM>;
};
export {};
//# sourceMappingURL=FormReact.d.ts.map