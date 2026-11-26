import type { PlayerEngineEvent } from "@hbb-emu/player-runtime";
import type * as dashjs from "dashjs";
import { describe, expect, it } from "vitest";
import { DASHAdapter, dashErrorKind } from "./dash";

describe("dashErrorKind", () => {
  // The codes as dash.js 5 declares them (MediaPlayerErrors).
  it.each<[number, string]>([
    [10, "manifest"], // MANIFEST_LOADER_PARSING_FAILURE_ERROR_CODE
    [31, "manifest"], // MANIFEST_ERROR_ID_PARSE_CODE
    [32, "manifest"], // MANIFEST_ERROR_ID_NOSTREAMS_CODE
    [11, "network"], // MANIFEST_LOADER_LOADING_FAILURE_ERROR_CODE
    [25, "network"], // DOWNLOAD_ERROR_ID_MANIFEST_CODE
    [17, "network"], // FRAGMENT_LOADER_LOADING_FAILURE_ERROR_CODE
    [27, "network"], // DOWNLOAD_ERROR_ID_CONTENT_CODE
    [28, "network"], // DOWNLOAD_ERROR_ID_INITIALIZATION_CODE
    [20, "other"], // APPEND_ERROR_CODE
    [9999, "other"],
  ])("code %i is a %s error", (code, kind) => {
    expect(dashErrorKind(code)).toBe(kind);
  });
});

describe("DASHAdapter", () => {
  it("turns a failed download into a network error of the player, instead of throwing", () => {
    const adapter = new DASHAdapter();
    const events: PlayerEngineEvent[] = [];
    adapter.subscribe((event) => void events.push(event))();
    const onDashError = (adapter as unknown as { onDashError: (event: dashjs.MediaPlayerErrorEvent) => void })
      .onDashError;

    onDashError({ error: { code: 27, message: "segment 404" } } as unknown as dashjs.MediaPlayerErrorEvent);

    expect(events).toEqual([
      expect.objectContaining({ _tag: "Engine/Error", kind: "network", message: "segment 404" }),
    ]);
  });
});
