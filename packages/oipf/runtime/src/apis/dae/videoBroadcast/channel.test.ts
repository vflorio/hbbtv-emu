import type { ChannelConfig } from "@hbb-emu/extension-common";
import { OIPF } from "@hbb-emu/oipf-api";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { describe, expect, it } from "vitest";
import { type ChannelChangeRequest, toBroadcastChannel, tuneAlone } from "../../../subsystems";
import {
  applyChannelState,
  bindToCurrentChannel,
  type ChannelEnv,
  changeChannel,
  channelApi,
  createChannelEnv,
  createChannelObject,
  getCurrentChannel,
  getPlayState,
  release,
  setChannel,
  setPlayState,
  stop,
  tuneTo,
} from "./channel";

const { PlayState, ChannelChangeErrorCode } = OIPF.DAE.Broadcast;
const DVB_T = OIPF.DAE.Broadcast.ChannelIdType.ID_DVB_T;

const dmax: ChannelConfig = { id: "dmax", name: "DMAX", mp4Source: "http://tv/dmax.mp4", onid: 318, tsid: 1, sid: 52 };
const hgtv: ChannelConfig = { id: "hgtv", name: "HGTV", mp4Source: "http://tv/hgtv.mp4", onid: 318, tsid: 1, sid: 56 };

/** Lets the tasks the synchronous OIPF methods start run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const channel = (config: ChannelConfig) => toBroadcastChannel(config) as OIPF.DAE.Broadcast.Channel;
const unknown = { idType: DVB_T, onid: 1, tsid: 2, sid: 3 } as OIPF.DAE.Broadcast.Channel;

type Call =
  | { readonly load: string }
  | { readonly play: true }
  | { readonly stop: true }
  | { readonly destroy: true }
  | { readonly playState: number }
  | { readonly error: number }
  | { readonly presents: string | null };

/** A video/broadcast on a TV tuned to `tuned`, whose answer to a change is `requestChannelChange`. */
const setup = ({
  tuned = dmax,
  requestChannelChange = () => tuneAlone,
  playState = PlayState.UNREALIZED,
}: {
  tuned?: ChannelConfig;
  requestChannelChange?: (env: () => ChannelEnv) => ChannelChangeRequest;
  playState?: OIPF.DAE.Broadcast.PlayState;
} = {}) => {
  const calls: Call[] = [];
  const asked: string[] = [];
  const tunedChannel = channel(tuned);
  const env: ChannelEnv = createChannelEnv(
    {
      getChannels: () => [dmax, hgtv],
      player: {
        loadSource: (source) => () => {
          calls.push({ load: source.url });
        },
        play: TE.fromIO(() => {
          calls.push({ play: true });
        }),
        stop: () => {
          calls.push({ stop: true });
        },
        destroy: () => {
          calls.push({ destroy: true });
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
  return { env, calls, asked };
};

/** A video/broadcast presenting `config`, with the calls it took cleared. */
const presenting = async (config: ChannelConfig, options: Parameters<typeof setup>[0] = {}) => {
  const fixture = setup({ tuned: config, ...options });
  await tuneTo(channel(config))(fixture.env)();
  setPlayState(PlayState.PRESENTING)(fixture.env)();
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
});

describe("tuneTo (the TV changed channel)", () => {
  it("presents the channel: connecting, then its stream, and the page follows", async () => {
    const { env, calls, asked } = setup();

    await tuneTo(channel(hgtv))(env)();

    expect(getCurrentChannel(env)()).toMatchObject({ ccid: "hgtv" });
    expect(calls).toEqual([{ playState: PlayState.CONNECTING }, { presents: "hgtv" }, { load: hgtv.mp4Source }]);
    expect(asked).toEqual([]);
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
    expect(calls).toEqual([{ playState: PlayState.UNREALIZED }, { destroy: true }]);
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

  it("release() gives the player up once, keeping the channel", async () => {
    const { env, calls } = await presenting(dmax);

    release(env)();
    release(env)();

    expect(calls).toEqual([{ playState: PlayState.UNREALIZED }, { destroy: true }]);
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

  it("presenting, resumes the stream", async () => {
    const { env, calls } = await presenting(dmax);

    expect(bindToCurrentChannel(env)()).toMatchObject({ ccid: "dmax" });
    await flush();

    expect(calls).toEqual([{ play: true }]);
  });

  it("unrealized, binds nothing", () => {
    const { env, calls } = setup();

    expect(bindToCurrentChannel(env)()).toBeNull();
    expect(calls).toEqual([]);
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
});
