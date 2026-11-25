/**
 * Running code in the page's own world from a content script, for hosts without
 * MAIN-world content scripts (MV2: Firefox, legacy Chromium).
 *
 * An inline `<script>` added to the document runs synchronously, in the page's world,
 * before any of the page's own scripts when this happens at `document_start`.
 * The page's Content-Security-Policy applies to it: a policy without
 * 'unsafe-inline' blocks it (ROADMAP).
 */

import { isHbbTVDocument } from "@hbb-emu/protocol";
import type * as IO from "fp-ts/IO";

/** Runs `code` in the page's world, leaving no element behind. */
export const runInPage =
  (document: Document, code: string): IO.IO<void> =>
  () => {
    const script = document.createElement("script");
    script.textContent = code;
    (document.head ?? document.documentElement ?? document).appendChild(script);
    script.remove();
  };

/** Runs `code` in the page's world, only in HbbTV documents. Returns whether it did. */
export const injectIntoHbbTVDocument =
  (document: Document, code: string): IO.IO<boolean> =>
  () => {
    if (!isHbbTVDocument(document)) return false;
    runInPage(document, code)();
    return true;
  };

/**
 * The same, as source code for a content script that hosts register at runtime
 * (e.g. Firefox `contentScripts.register({ js: [{ code }] })`): it must be
 * self-contained, so the HbbTV check is repeated here (kept in sync by the tests).
 */
export const contentScriptInjecting = (code: string): string =>
  `(function () {
  var type = String(document.contentType || "").toLowerCase();
  if (type !== "application/xhtml+xml" && type.indexOf("hbbtv") === -1) return;
  var script = document.createElement("script");
  script.textContent = ${JSON.stringify(code)};
  (document.head || document.documentElement || document).appendChild(script);
  script.remove();
})();`;
