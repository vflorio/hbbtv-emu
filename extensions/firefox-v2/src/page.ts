/**
 * Page runtime for Firefox MV2. Not a content script: MV2 has no MAIN-world
 * content scripts, so this bundle is embedded in the injector, which runs it in
 * the page's world (see injector.ts).
 */
import { startPage } from "@hbb-emu/page-runtime";

startPage(window, document)();
