/**
 * Tests for state matchers and predicates
 */

import { describe, expect, it } from "vitest";
import { PlayerState } from "../../state";
import * as Matchers from "../../state/matchers";

describe("Matchers - State Predicates", () => {
  describe("isPlayable", () => {
    it("should return true for Playing state", () => {
      const state = new PlayerState.Control.Playing(10, 120, [], 1.0);
      expect(Matchers.isPlayable(state)).toBe(true);
    });

    it("should return true for Paused state", () => {
      const state = new PlayerState.Control.Paused(10, 120, []);
      expect(Matchers.isPlayable(state)).toBe(true);
    });

    it("should return true for Buffering state", () => {
      const state = new PlayerState.Control.Buffering(10, 120, [], 50);
      expect(Matchers.isPlayable(state)).toBe(true);
    });

    it("should return false for error states", () => {
      const state = new PlayerState.Error.NetworkError(new Error("Network error"), 0, "https://example.com/video.mp4");
      expect(Matchers.isPlayable(state)).toBe(false);
    });

    it("should return true for Loading state (it's playable)", () => {
      const state = new PlayerState.Control.Loading("https://example.com/video.mp4", 0);
      expect(Matchers.isPlayable(state)).toBe(true);
    });
  });

  describe("isError", () => {
    it("should return true for NetworkError", () => {
      const state = new PlayerState.Error.NetworkError(new Error("Network error"), 0, "https://example.com/video.mp4");
      expect(Matchers.isError(state)).toBe(true);
    });

    it("should return true for DecodeError", () => {
      const state = new PlayerState.Source.MP4.DecodeError(
        new Error("Decode error"),
        "https://example.com/video.mp4",
        "avc1",
      );
      expect(Matchers.isError(state)).toBe(true);
    });

    it("should return false for Playing state", () => {
      const state = new PlayerState.Control.Playing(10, 120, [], 1.0);
      expect(Matchers.isError(state)).toBe(false);
    });
  });

  describe("isRecoverable", () => {
    it("should return true for NetworkError", () => {
      const state = new PlayerState.Error.NetworkError(new Error("Network error"), 0, "https://example.com/video.mp4");
      expect(Matchers.isRecoverable(state)).toBe(true);
    });

    it("should return false for DecodeError (it's fatal)", () => {
      const state = new PlayerState.Source.MP4.DecodeError(
        new Error("Decode error"),
        "https://example.com/video.mp4",
        "avc1",
      );
      expect(Matchers.isRecoverable(state)).toBe(false);
    });

    it("should return false for NotSupportedError", () => {
      const state = new PlayerState.Error.NotSupportedError(new Error("Unsupported format"), "video/x-unknown");
      expect(Matchers.isRecoverable(state)).toBe(false);
    });

    it("should return false for Playing state", () => {
      const state = new PlayerState.Control.Playing(10, 120, [], 1.0);
      expect(Matchers.isRecoverable(state)).toBe(false);
    });
  });

  describe("isFatal", () => {
    it("should return true for NotSupportedError", () => {
      const state = new PlayerState.Error.NotSupportedError(new Error("Unsupported format"), "video/x-unknown");
      expect(Matchers.isFatal(state)).toBe(true);
    });

    it("should return false for NetworkError", () => {
      const state = new PlayerState.Error.NetworkError(new Error("Network error"), 0, "https://example.com/video.mp4");
      expect(Matchers.isFatal(state)).toBe(false);
    });

    it("should return false for Playing state", () => {
      const state = new PlayerState.Control.Playing(10, 120, [], 1.0);
      expect(Matchers.isFatal(state)).toBe(false);
    });
  });

  describe("isControlState", () => {
    it("should return true for Playing state", () => {
      const state = new PlayerState.Control.Playing(10, 120, [], 1.0);
      expect(Matchers.isControlState(state)).toBe(true);
    });

    it("should return true for Paused state", () => {
      const state = new PlayerState.Control.Paused(10, 120, []);
      expect(Matchers.isControlState(state)).toBe(true);
    });

    it("should return true for Loading state", () => {
      const state = new PlayerState.Control.Loading("https://example.com/video.mp4", 0);
      expect(Matchers.isControlState(state)).toBe(true);
    });

    it("should return false for MP4 Ready state", () => {
      const state = new PlayerState.Source.MP4.Ready(
        "https://example.com/video.mp4",
        120,
        { width: 1920, height: 1080 },
        "avc1.42E01E",
      );
      expect(Matchers.isControlState(state)).toBe(false);
    });
  });

  describe("isSourceState", () => {
    it("should return true for MP4 Ready state", () => {
      const state = new PlayerState.Source.MP4.Ready(
        "https://example.com/video.mp4",
        120,
        { width: 1920, height: 1080 },
        "avc1.42E01E",
      );
      expect(Matchers.isSourceState(state)).toBe(true);
    });

    it("should return true for HLS ManifestLoading state", () => {
      const state = new PlayerState.Source.HLS.ManifestLoading("https://example.com/stream.m3u8");
      expect(Matchers.isSourceState(state)).toBe(true);
    });

    it("should return false for Playing state", () => {
      const state = new PlayerState.Control.Playing(10, 120, [], 1.0);
      expect(Matchers.isSourceState(state)).toBe(false);
    });
  });

  describe("isHLSState", () => {
    it("should return true for HLS ManifestLoading state", () => {
      const state = new PlayerState.Source.HLS.ManifestLoading("https://example.com/stream.m3u8");
      expect(Matchers.isHLSState(state)).toBe(true);
    });

    it("should return false for MP4 Ready state", () => {
      const state = new PlayerState.Source.MP4.Ready(
        "https://example.com/video.mp4",
        120,
        { width: 1920, height: 1080 },
        "avc1.42E01E",
      );
      expect(Matchers.isHLSState(state)).toBe(false);
    });

    it("should return false for Playing state", () => {
      const state = new PlayerState.Control.Playing(10, 120, [], 1.0);
      expect(Matchers.isHLSState(state)).toBe(false);
    });
  });
});

describe("Matchers - Pattern Matching", () => {
  describe("matchPlayerState", () => {
    it("should match Playing state", () => {
      const state = new PlayerState.Control.Playing(10, 120, [], 1.0);

      const result = Matchers.matchPlayerState(state)
        .with({ _tag: "Control/Playing" }, (s) => `Playing at ${s.currentTime}`)
        .otherwise(() => "Unknown");

      expect(result).toBe("Playing at 10");
    });

    it("should match Paused state", () => {
      const state = new PlayerState.Control.Paused(10, 120, []);

      const result = Matchers.matchPlayerState(state)
        .with({ _tag: "Control/Paused" }, () => "Paused")
        .otherwise(() => "Unknown");

      expect(result).toBe("Paused");
    });

    it("should match error states with isError predicate", () => {
      const state = new PlayerState.Error.NetworkError(new Error("Network error"), 0, "https://example.com/video.mp4");

      const result = Matchers.matchPlayerState(state)
        .with({ isError: true }, (s) => `Error: ${s.error.message}`)
        .otherwise(() => "Unknown");

      expect(result).toBe("Error: Network error");
    });

    it("should use otherwise for unmatched states", () => {
      const state = new PlayerState.Control.Buffering(10, 120, [], 50);

      const result = Matchers.matchPlayerState(state)
        .with({ _tag: "Control/Playing" }, () => "Playing")
        .with({ _tag: "Control/Paused" }, () => "Paused")
        .otherwise(() => "Other state");

      expect(result).toBe("Other state");
    });
  });

  describe("Type guards with TypeScript", () => {
    it("should narrow type with isPlayable", () => {
      const state: PlayerState.Any = new PlayerState.Control.Playing(10, 120, [], 1.0);

      if (Matchers.isPlayable(state)) {
        // TypeScript should know this is a playable state
        expect(state._tagGroup).toBe("Playable");
      }
    });

    it("should narrow type with isError", () => {
      const state: PlayerState.Any = new PlayerState.Error.NetworkError(
        new Error("Network error"),
        0,
        "https://example.com/video.mp4",
      );

      if (Matchers.isError(state)) {
        // TypeScript should know this has an error property
        expect(state.error).toBeInstanceOf(Error);
        expect(state.isError).toBe(true);
      }
    });
  });
});
