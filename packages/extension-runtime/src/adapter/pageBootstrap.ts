import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import { type AdapterConfig, type AdapterError, MANIFEST_VERSION_2, MANIFEST_VERSION_3 } from "./adapter";

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

/** MV2: no API injects code into the page synchronously (Firefox has `contentScripts.register`: to do). */
const noBootstrap = (): PageBootstrapAdapter => ({
  publish: () => TE.left(unavailable("not supported by this host")),
});

/**
 * @since Chrome 120+ (MV3, user scripts allowed by the user)
 */
export const createPageBootstrapAdapter = ({ manifest }: AdapterConfig): PageBootstrapAdapter =>
  match(manifest).with(MANIFEST_VERSION_3, userScriptsBootstrap).with(MANIFEST_VERSION_2, noBootstrap).exhaustive();
