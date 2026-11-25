/// <reference types="vite/client" />
/**
 * Injector entrypoint for Firefox MV2: content script at document_start.
 * Runs the page runtime in the page's own world, in HbbTV documents only, before
 * any application script (an inline script runs synchronously).
 */
import { injectIntoHbbTVDocument } from "@hbb-emu/extension-runtime";
// Built first by vite.page.config.ts.
import pageRuntime from "../.build/page-runtime.js?raw";

injectIntoHbbTVDocument(document, pageRuntime)();
