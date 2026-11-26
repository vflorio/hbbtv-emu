/**
 * dash.js, as the emulator uses it: without its declarative setup (`./dashjsGlobal`).
 * Import dash.js from here, never from "dashjs": the first module evaluated decides.
 */

// biome-ignore-all assist/source/organizeImports: evaluated in this order: the flag, dash.js, then this module's body.
import { restoreDashGlobal } from "./dashjsGlobal";
import * as dashjs from "dashjs";

restoreDashGlobal();

export { dashjs };
