import * as Option from "effect/Option";
import * as ParseResult from "effect/ParseResult";
export type ErrorSource = "field" | "refinement";
export interface ErrorEntry {
    readonly message: string;
    readonly source: ErrorSource;
}
export declare const extractFirstError: (error: ParseResult.ParseError) => Option.Option<string>;
export declare const routeErrors: (error: ParseResult.ParseError) => Map<string, string>;
export declare const routeErrorsWithSource: (error: ParseResult.ParseError) => Map<string, ErrorEntry>;
//# sourceMappingURL=Validation.d.ts.map