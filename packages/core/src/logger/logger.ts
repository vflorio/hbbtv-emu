import * as D from "fp-ts/Date";
import * as IO from "fp-ts/IO";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import type { ConsoleAdapter, LoggerEntryLevel, LoggerState } from ".";
import { DEFAULT_LOGGER_STATE, standardConsoleAdapter } from "./constants";
import { buildEntry, logEntry } from "./entry";

export class Logger {
  constructor(
    private readonly section: string,
    private readonly config: LoggerState = DEFAULT_LOGGER_STATE,
    private readonly consoleAdapter: ConsoleAdapter = standardConsoleAdapter,
  ) {}

  readonly create = (subsection: string): Logger =>
    new Logger(`${this.section} | ${subsection}`, this.config, this.consoleAdapter);

  readonly withConfig = (config: Partial<LoggerState>): Logger => {
    const newConfig: LoggerState = {
      ...this.config,
      ...config,
      enabledLevels: {
        ...this.config.enabledLevels,
        ...(config.enabledLevels ?? {}),
      },
    };
    return new Logger(this.section, newConfig, this.consoleAdapter);
  };

  private readonly log =
    (level: LoggerEntryLevel) =>
    (message: string, ...args: unknown[]): IO.IO<void> =>
      pipe(
        O.fromPredicate((enabled: boolean) => enabled)(this.config.enabledLevels[level]),
        O.match(
          () => IO.of(undefined),
          () =>
            pipe(
              D.create,
              IO.flatMap((time) =>
                pipe(buildEntry(this.section, level, message, args, time, this.config), (entry) =>
                  logEntry(this.consoleAdapter, entry),
                ),
              ),
            ),
        ),
      );

  readonly debug = this.log("debug");
  readonly info = this.log("info");
  readonly warn = this.log("warning");
  readonly error = this.log("error");
}

const mergeConfig = (config?: Partial<LoggerState>): LoggerState =>
  pipe(
    O.fromNullable(config),
    O.match(
      () => DEFAULT_LOGGER_STATE,
      (current) => ({
        enabledLevels: {
          ...DEFAULT_LOGGER_STATE.enabledLevels,
          ...current.enabledLevels,
        },
        showTimestamp: current.showTimestamp ?? DEFAULT_LOGGER_STATE.showTimestamp,
        showPrefix: current.showPrefix ?? DEFAULT_LOGGER_STATE.showPrefix,
      }),
    ),
  );

export const createLogger = (section: string, config?: Partial<LoggerState>): Logger =>
  new Logger(section, mergeConfig(config));
