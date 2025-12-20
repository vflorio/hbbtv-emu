/**
 * Advanced tests - State Machine Sequences
 *
 * These tests verify complete state transition flows
 */

import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import { describe, expect, it } from "vitest";
import { PlayerState } from "../../state";
import * as Matchers from "../../state/matchers";
import * as Transitions from "../../transitions/core";

describe("State Machine - Complete Flows", () => {
  describe("Load → Play → Pause → Seek → Play Flow", () => {
    it("should handle complete playback lifecycle", async () => {
      // Step 1: Load source
      const loadResult = await Transitions.loadSource({
        url: "https://example.com/video.mp4",
        sourceType: "mp4",
      })();

      expect(E.isRight(loadResult)).toBe(true);
      if (!E.isRight(loadResult)) return;

      const loadingState = loadResult.right;
      expect(loadingState).toBeInstanceOf(PlayerState.Control.Loading);
      expect(loadingState.url).toBe("https://example.com/video.mp4");

      // Step 2: Complete loading
      const readyResult = await Transitions.completeLoading(loadingState, "mp4")();

      expect(E.isRight(readyResult)).toBe(true);
      if (!E.isRight(readyResult)) return;

      const readyState = readyResult.right;
      expect(readyState).toBeInstanceOf(PlayerState.Source.MP4.Ready);
      expect(Matchers.isSourceState(readyState)).toBe(true);

      // Step 3: Transition to paused (simulating initial state after load)
      const mp4Ready = readyState as PlayerState.Source.MP4.Ready;
      const pausedState = new PlayerState.Control.Paused(0, mp4Ready.duration, []);

      // Step 4: Play
      const playResult = Transitions.play(pausedState);

      expect(E.isRight(playResult)).toBe(true);
      if (!E.isRight(playResult)) return;

      let playingState = playResult.right;
      expect(playingState).toBeInstanceOf(PlayerState.Control.Playing);
      expect(Matchers.isPlayable(playingState)).toBe(true);
      expect(playingState.currentTime).toBe(0);

      // Step 5: Simulate time passing
      playingState = new PlayerState.Control.Playing(10, playingState.duration, [{ start: 0, end: 15 }], 1.0);

      // Step 6: Pause
      const pauseResult = Transitions.pause(playingState);

      expect(E.isRight(pauseResult)).toBe(true);
      if (!E.isRight(pauseResult)) return;

      const newPausedState = pauseResult.right;
      expect(newPausedState).toBeInstanceOf(PlayerState.Control.Paused);
      expect(newPausedState.currentTime).toBe(10);

      // Step 7: Seek to 50
      const seekResult = await Transitions.seek({
        targetTime: 50,
        currentState: newPausedState,
      })();

      expect(E.isRight(seekResult)).toBe(true);
      if (!E.isRight(seekResult)) return;

      const seekingState = seekResult.right;
      expect(seekingState).toBeInstanceOf(PlayerState.Control.Seeking);
      expect(seekingState.fromTime).toBe(10);
      expect(seekingState.toTime).toBe(50);

      // Step 8: Complete seek
      const completeSeekResult = Transitions.completeSeek(seekingState, true);

      expect(E.isRight(completeSeekResult)).toBe(true);
      if (!E.isRight(completeSeekResult)) return;

      const finalPlayingState = completeSeekResult.right;
      expect(finalPlayingState).toBeInstanceOf(PlayerState.Control.Playing);
      expect(finalPlayingState.currentTime).toBe(50);
    });
  });

  describe("Buffering Flow", () => {
    it("should handle buffering interruption during playback", () => {
      // Playing normally
      const playingState = new PlayerState.Control.Playing(30, 120, [{ start: 0, end: 35 }], 1.0);

      // Network slows down, start buffering
      const bufferingResult = Transitions.startBuffering(playingState);

      expect(E.isRight(bufferingResult)).toBe(true);
      if (!E.isRight(bufferingResult)) return;

      const bufferingState = bufferingResult.right;
      expect(bufferingState).toBeInstanceOf(PlayerState.Control.Buffering);
      expect(bufferingState.currentTime).toBe(30);
      expect(Matchers.isPlayable(bufferingState)).toBe(true);

      // Buffer fills up, resume playback
      const resumeResult = Transitions.resumeFromBuffering(bufferingState);

      expect(E.isRight(resumeResult)).toBe(true);
      if (!E.isRight(resumeResult)) return;

      const resumedState = resumeResult.right;
      expect(resumedState).toBeInstanceOf(PlayerState.Control.Playing);
      expect(resumedState.currentTime).toBe(30);
    });
  });

  describe("End of Playback", () => {
    it("should handle video ending", () => {
      const playingState = new PlayerState.Control.Playing(119.5, 120, [{ start: 0, end: 120 }], 1.0);

      const endResult = Transitions.end(playingState);

      expect(E.isRight(endResult)).toBe(true);
      if (!E.isRight(endResult)) return;

      const endedState = endResult.right;
      expect(endedState).toBeInstanceOf(PlayerState.Control.Ended);
      expect(endedState.duration).toBe(120);
      expect(endedState.wasLooping).toBe(false);
    });

    it("should restart from ended state", () => {
      const endedState = new PlayerState.Control.Ended(120, false);

      const playResult = Transitions.play(endedState);

      expect(E.isRight(playResult)).toBe(true);
      if (!E.isRight(playResult)) return;

      const playingState = playResult.right;
      expect(playingState).toBeInstanceOf(PlayerState.Control.Playing);
      expect(playingState.currentTime).toBe(0); // Should restart from beginning
    });
  });

  describe("Error Scenarios", () => {
    it("should reject invalid state transitions", () => {
      const loadingState = new PlayerState.Control.Loading("https://example.com/video.mp4", 50);

      // Cannot play from loading state - use type assertion to test
      const result = Transitions.play(loadingState as any);

      expect(E.isLeft(result)).toBe(true);
    });

    it("should validate seek boundaries", async () => {
      const playingState = new PlayerState.Control.Playing(10, 120, [], 1.0);

      // Seek beyond duration
      const seekBeyondResult = await Transitions.seek({
        targetTime: 150,
        currentState: playingState,
      })();

      expect(E.isLeft(seekBeyondResult)).toBe(true);

      // Seek to negative time
      const seekNegativeResult = await Transitions.seek({
        targetTime: -10,
        currentState: playingState,
      })();

      expect(E.isLeft(seekNegativeResult)).toBe(true);
    });
  });

  describe("Pattern Matching Integration", () => {
    it("should correctly identify state categories in flow", async () => {
      // Create various states
      const loading = new PlayerState.Control.Loading("video.mp4", 0);
      const playing = new PlayerState.Control.Playing(10, 120, [], 1.0);
      const error = new PlayerState.Error.NetworkError(new Error("Network error"), 0, "video.mp4");

      // Test matchers
      expect(Matchers.isControlState(loading)).toBe(true);
      expect(Matchers.isPlayable(loading)).toBe(true);
      expect(Matchers.isError(loading)).toBe(false);

      expect(Matchers.isControlState(playing)).toBe(true);
      expect(Matchers.isPlayable(playing)).toBe(true);
      expect(Matchers.isError(playing)).toBe(false);

      expect(Matchers.isControlState(error)).toBe(false);
      expect(Matchers.isPlayable(error)).toBe(false);
      expect(Matchers.isError(error)).toBe(true);
      expect(Matchers.isRecoverable(error)).toBe(true);
      expect(Matchers.isFatal(error)).toBe(false);
    });

    it("should use matchPlayerState for complex logic", () => {
      const states: PlayerState.Any[] = [
        new PlayerState.Control.Playing(10, 120, [], 1.0),
        new PlayerState.Control.Paused(10, 120, []),
        new PlayerState.Control.Buffering(10, 120, [], 50),
        new PlayerState.Error.NetworkError(new Error("Error"), 0, "video.mp4"),
      ];

      const descriptions = states.map((state) =>
        Matchers.matchPlayerState(state)
          .with({ _tag: "Control/Playing" }, (s) => `Playing at ${s.currentTime}s`)
          .with({ _tag: "Control/Paused" }, (s) => `Paused at ${s.currentTime}s`)
          .with({ _tag: "Control/Buffering" }, (s) => `Buffering at ${s.currentTime}s`)
          .with({ isError: true }, (s) => `Error: ${s.error.message}`)
          .otherwise(() => "Unknown state"),
      );

      expect(descriptions).toEqual(["Playing at 10s", "Paused at 10s", "Buffering at 10s", "Error: Error"]);
    });
  });

  describe("Functional Composition", () => {
    it("should compose transitions using fp-ts pipe", async () => {
      const initialState = new PlayerState.Control.Paused(0, 120, []);

      // Compose: play -> pause (roundtrip)
      const result = pipe(
        Transitions.play(initialState),
        E.chain((playing) => Transitions.pause(playing)),
      );

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(PlayerState.Control.Paused);
      }
    });

    it("should handle error propagation in composition", async () => {
      const playingState = new PlayerState.Control.Playing(10, 120, [], 1.0);

      // Try to seek beyond duration - should fail
      const result = await pipe(Transitions.seek({ targetTime: 150, currentState: playingState }))();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
