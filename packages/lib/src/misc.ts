type LogLevel = "log" | "error" | "warn" | "info" | "debug";

export const createLogger = (section: string) => {
  const createLog =
    (level: LogLevel) =>
    (message: string, ...args: unknown[]) => {
      const prefixStyle = "color: #83a598; font-weight: bold;";
      const sectionStyle = "color: #fabd2f; font-weight: bold;";
      const messageStyle = "color: #b8bb26;";

      console[level](
        `%c[hbbtv-emu]%c ${section}%c ${message}`,
        prefixStyle,
        sectionStyle,
        messageStyle,
        ...args,
      );
    };

  return {
    log: createLog("log"),
    error: createLog("error"),
    warn: createLog("warn"),
    info: createLog("info"),
    debug: createLog("debug"),
  };
};

export interface Collection<T> {
  readonly length: number;
  item(index: number): T | null;
  [index: number]: T;
}

export const createEmptyCollection = <T>(): Collection<T> => ({
  length: 0,
  item: () => null,
});

export interface App {
  init: () => void;
}

export const initApp = (app: App) => {
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        app.init();
      });
    } else {
      app.init();
    }
  }

  if (typeof self !== "undefined" && "ServiceWorkerGlobalScope" in self) {
    self.addEventListener("activate", () => {
      app.init();
    });
  }
};
