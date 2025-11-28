import * as D from "fp-ts/Date";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import type * as L from "logging-ts/lib/IO";

type Level = "debug" | "info" | "warning" | "error";

interface Entry {
  message: string;
  args: readonly unknown[];
  time: Date;
  level: Level;
  section: string;
}

const browserStyles = {
  timestamp: "color: #6272a4;",
  prefix: "color: #bd93f9; font-weight: bold;",
  section: "color: #50fa7b; font-weight: bold;",
  message: "color: #8be9fd;",
} as const;

const formatBackgroundScriptLog = (entry: Entry): readonly [string, ...unknown[]] => {
  const timestamp = entry.time.toISOString().split("T")[1].split("Z")[0];
  return [`${timestamp} [hbbtv-emu] ${entry.section} ${entry.message}`, ...entry.args];
};

const formatBrowserLog = (entry: Entry): readonly [string, ...unknown[]] => {
  const timestamp = entry.time.toISOString().split("T")[1].split("Z")[0];
  return [
    `%c${timestamp}%c [hbbtv-emu]%c ${entry.section}%c ${entry.message}`,
    browserStyles.timestamp,
    browserStyles.prefix,
    browserStyles.section,
    browserStyles.message,
    ...entry.args,
  ];
};

const isBackgroundScript: IO.IO<boolean> = () => typeof self !== "undefined" && "WorkerGlobalScope" in self;

const consoleLogger: L.LoggerIO<Entry> = (entry) =>
  pipe(
    isBackgroundScript,
    IO.flatMap((isBackgroundScript) => () => {
      const formatted = isBackgroundScript ? formatBackgroundScriptLog(entry) : formatBrowserLog(entry);

      pipe(
        O.fromNullable(
          {
            debug: console.debug,
            info: console.info,
            warning: console.warn,
            error: console.error,
          }[entry.level],
        ),
        O.match(
          () => undefined,
          (fn) => fn(...formatted),
        ),
      );
    }),
  );

export const createLogger = (section: string) => {
  const debug = (message: string, ...args: readonly unknown[]): IO.IO<void> =>
    pipe(
      D.create,
      IO.flatMap((time) => consoleLogger({ level: "debug", message, args, time, section })),
    );

  const info = (message: string, ...args: readonly unknown[]): IO.IO<void> =>
    pipe(
      D.create,
      IO.flatMap((time) => consoleLogger({ level: "info", message, args, time, section })),
    );

  const warn = (message: string, ...args: readonly unknown[]): IO.IO<void> =>
    pipe(
      D.create,
      IO.flatMap((time) => consoleLogger({ level: "warning", message, args, time, section })),
    );

  const error = (message: string, ...args: readonly unknown[]): IO.IO<void> =>
    pipe(
      D.create,
      IO.flatMap((time) => consoleLogger({ level: "error", message, args, time, section })),
    );

  return { debug, info, warn, error };
};
