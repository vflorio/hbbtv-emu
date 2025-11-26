export const logger = (section: string) => (message: string) => {
  console.log(`[hbbtv-emu] ${section}: ${message}`);
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
