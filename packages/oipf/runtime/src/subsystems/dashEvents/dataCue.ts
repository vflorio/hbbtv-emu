/**
 * `DataCue` (HTML 5.1 §4.7.10.12.1), which an HbbTV 2 terminal supports for DASH events
 * (TS 102 796 §9.3.2.2, A.2.12): a cue with an `ArrayBuffer` of `data`. Chromium and
 * Firefox have none: the page gets one before the application's first script, made
 * from the browser's `VTTCue` (with no text, in a hidden track it shows nothing), so
 * that it can be added to a TextTrack. A browser's own `DataCue` is left as it is.
 *
 * The emulator's is also a `VTTCue` (`instanceof VTTCue`), which a terminal's is not.
 */

import type { DataCueConstructor } from "./eventTracks";

type CueWindow = Window & { DataCue?: DataCueConstructor; VTTCue?: typeof VTTCue };

export type InstalledDataCue = Readonly<{ DataCue: DataCueConstructor; uninstall: () => void }>;

/** The page's `DataCue`; `null` if the browser has neither one nor a `VTTCue` to make it from. */
export const installDataCue = (window: Window): InstalledDataCue | null => {
  const target = window as CueWindow;
  if (typeof target.DataCue === "function") return { DataCue: target.DataCue, uninstall: () => {} };
  const BaseCue = target.VTTCue;
  if (typeof BaseCue !== "function") return null;

  class DataCue extends BaseCue {
    data: ArrayBuffer;
    constructor(startTime: number, endTime: number, data: ArrayBuffer) {
      super(startTime, endTime, "");
      this.data = data;
    }
  }
  Object.defineProperty(target, "DataCue", { configurable: true, writable: true, value: DataCue });
  return {
    DataCue,
    uninstall: () => {
      if (target.DataCue === DataCue) delete target.DataCue;
    },
  };
};
