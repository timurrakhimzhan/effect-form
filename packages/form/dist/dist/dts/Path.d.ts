export declare const schemaPathToFieldPath: (path: ReadonlyArray<PropertyKey>) => string;
export declare const isPathUnderRoot: (path: string, rootPath: string) => boolean;
export declare const isPathOrParentDirty: (dirtyFields: ReadonlySet<string>, path: string) => boolean;
export declare const getNestedValue: (obj: unknown, path: string) => unknown;
export declare const setNestedValue: <T>(obj: T, path: string, value: unknown) => T;
//# sourceMappingURL=Path.d.ts.map