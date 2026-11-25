import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import { contentScriptInjecting } from "../services/injector/injector";
import {
  type AdapterConfig,
  type AdapterError,
  ENGINE_FIREFOX,
  MANIFEST_VERSION_2,
  MANIFEST_VERSION_3,
} from "./adapter";

/**
 * Code the browser runs in every page's own world at `document_start`, before any
 * page script: how the configuration reaches the page synchronously
 * (see `configBootstrapScript` in @hbb-emu/protocol). Replaces what was there.
 */
export interface PageBootstrapAdapter {
  readonly publish: (code: string) => TE.TaskEither<AdapterError, void>;
}

export const BOOTSTRAP_SCRIPT_ID = "hbb-emu-config";

const unavailable = (reason: string): AdapterError => ({ _tag: "PageBootstrapUnavailable", reason });

/**
 * MV3: `chrome.userScripts` (Chrome 120+). The API only exists once the user allows
 * it: the "Allow User Scripts" toggle of the extension (Chrome 138+), or developer
 * mode before. It shows up without restarting the service worker.
 */
const userScriptsBootstrap = (): PageBootstrapAdapter => ({
  publish: (code) => {
    // Read on every call: the user may flip the toggle at any time.
    const userScripts = (chrome as Partial<typeof chrome>).userScripts;
    if (!userScripts) return TE.left(unavailable('"Allow User Scripts" is off for this extension'));

    const script: chrome.userScripts.RegisteredUserScript = {
      id: BOOTSTRAP_SCRIPT_ID,
      matches: ["http://*/*", "https://*/*"],
      js: [{ code }],
      world: "MAIN",
      runAt: "document_start",
      allFrames: true,
    };
    return TE.tryCatch(
      async () => {
        const existing = await userScripts.getScripts({ ids: [BOOTSTRAP_SCRIPT_ID] });
        await (existing.length > 0 ? userScripts.update([script]) : userScripts.register([script]));
      },
      (cause): AdapterError => ({ _tag: "PageBootstrapError", cause }),
    );
  },
});

/** The part of Firefox's `browser.contentScripts` used here (not in @types/chrome). */
type FirefoxContentScripts = Readonly<{
  register: (options: {
    matches: string[];
    js: Array<{ code: string }>;
    runAt: "document_start";
    allFrames: boolean;
  }) => Promise<{ unregister: () => Promise<void> }>;
}>;

/**
 * Firefox (MV2): a content script registered with code, in the isolated world; the
 * code injects the bootstrap into HbbTV documents as an inline script. Firefox runs
 * it after the manifest's content scripts and before the page's scripts.
 * A registration lives as long as the background page: it is replaced on every publish.
 */
const firefoxContentScriptBootstrap = (): PageBootstrapAdapter => {
  let current: { unregister: () => Promise<void> } | undefined;
  return {
    publish: (code) => {
      const contentScripts = (globalThis as { browser?: { contentScripts?: FirefoxContentScripts } }).browser
        ?.contentScripts;
      if (!contentScripts) return TE.left(unavailable("browser.contentScripts is missing"));
      return TE.tryCatch(
        async () => {
          const next = await contentScripts.register({
            matches: ["http://*/*", "https://*/*"],
            js: [{ code: contentScriptInjecting(code) }],
            runAt: "document_start",
            allFrames: true,
          });
          await current?.unregister();
          current = next;
        },
        (cause): AdapterError => ({ _tag: "PageBootstrapError", cause }),
      );
    },
  };
};

/** Legacy Chromium (MV2): no API runs code at document_start that the extension can change. */
const noBootstrap = (): PageBootstrapAdapter => ({
  publish: () => TE.left(unavailable("not supported by this host")),
});

/**
 * @since Chrome 120+ (MV3, user scripts allowed by the user), Firefox 59+ (MV2)
 */
export const createPageBootstrapAdapter = ({ engine, manifest }: AdapterConfig): PageBootstrapAdapter =>
  match(manifest)
    .with(MANIFEST_VERSION_3, userScriptsBootstrap)
    .with(MANIFEST_VERSION_2, () => (engine === ENGINE_FIREFOX ? firefoxContentScriptBootstrap() : noBootstrap()))
    .exhaustive();
