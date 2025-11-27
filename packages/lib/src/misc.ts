type LogLevel = "log" | "error" | "warn" | "info" | "debug";

const isServiceWorker = typeof self !== "undefined" && "ServiceWorkerGlobalScope" in self;

export const createLogger = (section: string) => {
  const createLog =
    (level: LogLevel) =>
    (message: string, ...args: unknown[]) => {
      const timestamp = new Date().toISOString().split("T")[1].split("Z")[0];

      if (isServiceWorker) {
        // Plain text formatting for service workers
        console[level](`${timestamp} [hbbtv-emu] ${section} ${message}`, ...args);
      } else {
        // Styled formatting for browsers
        const prefixStyle = "color: #bd93f9; font-weight: bold;"; // Purple
        const sectionStyle = "color: #50fa7b; font-weight: bold;"; // Green
        const messageStyle = "color: #8be9fd;"; // Cyan
        const timestampStyle = "color: #6272a4;"; // Gray-blue

        // biome-ignore format: <ack>
        console[level](
          `%c${timestamp}%c [hbbtv-emu]%c ${section}%c ${message}`,
          timestampStyle,
          prefixStyle,
          sectionStyle,
          messageStyle,
          ...args,
        );
      }
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

  if (isServiceWorker) {
    app.init();
  }
};
