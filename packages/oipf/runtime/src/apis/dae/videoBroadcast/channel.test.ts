import { OIPF } from "@hbb-emu/oipf-api";
import type { ChannelConfig } from "@hbb-emu/state";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { describe, expect, it } from "vitest";
import {
  type ChannelChangeRequest,
  VideoStreamPlayState as Stream,
  toBroadcastChannel,
  tuneAlone,
  type VideoStreamPlayState,
} from "../../../subsystems";
import {
  applyChannelState,
  bindToCurrentChannel,
  type ChannelEnv,
  changeChannel,
  channelApi,
  createChannelEnv,
  createChannelObject,
  followStream,
  getChannelConfig,
  getCurrentChannel,
  getPlayState,
  release,
  setChannel,
  setPlayState,
  startChannel,
  stop,
  toPlayState,
  tuneTo,
  zap,
} from "./channel";

const { PlayState, ChannelChangeErrorCode } = OIPF.DAE.Broadcast;
const DVB_T = OIPF.DAE.Broadcast.ChannelIdType.ID_DVB_T;

const dmax: ChannelConfig = { id: "dmax", name: "DMAX", mp4Source: "http://tv/dmax.mp4", onid: 318, tsid: 1, sid: 52 };
const hgtv: ChannelConfig = { id: "hgtv", name: "HGTV", mp4Source: "http://tv/hgtv.mp4", onid: 318, tsid: 1, sid: 56 };
const news: ChannelConfig = { id: "news", name: "NEWS", mp4Source: "http://tv/news.mp4", onid: 318, tsid: 1, sid: 60 };

/** Lets the tasks the synchronous OIPF methods start run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const channel = (config: ChannelConfig) => toBroadcastChannel(config) as OIPF.DAE.Broadcast.Channel;
const unknown = { idType: DVB_T, onid: 1, tsid: 2, sid: 3 } as OIPF.DAE.Broadcast.Channel;

type Call =
  | { readonly load: string }
  | { readonly bind: true }
  | { readonly stop: true }
  | { readonly release: true }
  | { readonly playState: number }
  | { readonly unrealized: true }
  | { readonly left: true }
  | { readonly error: number }
  | { readonly succeeded: string | undefined }
  | { readonly presents: string | null };

/**
 * A video/broadcast on a TV tuned to `tuned`, whose answer to a change is
 * `requestChannelChange`. `presented`: whether the TV's broadcast presents, to bind to.
 */
const setup = ({
  tuned = dmax,
  lineup = [dmax, hgtv, news],
  requestChannelChange = () => tuneAlone,
  playState = PlayState.UNREALIZED,
  presented = true,
}: {
  tuned?: ChannelConfig | null;
  lineup?: ReadonlyArray<ChannelConfig>;
  requestChannelChange?: (env: () => ChannelEnv) => ChannelChangeRequest;
  playState?: OIPF.DAE.Broadcast.PlayState;
  presented?: boolean;
} = {}) => {
  const calls: Call[] = [];
  const asked: string[] = [];
  const tunedChannel = tuned ? channel(tuned) : null;
  const streamListeners = new Set<(state: VideoStreamPlayState) => void>();
  const env: ChannelEnv = createChannelEnv(
    {
      getChannels: () => lineup,
      player: {
        present: (url) => () => {
          calls.push({ load: url });
        },
        bind: () => {
          calls.push({ bind: true });
          return presented;
        },
        stop: () => {
          calls.push({ stop: true });
        },
        release: () => {
          calls.push({ release: true });
        },
        onStreamStateChange: (listener) => {
          streamListeners.add(listener);
          return () => streamListeners.delete(listener);
        },
      },
      getTunedChannel: () => tunedChannel,
      requestChannelChange: (config) => {
        asked.push(config.id);
        return requestChannelChange(() => env)(config);
      },
      channelEvents: {
        onPlayStateChange: (state) => () => {
          calls.push({ playState: state });
        },
        onUnrealized: () => {
          calls.push({ unrealized: true });
        },
        onLeaveChannel: () => {
          calls.push({ left: true });
        },
        onChannelChangeSucceeded: (succeeded) => () => {
          calls.push({ succeeded: succeeded.ccid });
        },
        onChannelChangeError: (_, error) => () => {
          calls.push({ error });
        },
        onCurrentChannelChange: (current) => () => {
          calls.push({ presents: current?.ccid ?? null });
        },
      },
    },
    playState,
  )();
  /** The stream changes state, as the player reports it. */
  const stream = (state: VideoStreamPlayState) => {
    for (const listener of streamListeners) listener(state);
  };
  return { env, calls, asked, stream, streamListeners };
};

/** A video/broadcast presenting `config`, with the calls it took cleared. */
const presenting = async (config: ChannelConfig, options: Parameters<typeof setup>[0] = {}) => {
  const fixture = setup({ tuned: config, ...options });
  startChannel(fixture.env)();
  await tuneTo(channel(config))(fixture.env)();
  fixture.stream(Stream.playing());
  fixture.calls.length = 0;
  return fixture;
};

describe("setPlayState", () => {
  it("notifies the application only when the state changes", () => {
    const { env, calls } = setup();

    setPlayState(PlayState.CONNECTING)(env)();
    setPlayState(PlayState.CONNECTING)(env)();

    expect(getPlayState(env)()).toBe(PlayState.CONNECTING);
    expect(calls).toEqual([{ playState: PlayState.CONNECTING }]);
  });

  it("entering the unrealized state drops the application's changes before the application hears it", () => {
    const { env, calls } = setup({ playState: PlayState.PRESENTING });

    setPlayState(PlayState.STOPPED)(env)();
    setPlayState(PlayState.UNREALIZED)(env)();
    setPlayState(PlayState.UNREALIZED)(env)();

    expect(calls).toEqual([
      { playState: PlayState.STOPPED },
      { unrealized: true },
      { playState: PlayState.UNREALIZED },
    ]);
  });
});

describe("tuneTo (the TV changed channel)", () => {
  it("presents the channel: connecting, then its stream, and the page follows", async () => {
    const { env, calls, asked } = setup();

    await tuneTo(channel(hgtv))(env)();

    expect(getCurrentChannel(env)()).toMatchObject({ ccid: "hgtv" });
    expect(calls).toEqual([{ playState: PlayState.CONNECTING }, { presents: "hgtv" }, { load: hgtv.mp4Source }]);
    expect(asked).toEqual([]);
  });

  it("leaves the service it was bound to before connecting to another (TS 102 796 §8.2.1.1)", async () => {
    const { env, calls } = await presenting(dmax);

    await tuneTo(channel(hgtv))(env)();

    expect(calls.slice(0, 2)).toEqual([{ left: true }, { playState: PlayState.CONNECTING }]);
  });

  it("presenting the same service again does not leave it", async () => {
    const { env, calls } = await presenting(dmax);

    await tuneTo(channel(dmax))(env)();
    stop(env)();
    bindToCurrentChannel(env)();

    expect(calls).not.toContainEqual({ left: true });
  });

  it("reports a channel the lineup has no stream for", async () => {
    const { env, calls } = setup();

    await tuneTo(unknown)(env)();

    expect(calls).toContainEqual({ error: ChannelChangeErrorCode.UNKNOWN_CHANNEL });
  });
});

describe("changeChannel (the application's setChannel)", () => {
  it("to the service the TV is on, only presents it", async () => {
    const { env, asked } = setup({ tuned: dmax });

    const result = await changeChannel(channel(dmax))(env)();

    expect(result).toEqual(E.right(expect.objectContaining({ ccid: "dmax" })));
    expect(asked).toEqual([]);
  });

  it("to another service, asks the TV first and follows it once it is there", async () => {
    const { env, calls, asked } = await presenting(dmax);

    await changeChannel(channel(hgtv))(env)();

    expect(asked).toEqual(["hgtv"]);
    expect(getCurrentChannel(env)()).toMatchObject({ ccid: "hgtv" });
    expect(calls).toContainEqual({ load: hgtv.mp4Source });
  });

  it("does not load the stream twice when the TV's own tuning already switched the object", async () => {
    const { env, calls } = await presenting(dmax, {
      requestChannelChange: (env) => (config) =>
        TE.fromTask(async () => {
          await tuneTo(channel(config))(env())();
        }),
    });

    await changeChannel(channel(hgtv))(env)();

    expect(calls.filter((call) => "load" in call)).toEqual([{ load: hgtv.mp4Source }]);
  });

  it("stays on its channel when the TV refuses", async () => {
    const { env, calls } = await presenting(dmax, {
      requestChannelChange: () => () => TE.left(ChannelChangeErrorCode.UNKNOWN_CHANNEL),
    });

    const result = await changeChannel(channel(hgtv))(env)();

    expect(result).toEqual(E.left(ChannelChangeErrorCode.UNKNOWN_CHANNEL));
    expect(getCurrentChannel(env)()).toMatchObject({ ccid: "dmax" });
    expect(calls).toEqual([]);
  });

  it("fails for a channel missing from the lineup before anything changes, asking nobody", async () => {
    const { env, calls, asked } = await presenting(dmax);

    const result = await changeChannel(unknown)(env)();

    expect(result).toEqual(E.left(ChannelChangeErrorCode.UNKNOWN_CHANNEL));
    expect(asked).toEqual([]);
    expect(calls).toEqual([]);
    expect(getPlayState(env)()).toBe(PlayState.PRESENTING);
  });

  it("with null, releases the object", async () => {
    const { env, calls } = await presenting(dmax);

    await changeChannel(null)(env)();

    expect(getPlayState(env)()).toBe(PlayState.UNREALIZED);
    expect(calls).toEqual([{ unrealized: true }, { playState: PlayState.UNREALIZED }, { release: true }]);
  });
});

describe("setChannel", () => {
  it("reports a failure to the application as onChannelChangeError", async () => {
    const { env, calls } = await presenting(dmax);

    await setChannel(unknown)(env)();

    expect(calls).toEqual([{ error: ChannelChangeErrorCode.UNKNOWN_CHANNEL }]);
  });
});

describe("stop / release", () => {
  it("stop() stops the stream once", async () => {
    const { env, calls } = await presenting(dmax);

    stop(env)();
    stop(env)();

    expect(getPlayState(env)()).toBe(PlayState.STOPPED);
    expect(calls).toEqual([{ stop: true }, { playState: PlayState.STOPPED }]);
  });

  it("stop() has no effect on an unrealized object: the TV goes on presenting (OIPF DAE §7.13.1.3)", async () => {
    const { env, calls } = await presenting(dmax);
    release(env)();
    calls.length = 0;

    stop(env)();

    expect(getPlayState(env)()).toBe(PlayState.UNREALIZED);
    expect(calls).toEqual([]);
  });

  it("release() gives the broadcast back to the TV once, keeping the channel", async () => {
    const { env, calls } = await presenting(dmax);

    release(env)();
    release(env)();

    expect(calls).toEqual([{ unrealized: true }, { playState: PlayState.UNREALIZED }, { release: true }]);
    expect(getCurrentChannel(env)()).toMatchObject({ ccid: "dmax" });
  });
});

describe("bindToCurrentChannel", () => {
  it("stopped, presents its channel again and returns it", async () => {
    const { env, calls } = await presenting(dmax);
    stop(env)();
    calls.length = 0;

    expect(bindToCurrentChannel(env)()).toMatchObject({ ccid: "dmax" });
    await flush();

    expect(calls).toContainEqual({ load: dmax.mp4Source });
    expect(getPlayState(env)()).toBe(PlayState.CONNECTING);
  });

  it("presenting, has no effect and returns its channel", async () => {
    const { env, calls } = await presenting(dmax);

    expect(bindToCurrentChannel(env)()).toMatchObject({ ccid: "dmax" });
    await flush();

    expect(calls).toEqual([]);
  });

  it("unrealized, presents at once what the TV presents, with only PlayStateChange (OIPF DAE Table 8)", async () => {
    const { env, calls, stream } = setup({ tuned: hgtv });
    startChannel(env)();

    expect(bindToCurrentChannel(env)()).toMatchObject({ ccid: "hgtv" });
    expect(getPlayState(env)()).toBe(PlayState.PRESENTING);
    stream(Stream.playing());
    await flush();

    // No stream loaded: the TV's goes on. No channel changed: none succeeds.
    expect(calls).toEqual([{ bind: true }, { presents: "hgtv" }, { playState: PlayState.PRESENTING }]);
  });

  it("unrealized again after the application released it, binds to the TV's channel the same way", async () => {
    const { env, calls } = await presenting(hgtv);
    release(env)();
    calls.length = 0;

    expect(bindToCurrentChannel(env)()).toMatchObject({ ccid: "hgtv" });

    expect(calls).toEqual([{ bind: true }, { presents: "hgtv" }, { playState: PlayState.PRESENTING }]);
  });

  it("unrealized while the TV's broadcast presents nothing, stays unrealized and says so", () => {
    const { env, calls } = setup({ tuned: hgtv, presented: false });

    expect(bindToCurrentChannel(env)()).toBeNull();
    expect(calls).toEqual([{ bind: true }, { playState: PlayState.UNREALIZED }]);
  });

  it("unrealized on a TV presenting nothing, binds nothing and tells the application it stays unrealized", () => {
    // It does not enter the unrealized state again: what the application changed meanwhile stays.
    const { env, calls } = setup({ tuned: null });

    expect(bindToCurrentChannel(env)()).toBeNull();
    expect(calls).toEqual([{ playState: PlayState.UNREALIZED }]);
  });
});

describe("nextChannel / prevChannel (zap)", () => {
  it("nextChannel() asks the TV for the next channel of the lineup, as setChannel() does", async () => {
    const { env, asked } = await presenting(dmax);

    await zap(1)(env)();

    expect(asked).toEqual(["hgtv"]);
    expect(getCurrentChannel(env)()).toMatchObject({ ccid: "hgtv" });
  });

  it("cycles at both ends of the lineup", async () => {
    const last = await presenting(news);
    await zap(1)(last.env)();
    expect(last.asked).toEqual(["dmax"]);

    const first = await presenting(dmax);
    await zap(-1)(first.env)();
    expect(first.asked).toEqual(["news"]);
  });

  it("from a channel outside the lineup, goes to the first one forward and the last one back", async () => {
    const forward = setup({ tuned: null, playState: PlayState.STOPPED });
    await zap(1)(forward.env)();
    const back = setup({ tuned: null, playState: PlayState.STOPPED });
    await zap(-1)(back.env)();

    expect(forward.asked).toEqual(["dmax"]);
    expect(back.asked).toEqual(["news"]);
  });

  it("reports the TV's refusal to the application, staying on its channel", async () => {
    const { env, calls } = await presenting(dmax, {
      requestChannelChange: () => () => TE.left(ChannelChangeErrorCode.UNKNOWN_CHANNEL),
    });

    await zap(-1)(env)();

    expect(calls).toEqual([{ error: ChannelChangeErrorCode.UNKNOWN_CHANNEL }]);
    expect(getCurrentChannel(env)()).toMatchObject({ ccid: "dmax" });
  });

  it("unrealized, fails with NO_CHANNEL_LIST and asks nobody", async () => {
    const { env, calls, asked } = await presenting(dmax);
    release(env)();
    calls.length = 0;

    await zap(1)(env)();

    expect(calls).toEqual([{ error: ChannelChangeErrorCode.NO_CHANNEL_LIST }]);
    expect(asked).toEqual([]);
  });

  it("with an empty lineup, fails with NO_CHANNEL_LIST", async () => {
    const { env, calls } = setup({ tuned: null, lineup: [], playState: PlayState.STOPPED });

    await zap(1)(env)();

    expect(calls).toEqual([{ error: ChannelChangeErrorCode.NO_CHANNEL_LIST }]);
  });
});

describe("getChannelConfig", () => {
  it("lists the TV's lineup, in its order, as it is when called", () => {
    let lineup: ReadonlyArray<ChannelConfig> = [dmax, hgtv];
    const { env } = setup();
    const live = { ...env, getChannels: () => lineup };

    expect(getChannelConfig(live)().channelList.length).toBe(2);
    lineup = [dmax, hgtv, news];
    const { channelList } = getChannelConfig(live)();

    expect(channelList.length).toBe(3);
    expect(channelList.item(2)).toMatchObject({ ccid: "news", name: "NEWS", sid: 60 });
  });
});

describe("applyChannelState (settings UI, scenario)", () => {
  it("currentChannel reaches the rest of the page; playState does not notify the application", () => {
    const { env, calls } = setup();

    applyChannelState({ currentChannel: channel(hgtv), playState: PlayState.PRESENTING })(env)();

    expect(getCurrentChannel(env)()).toMatchObject({ ccid: "hgtv" });
    expect(getPlayState(env)()).toBe(PlayState.PRESENTING);
    expect(calls).toEqual([{ presents: "hgtv" }]);
  });
});

describe("createChannelObject", () => {
  const registry = { getChannels: () => [dmax, hgtv] };

  it("gives the lineup's channel for its triplet", () => {
    expect(createChannelObject(DVB_T, 318, 1, 56)(registry)()).toMatchObject({ ccid: "hgtv", name: "HGTV" });
  });

  it("gives a channel the TV does not know for another triplet, null without one", () => {
    expect(createChannelObject(DVB_T, 1, 2, 3)(registry)()).toMatchObject({ idType: DVB_T, onid: 1, tsid: 2, sid: 3 });
    expect(createChannelObject(DVB_T, undefined, undefined, undefined)(registry)()).toBeNull();
  });
});

describe("channelApi", () => {
  it("currentChannel and playState are read live", async () => {
    const { env } = setup();
    const api = channelApi(env);

    await tuneTo(channel(hgtv))(env)();

    expect(api.currentChannel).toMatchObject({ ccid: "hgtv" });
    expect(api.playState).toBe(PlayState.CONNECTING);
  });

  it("setChannel(null) releases the object before it returns, as release() does (Table 8)", async () => {
    const { env, calls } = await presenting(dmax);
    const api = channelApi(env);

    api.setChannel(null);

    expect(api.playState).toBe(PlayState.UNREALIZED);
    expect(calls).toEqual([{ unrealized: true }, { playState: PlayState.UNREALIZED }, { release: true }]);
  });

  it("setChannel(null) then stop() leaves it unrealized; setChannel() to the channel presents it again", async () => {
    const { env, calls, stream } = await presenting(dmax);
    const api = channelApi(env);

    api.setChannel(null);
    api.stop();
    expect(api.playState).toBe(PlayState.UNREALIZED);

    if (api.playState === PlayState.UNREALIZED) api.setChannel(channel(dmax));
    await flush();
    stream(Stream.playing());

    expect(api.playState).toBe(PlayState.PRESENTING);
    expect(calls.filter((call) => "playState" in call || "stop" in call)).toEqual([
      { playState: PlayState.UNREALIZED },
      { playState: PlayState.CONNECTING },
      { playState: PlayState.PRESENTING },
    ]);
  });
});

describe("the stream (followStream)", () => {
  it.each([
    [Stream.idle(), PlayState.UNREALIZED],
    [Stream.connecting(), PlayState.CONNECTING],
    [Stream.buffering(), PlayState.CONNECTING],
    [Stream.playing(), PlayState.PRESENTING],
    [Stream.paused(), PlayState.PRESENTING],
    [Stream.stopped(), PlayState.STOPPED],
    [Stream.finished(), PlayState.STOPPED],
  ])("%o is play state %d", (stream, playState) => {
    expect(toPlayState(stream)).toBe(playState);
  });

  it("a channel change succeeds once its stream presents, and only once", async () => {
    const { env, calls, stream } = await presenting(dmax);

    await tuneTo(channel(hgtv))(env)();
    stream(Stream.playing());
    stream(Stream.buffering());
    stream(Stream.playing());

    expect(calls.filter((call) => "succeeded" in call)).toEqual([{ succeeded: "hgtv" }]);
    expect(getPlayState(env)()).toBe(PlayState.PRESENTING);
  });

  it("a change the application stopped before it presented does not succeed later", async () => {
    const { env, calls } = await presenting(dmax);

    await tuneTo(channel(hgtv))(env)();
    stop(env)();
    followStream(Stream.playing())(env)();

    expect(calls.filter((call) => "succeeded" in call)).toEqual([]);
  });
});

describe("startChannel (a new object)", () => {
  it("is unrealized, presents nothing, and follows the stream once it controls it (OIPF DAE §7.13.1.1)", async () => {
    const { env, calls, streamListeners } = setup({ tuned: hgtv });

    startChannel(env)();
    await flush();

    expect(getPlayState(env)()).toBe(PlayState.UNREALIZED);
    expect(getCurrentChannel(env)()).toBeNull();
    expect(streamListeners.size).toBe(1);
    expect(calls).toEqual([]);
  });

  it("returns the effect that stops following the stream", () => {
    const { env, streamListeners } = setup({ tuned: null });

    startChannel(env)()();

    expect(streamListeners.size).toBe(0);
  });
});
