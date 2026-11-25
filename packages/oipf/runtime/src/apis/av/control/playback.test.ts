import { OIPF } from "@hbb-emu/oipf-api";
import { describe, expect, it } from "vitest";
import { VideoStreamPlayState as Stream, VideoStreamError, type VideoStreamPlayState } from "../../../subsystems";
import {
  applyPlaybackState,
  closestSpeed,
  createPlaybackEnv,
  getPlayPosition,
  getPlayTime,
  type PlaybackEnv,
  play,
  readPlaybackState,
  seek,
  setData,
  startPlayback,
  stop,
} from "./playback";

const { PlayState, ErrorCode } = OIPF.AV.Control;

type Call = string;
type Event = { readonly playState: number } | { readonly speed: number } | { readonly position: number | undefined };

/** An A/V Control's playback over a fake player whose state the test drives. */
const setup = ({ data = "http://vod/movie.mp4" }: { data?: string } = {}) => {
  const calls: Call[] = [];
  const events: Event[] = [];
  const listeners = new Set<(state: VideoStreamPlayState) => void>();
  const media = { position: undefined as number | undefined, duration: undefined as number | undefined };

  const env: PlaybackEnv = createPlaybackEnv(
    {
      player: {
        load: (url) => () => {
          calls.push(`load ${url}`);
          media.position = undefined;
          media.duration = undefined;
        },
        play: () => calls.push("play"),
        pause: () => calls.push("pause"),
        stop: () => calls.push("stop"),
        seek: (position) => () => {
          calls.push(`seek ${position}`);
        },
        getPosition: () => media.position,
        getDuration: () => media.duration,
        onStreamStateChange: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      playbackEvents: {
        onPlayStateChange: (playState) => () => events.push({ playState }),
        onPlaySpeedChanged: (speed) => () => events.push({ speed }),
        onPlayPositionChanged: (position) => () => events.push({ position }),
      },
    },
    { data },
  )();
  const unsubscribe = startPlayback(env)();

  const run = <A>(operation: (env: PlaybackEnv) => () => A): A => operation(env)();
  const stream = (state: VideoStreamPlayState) => {
    for (const listener of listeners) listener(state);
  };
  /** The player has loaded the media, as the runtime reports it (paused, at the start). */
  const loaded = (duration = 60_000) => {
    media.position = 0;
    media.duration = duration;
    stream(Stream.buffering());
    stream(Stream.idle());
    stream(Stream.paused());
  };
  const state = () => run(readPlaybackState);
  const clear = () => {
    calls.length = 0;
    events.length = 0;
  };

  return { env, calls, events, media, run, stream, loaded, state, clear, unsubscribe, listeners };
};

/** Playing from the start: loaded, then playing. */
const playing = (duration?: number) => {
  const t = setup();
  t.run(play(1));
  t.loaded(duration);
  t.stream(Stream.playing());
  t.clear();
  return t;
};

describe("A/V Control playback", () => {
  describe("initial state", () => {
    it("is stopped, with no position or duration until something is loaded", () => {
      const t = setup();
      expect(t.state()).toMatchObject({ playState: PlayState.STOPPED, error: undefined, data: "http://vod/movie.mp4" });
      expect(t.run(getPlayPosition)).toBeUndefined();
      expect(t.run(getPlayTime)).toBeUndefined();
      expect(t.calls).toEqual([]);
    });
  });

  describe("play()", () => {
    it("from stopped: connecting, loads data, plays once it is loaded, then playing", () => {
      const t = setup();

      expect(t.run(play(1))).toBe(true);
      expect(t.events).toEqual([{ playState: PlayState.CONNECTING }, { speed: 1 }]);
      expect(t.calls).toEqual(["load http://vod/movie.mp4"]);

      t.loaded();
      expect(t.calls).toEqual(["load http://vod/movie.mp4", "play"]);
      expect(t.state().playState).toBe(PlayState.CONNECTING);

      t.stream(Stream.playing());
      expect(t.events).toEqual([{ playState: PlayState.CONNECTING }, { speed: 1 }, { playState: PlayState.PLAYING }]);
      expect(t.run(getPlayTime)).toBe(60_000);
      expect(t.run(getPlayPosition)).toBe(0);
    });

    it("play(0) from stopped loads the media and is paused (§7.14.1.2, item 1)", () => {
      const t = setup();

      t.run(play(0));
      expect(t.calls).toEqual(["load http://vod/movie.mp4"]);
      expect(t.events).toEqual([{ playState: PlayState.PAUSED }, { speed: 0 }]);

      t.loaded();
      expect(t.calls).toEqual(["load http://vod/movie.mp4"]);
      expect(t.state()).toMatchObject({ playState: PlayState.PAUSED, speed: 0 });
    });

    it("play(0) while playing pauses; play(1) resumes when the player plays again", () => {
      const t = playing();

      t.run(play(0));
      expect(t.calls).toEqual(["pause"]);
      expect(t.events).toEqual([{ playState: PlayState.PAUSED }, { speed: 0 }]);

      t.stream(Stream.paused());
      t.clear();
      t.run(play(1));
      expect(t.calls).toEqual(["play"]);
      expect(t.events).toEqual([{ speed: 1 }]);
      expect(t.state().playState).toBe(PlayState.PAUSED);

      t.stream(Stream.playing());
      expect(t.events).toEqual([{ speed: 1 }, { playState: PlayState.PLAYING }]);
    });

    it("reports the speed even when it does not change", () => {
      const t = playing();
      expect(t.run(play(1))).toBe(true);
      expect(t.events).toEqual([{ speed: 1 }]);
      expect(t.calls).toEqual(["play"]);
    });

    it("plays at the supported speed closest to the one asked", () => {
      expect([2, 1.4, 0.5, 0.2, -1, -8, Number.NaN].map(closestSpeed)).toEqual([1, 1, 0, 0, 0, 0, 1]);

      const t = playing();
      t.run(play(4));
      expect(t.state().speed).toBe(1);
      expect(t.events).toEqual([{ speed: 1 }]);
      t.clear();
      t.run(play(-2));
      expect(t.calls).toEqual(["pause"]);
      expect(t.events).toEqual([{ playState: PlayState.PAUSED }, { speed: 0 }]);
    });

    it("pausing while the media loads: the player is paused as soon as it plays", () => {
      const t = setup();
      t.run(play(1));
      t.run(play(0));
      t.clear();

      t.loaded();
      t.stream(Stream.playing());
      expect(t.calls).toEqual(["pause"]);
      expect(t.state().playState).toBe(PlayState.PAUSED);
      expect(t.events).toEqual([]);
    });

    it("with no data is an error 5 (content not available), and still returns true", () => {
      const t = setup({ data: "" });
      expect(t.run(play(1))).toBe(true);
      expect(t.state()).toMatchObject({ playState: PlayState.ERROR, error: ErrorCode.CONTENT_NOT_AVAILABLE });
      expect(t.calls).toEqual([]);
      expect(t.events).toEqual([{ playState: PlayState.ERROR }]);
    });

    it("after stop(), plays the media already loaded again", () => {
      const t = playing();
      t.run(stop);
      t.stream(Stream.paused());
      t.clear();

      t.run(play(1));
      expect(t.calls).toEqual(["play"]);
      expect(t.events).toEqual([{ playState: PlayState.CONNECTING }, { speed: 1 }]);
      t.stream(Stream.playing());
      expect(t.state().playState).toBe(PlayState.PLAYING);
    });
  });

  describe("following the player", () => {
    it("buffering while playing, then playing again; onPlayStateChange only on changes", () => {
      const t = playing();
      t.stream(Stream.buffering());
      t.stream(Stream.buffering());
      t.stream(Stream.playing());
      t.stream(Stream.playing());
      expect(t.events).toEqual([{ playState: PlayState.BUFFERING }, { playState: PlayState.PLAYING }]);
    });

    it("the end of the media is finished, with speed 0 (§7.14.1.2, item 6); the pause before it is not a pause", () => {
      const t = playing(60_000);
      t.media.position = 60_000;
      t.stream(Stream.paused());
      t.stream(Stream.finished());
      expect(t.events).toEqual([{ playState: PlayState.FINISHED }, { speed: 0 }]);
      expect(t.state().speed).toBe(0);
    });

    it("a pause nobody asked for (the browser) is paused", () => {
      const t = playing(60_000);
      t.media.position = 10_000;
      t.stream(Stream.paused());
      expect(t.events).toEqual([{ playState: PlayState.PAUSED }]);
    });

    it("a player error is an error with its code; the next play() loads the media again", () => {
      const t = playing();
      t.stream(Stream.error(VideoStreamError.network("lost", 2)));
      expect(t.state()).toMatchObject({ playState: PlayState.ERROR, error: ErrorCode.CONNECTION_ERROR });
      expect(t.run(getPlayPosition)).toBeUndefined();

      t.clear();
      t.run(play(1));
      expect(t.calls).toEqual(["load http://vod/movie.mp4"]);
      expect(t.state().error).toBe(ErrorCode.CONNECTION_ERROR);
    });

    it("maps the player's errors to the A/V Control codes", () => {
      const codes = [
        VideoStreamError.notSupported("codec", 4),
        VideoStreamError.network("404", 2),
        VideoStreamError.drm("license", 6),
        VideoStreamError.unknown("?", 1),
      ].map((error) => {
        const t = playing();
        t.stream(Stream.error(error));
        return t.state().error;
      });
      expect(codes).toEqual([
        ErrorCode.FORMAT_NOT_SUPPORTED,
        ErrorCode.CONNECTION_ERROR,
        ErrorCode.UNIDENTIFIED,
        ErrorCode.UNIDENTIFIED,
      ]);
    });

    it("stopped, finished and error do not follow the player", () => {
      const t = playing();
      t.run(stop);
      t.clear();
      t.stream(Stream.paused());
      t.stream(Stream.buffering());
      t.stream(Stream.playing());
      t.stream(Stream.error(VideoStreamError.network("lost", 2)));
      expect(t.state().playState).toBe(PlayState.STOPPED);
      expect(t.events).toEqual([]);
    });

    it("stops following the player when unsubscribed", () => {
      const t = playing();
      t.unsubscribe();
      expect(t.listeners.size).toBe(0);
    });
  });

  describe("stop()", () => {
    it("stops the player and goes back to position 0", () => {
      const t = playing();
      t.media.position = 12_000;

      expect(t.run(stop)).toBe(true);
      expect(t.calls).toEqual(["stop"]);
      expect(t.events).toEqual([{ playState: PlayState.STOPPED }]);
      expect(t.run(getPlayPosition)).toBe(0);
    });

    it("from stopped changes nothing", () => {
      const t = setup();
      expect(t.run(stop)).toBe(true);
      expect(t.calls).toEqual([]);
      expect(t.events).toEqual([]);
    });
  });

  describe("seek()", () => {
    it("while playing: seeks the player, playPosition reads the target at once, then the player's", () => {
      const t = playing(60_000);
      t.media.position = 5_000;

      expect(t.run(seek(30_000))).toBe(true);
      expect(t.calls).toEqual(["seek 30000"]);
      expect(t.events).toEqual([{ position: 30_000 }]);
      expect(t.run(getPlayPosition)).toBe(30_000);

      t.stream(Stream.buffering());
      t.media.position = 30_040;
      t.stream(Stream.playing());
      expect(t.run(getPlayPosition)).toBe(30_040);
      expect(t.events).toEqual([
        { position: 30_000 },
        { playState: PlayState.BUFFERING },
        { playState: PlayState.PLAYING },
      ]);
    });

    it("while paused: the state does not change", () => {
      const t = playing(60_000);
      t.run(play(0));
      t.stream(Stream.paused());
      t.clear();

      t.run(seek(10_000));
      t.stream(Stream.buffering());
      t.stream(Stream.paused());
      expect(t.events).toEqual([{ position: 10_000 }]);
      expect(t.state().playState).toBe(PlayState.PAUSED);
    });

    it("before the media can seek: kept, and sent once it is loaded", () => {
      const t = setup();
      expect(t.run(seek(42_000))).toBe(true);
      expect(t.run(getPlayPosition)).toBe(42_000);
      expect(t.calls).toEqual([]);

      t.run(play(1));
      t.loaded();
      expect(t.calls).toEqual(["load http://vod/movie.mp4", "seek 42000", "play"]);
      expect(t.run(getPlayPosition)).toBe(42_000);

      t.stream(Stream.buffering());
      t.media.position = 42_000;
      t.stream(Stream.playing());
      expect(t.state().playState).toBe(PlayState.PLAYING);
      expect(t.state().seek).toBeNull();
    });

    it("a position that is not one fails, and the event carries the current position", () => {
      const t = playing(60_000);
      t.media.position = 7_000;

      expect([-1, Number.NaN, 60_001].map((position) => t.run(seek(position)))).toEqual([false, false, false]);
      expect(t.calls).toEqual([]);
      expect(t.events).toEqual([{ position: 7_000 }, { position: 7_000 }, { position: 7_000 }]);
    });
  });

  describe("data", () => {
    it("a change while playing stops, and the next play() loads the new media", () => {
      const t = playing();

      t.run(setData("http://vod/other.mp4"));
      expect(t.calls).toEqual(["stop"]);
      expect(t.events).toEqual([{ playState: PlayState.STOPPED }]);
      expect(t.run(getPlayPosition)).toBeUndefined();

      t.clear();
      t.run(play(1));
      expect(t.calls).toEqual(["load http://vod/other.mp4"]);
    });

    it("the same value changes nothing", () => {
      const t = playing();
      t.run(setData("http://vod/movie.mp4"));
      expect(t.calls).toEqual([]);
      expect(t.state().playState).toBe(PlayState.PLAYING);
    });

    it("set while stopped loads nothing", () => {
      const t = setup({ data: "" });
      t.run(setData("http://vod/movie.mp4"));
      expect(t.calls).toEqual([]);
      expect(t.events).toEqual([]);
    });
  });

  describe("external state", () => {
    it("writes playState, error and speed as they are, without notifying the application", () => {
      const t = setup();
      t.run(applyPlaybackState({ playState: PlayState.ERROR, error: ErrorCode.CONTENT_CORRUPT, speed: 0 }));
      expect(t.state()).toMatchObject({ playState: PlayState.ERROR, error: ErrorCode.CONTENT_CORRUPT, speed: 0 });
      expect(t.events).toEqual([]);
    });

    it("sets data as the application does", () => {
      const t = playing();
      t.run(applyPlaybackState({ data: "http://vod/other.mp4" }));
      expect(t.state()).toMatchObject({ data: "http://vod/other.mp4", playState: PlayState.STOPPED });
    });
  });
});
