export interface WeakRegistry<V extends object> {
    readonly get: (key: string) => V | undefined;
    readonly set: (key: string, value: V) => void;
    readonly delete: (key: string) => boolean;
    readonly clear: () => void;
    readonly values: () => IterableIterator<V>;
}
export declare const createWeakRegistry: <V extends object>() => WeakRegistry<V>;
//# sourceMappingURL=weak-registry.d.ts.map