import type { ConsoleAdapter, LoggerState } from ".";

export const BROWSER_STYLES = {
  timestamp: "color: #6272a4;",
  prefix: "color: #bd93f9; font-weight: bold;",
  section: "color: #50fa7b; font-weight: bold;",
  message: "color: #8be9fd;",
} as const;

export const DEFAULT_LOGGER_STATE: LoggerState = {
  enabledLevels: {
    debug: true,
    info: true,
    warning: true,
    error: true,
  },
  showTimestamp: true,
  showPrefix: true,
};

export const standardConsoleAdapter: ConsoleAdapter = {
  debug:
    (msg, ...args) =>
    () =>
      console.debug(msg, ...args),
  info:
    (msg, ...args) =>
    () =>
      console.info(msg, ...args),
  warn:
    (msg, ...args) =>
    () =>
      console.warn(msg, ...args),
  error:
    (msg, ...args) =>
    () =>
      console.error(msg, ...args),
};
