import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import type { ConsoleAdapter, LoggerEntry, LoggerEntryLevel, LoggerState } from ".";
import { BROWSER_STYLES } from "./constants";

export const buildEntry = (
  section: string,
  level: LoggerEntryLevel,
  message: string,
  args: unknown[],
  time: Date,
  config: LoggerState,
): LoggerEntry => ({
  section,
  level,
  message,
  args,
  time,
  config,
});

const hasConsoleStyleSupport: IO.IO<boolean> = () => typeof self !== "undefined" && "WorkerGlobalScope" in self;

const getConsoleFn =
  (adapter: ConsoleAdapter) =>
  (level: LoggerEntryLevel): ((msg: string, ...args: unknown[]) => IO.IO<void>) => {
    const levelMap: Record<LoggerEntryLevel, (msg: string, ...args: unknown[]) => IO.IO<void>> = {
      debug: adapter.debug,
      info: adapter.info,
      warning: adapter.warn,
      error: adapter.error,
    };
    return levelMap[level];
  };

export const logEntry = (adapter: ConsoleAdapter, entry: LoggerEntry): IO.IO<void> =>
  pipe(
    hasConsoleStyleSupport,
    IO.flatMap((isBg) => {
      const formatted = isBg ? formatServiceWorkerLog(entry) : formatBrowserLog(entry);
      const [msg, ...args] = formatted;
      const logFn = getConsoleFn(adapter)(entry.level);
      return logFn(msg, ...args);
    }),
  );

const serializeArg = (arg: unknown): unknown =>
  pipe(
    O.fromNullable(arg),
    O.match(
      () => arg,
      (value) =>
        typeof value !== "object"
          ? value
          : pipe(
              E.tryCatch(
                () => JSON.stringify(value, null, 2),
                () => String(value),
              ),
              E.match(
                (fallback) => fallback,
                (serialized) => serialized,
              ),
            ),
    ),
  );

interface FormatParts {
  readonly parts: ReadonlyArray<string>;
  readonly styles: ReadonlyArray<string>;
}

const addTimestamp =
  (entry: LoggerEntry) =>
  (acc: FormatParts): FormatParts =>
    pipe(
      O.fromPredicate((show: boolean) => show)(entry.config.showTimestamp),
      O.match(
        () => acc,
        () => ({
          parts: [...acc.parts, `%c${formatTimestamp(entry.time)}`],
          styles: [...acc.styles, BROWSER_STYLES.timestamp],
        }),
      ),
    );

const addPrefix =
  (entry: LoggerEntry) =>
  (acc: FormatParts): FormatParts =>
    pipe(
      O.fromPredicate((show: boolean) => show)(entry.config.showPrefix),
      O.match(
        () => acc,
        () => ({
          parts: [...acc.parts, "%c [hbbtv-emu]"],
          styles: [...acc.styles, BROWSER_STYLES.prefix],
        }),
      ),
    );

const addMessage =
  (entry: LoggerEntry) =>
  (acc: FormatParts): FormatParts => ({
    parts: [...acc.parts, `%c ${entry.section}%c ${entry.message}`],
    styles: [...acc.styles, BROWSER_STYLES.section, BROWSER_STYLES.message],
  });

const formatTimestamp = (date: Date): string =>
  pipe(
    date.toISOString(),
    (iso) => iso.split("T")[1],
    (time) => time.split("Z")[0],
  );

const formatBrowserLog = (entry: LoggerEntry): [string, ...unknown[]] =>
  pipe({ parts: [], styles: [] }, addTimestamp(entry), addPrefix(entry), addMessage(entry), ({ parts, styles }) => {
    const serializedArgs = pipe(Array.from(entry.args), A.map(serializeArg));
    return [parts.join(""), ...styles, ...serializedArgs];
  });

const formatServiceWorkerLog = (entry: LoggerEntry): [string, ...unknown[]] => {
  const timestamp = pipe(
    O.fromPredicate((show: boolean) => show)(entry.config.showTimestamp),
    O.match(
      () => "",
      () => `${formatTimestamp(entry.time)} `,
    ),
  );

  const prefix = pipe(
    O.fromPredicate((show: boolean) => show)(entry.config.showPrefix),
    O.match(
      () => "",
      () => "[hbbtv-emu] ",
    ),
  );

  const logPrefix = `${timestamp}${prefix}${entry.section} > ${entry.message}`;
  const serializedArgs = pipe(Array.from(entry.args), A.map(serializeArg));

  return [logPrefix, ...serializedArgs];
};
