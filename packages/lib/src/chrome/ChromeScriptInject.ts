import type { ClassType } from "../mixin";

export interface ChromeScriptInject {
  inject(tabId: number, files: string[]): void;
}

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject {
    inject = (tabId: number, files: string[]) => {
      // Inietta il bridge script nel mondo ISOLATED (può comunicare con l'estensione)
      chrome.scripting
        .executeScript({
          target: { tabId },
          files: ["bridge.js"],
          world: "ISOLATED",
          injectImmediately: true,
        })
        .catch((error) => {
          console.error("Failed to inject bridge script:", error);
        });

      // Inietta il content script nel mondo MAIN (può accedere al DOM della pagina)
      return chrome.scripting
        .executeScript({
          target: { tabId },
          files,
          world: "MAIN",
          injectImmediately: true,
        })
        .catch((error) => {
          console.error("Failed to inject HbbTV APIs:", error);
        });
    };
  };
