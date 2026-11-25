/**
 * Page runtime entrypoint for Chrome MV3.
 * Declared in the manifest as a MAIN-world content script at document_start,
 * so the OIPF APIs exist before any application script runs.
 */
import { startPage } from "@hbb-emu/page-runtime";

startPage(window, document)();
