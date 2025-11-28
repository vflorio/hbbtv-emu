import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import { isServiceWorker } from "./misc";

export type LogLevel = "log" | "error" | "warn" | "info" | "debug";

const getTimestamp = (): string => new Date().toISOString().split("T")[1].split("Z")[0];

const browserStyles = {
  timestamp: "color: #6272a4;",
  prefix: "color: #bd93f9; font-weight: bold;",
  section: "color: #50fa7b; font-weight: bold;",
  message: "color: #8be9fd;",
};

const formatServiceWorkerLog = (timestamp: string, section: string, message: string): string =>
  `${timestamp} [hbbtv-emu] ${section} ${message}`;

const formatBrowserLog = (timestamp: string, section: string, message: string): readonly [string, ...string[]] =>
  [
    `%c${timestamp}%c [hbbtv-emu]%c ${section}%c ${message}`,
    browserStyles.timestamp,
    browserStyles.prefix,
    browserStyles.section,
    browserStyles.message,
  ] as const;

const createLog =
  (section: string) =>
  (level: LogLevel) =>
  (message: string, ...args: unknown[]): IO.IO<void> =>
  () => {
    const timestamp = getTimestamp();

    pipe(isServiceWorker, (isWorker) =>
      isWorker
        ? console[level](formatServiceWorkerLog(timestamp, section, message), ...args)
        : console[level](...formatBrowserLog(timestamp, section, message), ...args),
    );
  };

export const createLogger = (section: string) => {
  const log = createLog(section);

  return {
    ...console,
    log: log("log"),
    error: log("error"),
    warn: log("warn"),
    info: log("info"),
    debug: log("debug"),
  } as typeof console;
};
