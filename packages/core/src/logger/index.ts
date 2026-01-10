import type * as IO from "fp-ts/IO";

export * from "./constants";
export * from "./entry";
export * from "./logger";

export interface ConsoleAdapter {
  readonly debug: (message: string, ...args: unknown[]) => IO.IO<void>;
  readonly info: (message: string, ...args: unknown[]) => IO.IO<void>;
  readonly warn: (message: string, ...args: unknown[]) => IO.IO<void>;
  readonly error: (message: string, ...args: unknown[]) => IO.IO<void>;
}

export interface LoggerState {
  readonly enabledLevels: {
    readonly debug: boolean;
    readonly info: boolean;
    readonly warning: boolean;
    readonly error: boolean;
  };
  readonly showTimestamp: boolean;
  readonly showPrefix: boolean;
}

export type LoggerEntryLevel = "debug" | "info" | "warning" | "error";

export interface LoggerEntry {
  readonly message: string;
  readonly args: ReadonlyArray<unknown>;
  readonly time: Date;
  readonly level: LoggerEntryLevel;
  readonly section: string;
  readonly config: LoggerState;
}
