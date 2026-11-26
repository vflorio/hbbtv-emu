import type { PlayerEngineEvent } from "@hbb-emu/player-runtime";
import { type ErrorData, ErrorDetails, ErrorTypes } from "hls.js";
import { describe, expect, it } from "vitest";
import { HLSAdapter, hlsErrorKind } from "./hls";

describe("hlsErrorKind", () => {
  it.each<[ErrorTypes, ErrorDetails, string]>([
    [ErrorTypes.NETWORK_ERROR, ErrorDetails.MANIFEST_PARSING_ERROR, "manifest"],
    [ErrorTypes.NETWORK_ERROR, ErrorDetails.MANIFEST_LOAD_ERROR, "network"],
    [ErrorTypes.NETWORK_ERROR, ErrorDetails.LEVEL_LOAD_ERROR, "network"],
    [ErrorTypes.NETWORK_ERROR, ErrorDetails.FRAG_LOAD_ERROR, "network"],
    [ErrorTypes.MEDIA_ERROR, ErrorDetails.BUFFER_APPEND_ERROR, "other"],
  ])("%s / %s is a %s error", (type, details, kind) => {
    expect(hlsErrorKind({ type, details })).toBe(kind);
  });
});

describe("HLSAdapter", () => {
  const adapterWithEvents = () => {
    const adapter = new HLSAdapter();
    const events: PlayerEngineEvent[] = [];
    adapter.subscribe((event) => void events.push(event))();
    const onHlsError = (adapter as unknown as { onHlsError: (event: string, data: ErrorData) => void }).onHlsError;
    return { events, onHlsError };
  };

  it("turns a manifest hls.js gave up loading into a network error of the player", () => {
    const { events, onHlsError } = adapterWithEvents();

    onHlsError("hlsError", {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.MANIFEST_LOAD_ERROR,
      fatal: true,
    } as ErrorData);

    expect(events).toEqual([expect.objectContaining({ _tag: "Engine/Error", kind: "network" })]);
  });

  it("ignores the errors hls.js recovers from by itself", () => {
    const { events, onHlsError } = adapterWithEvents();

    onHlsError("hlsError", {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.FRAG_LOAD_ERROR,
      fatal: false,
    } as ErrorData);

    expect(events).toEqual([]);
  });
});
