/**
 * Page runtime entrypoint for Chrome MV3.
 * Declared in the manifest as a MAIN-world content script at document_start,
 * so the OIPF APIs exist before any application script runs.
 */
import { bootPageRuntime, startRuntime } from "@hbb-emu/page-runtime";

bootPageRuntime({ window, document, startRuntime: startRuntime() })();
