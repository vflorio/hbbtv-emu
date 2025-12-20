/**
 * Tests for core transition functions
 */

import * as E from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { PlayerState } from "../../state";
import * as Transitions from "../../transitions/core";

describe("Transitions - Core", () => {
  describe("loadSource", () => {
    it("should create a Loading state from a valid URL", async () => {
      const result = await Transitions.loadSource({
        url: "https://example.com/video.mp4",
        sourceType: "mp4",
      })();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(PlayerState.Control.Loading);
        expect(result.right.url).toBe("https://example.com/video.mp4");
        expect(result.right.progress).toBe(0);
      }
    });

    it("should fail with NetworkError for invalid URL", async () => {
      const result = await Transitions.loadSource({
        url: "not-a-valid-url",
        sourceType: "mp4",
      })();

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.left).toBeInstanceOf(PlayerState.Error.NetworkError);
      }
    });

    it("should handle HLS URL", async () => {
      const result = await Transitions.loadSource({
        url: "https://example.com/stream.m3u8",
        sourceType: "hls",
      })();

      expect(E.isRight(result)).toBe(true);
    });
  });

  describe("completeLoading", () => {
    it("should transition MP4 loading to MP4 Ready state", async () => {
      const loadingState = new PlayerState.Control.Loading("https://example.com/video.mp4", 100);

      const result = await Transitions.completeLoading(loadingState, "mp4")();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(PlayerState.Source.MP4.Ready);
        const mp4State = result.right as PlayerState.Source.MP4.Ready;
        expect(mp4State.url).toBe("https://example.com/video.mp4");
        expect(mp4State.duration).toBeGreaterThan(0);
      }
    });

    it("should transition HLS loading to ManifestLoading state", async () => {
      const loadingState = new PlayerState.Control.Loading("https://example.com/stream.m3u8", 50);

      const result = await Transitions.completeLoading(loadingState, "hls")();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(PlayerState.Source.HLS.ManifestLoading);
      }
    });
  });

  describe("play", () => {
    it("should transition from Paused to Playing", () => {
      const pausedState = new PlayerState.Control.Paused(10, 120, [{ start: 0, end: 20 }]);

      const result = Transitions.play(pausedState);

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(PlayerState.Control.Playing);
        expect(result.right.currentTime).toBe(10);
        expect(result.right.duration).toBe(120);
        expect(result.right.playbackRate).toBe(1.0);
      }
    });

    it("should restart from beginning when transitioning from Ended", () => {
      const endedState = new PlayerState.Control.Ended(120, false);

      const result = Transitions.play(endedState);

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right.currentTime).toBe(0);
      }
    });

    it("should transition from Buffering to Playing", () => {
      const bufferingState = new PlayerState.Control.Buffering(15, 120, [{ start: 0, end: 10 }], 50);

      const result = Transitions.play(bufferingState);

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(PlayerState.Control.Playing);
        expect(result.right.currentTime).toBe(15);
      }
    });

    it("should fail when called from invalid state", () => {
      const loadingState = new PlayerState.Control.Loading("https://example.com/video.mp4", 50);

      // Loading is playable, so we need to test with type assertion
      const result = Transitions.play(loadingState as any);

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe("pause", () => {
    it("should transition from Playing to Paused", () => {
      const playingState = new PlayerState.Control.Playing(30, 120, [{ start: 0, end: 40 }], 1.0);

      const result = Transitions.pause(playingState);

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(PlayerState.Control.Paused);
        expect(result.right.currentTime).toBe(30);
        expect(result.right.duration).toBe(120);
        expect(result.right.buffered).toEqual([{ start: 0, end: 40 }]);
      }
    });
  });

  describe("seek", () => {
    it("should create Seeking state with valid target time", async () => {
      const currentState = new PlayerState.Control.Playing(10, 120, [], 1.0);

      const result = await Transitions.seek({
        targetTime: 50,
        currentState,
      })();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(PlayerState.Control.Seeking);
        expect(result.right.fromTime).toBe(10);
        expect(result.right.toTime).toBe(50);
        expect(result.right.duration).toBe(120);
      }
    });

    it("should fail when seeking to negative time", async () => {
      const currentState = new PlayerState.Control.Playing(10, 120, [], 1.0);

      const result = await Transitions.seek({
        targetTime: -5,
        currentState,
      })();

      expect(E.isLeft(result)).toBe(true);
    });

    it("should fail when seeking beyond duration", async () => {
      const currentState = new PlayerState.Control.Playing(10, 120, [], 1.0);

      const result = await Transitions.seek({
        targetTime: 150,
        currentState,
      })();

      expect(E.isLeft(result)).toBe(true);
    });

    it("should work from Paused state", async () => {
      const currentState = new PlayerState.Control.Paused(10, 120, []);

      const result = await Transitions.seek({
        targetTime: 30,
        currentState,
      })();

      expect(E.isRight(result)).toBe(true);
    });
  });
});
