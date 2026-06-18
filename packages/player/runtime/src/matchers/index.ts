import type { match } from "ts-pattern";

export * from "./events";
export * from "./predicates";
export * from "./source";
export * from "./state";

export type Match<S, T> = ReturnType<typeof match<S, T>>;
