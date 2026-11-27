import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import { OIPF } from "@hbb-emu/oipf-api";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntimeEnv, type RuntimeHandle, runtime } from "./runtime";
import { type ChannelChangeRequest, resolveChannel, tuneAlone } from "./subsystems";

/** MutationObserver callbacks are microtasks. */
const flushMutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const started: RuntimeHandle[] = [];

const startRuntime = () => {
  const handle = runtime(createRuntimeEnv({ ...DEFAULT_EXTENSION_STATE, channels: [] }))();
  started.push(handle);
  return handle;
};

const addObject = (type: string) => {
  const element = document.createElement("object");
  element.setAttribute("type", type);
  document.body.appendChild(element);
  return element as HTMLObjectElement & Record<string, unknown>;
};

afterEach(() => {
  for (const handle of started.splice(0)) handle.stop()();
  document.body.innerHTML = "";
});

describe("runtime", () => {
  it("once started, binds OIPF objects added to the document", async () => {
    startRuntime();

    const appMgr = addObject("application/oipfApplicationManager");
    await flushMutations();

    expect(typeof appMgr.getOwnerApplication).toBe("function");
  });

  it("binds non-visual objects with a working API", async () => {
    startRuntime();

    const appMgr = addObject("application/oipfApplicationManager") as unknown as {
      getOwnerApplication: (doc: Document) => {
        privateData: { keyset: { setValue: (v: number) => void; value: number } };
      };
    };
    await flushMutations();
    const keyset = appMgr.getOwnerApplication(document).privateData.keyset;
    keyset.setValue(0x1f);

    expect(keyset.value).toBe(0x1f);
  });

  it("gives one keyset per page, whichever application manager the application asks", async () => {
    startRuntime();
    type AppMgr = { getOwnerApplication: (doc: Document) => { privateData: { keyset: unknown } } };

    const first = addObject("application/oipfApplicationManager") as unknown as AppMgr;
    const second = addObject("application/oipfApplicationManager") as unknown as AppMgr;
    await flushMutations();

    expect(first.getOwnerApplication(document).privateData.keyset).toBe(
      second.getOwnerApplication(document).privateData.keyset,
    );
  });

  it("destroyApplication() tells the TV that the application exits, from any application manager", async () => {
    const env = createRuntimeEnv({ ...DEFAULT_EXTENSION_STATE, channels: [] });
    let exits = 0;
    started.push(
      runtime({
        ...env,
        bindings: {
          ...env.bindings,
          exitApplication: () => {
            exits += 1;
          },
        },
      })(),
    );
    type AppMgr = { getOwnerApplication: (doc: Document) => { destroyApplication: () => void } };

    const markup = addObject("application/oipfApplicationManager") as unknown as AppMgr;
    await flushMutations();
    markup.getOwnerApplication(document).destroyApplication();
    const factory = (window as unknown as { oipfObjectFactory: { createApplicationManagerObject: () => unknown } })
      .oipfObjectFactory;
    (factory.createApplicationManagerObject() as AppMgr).getOwnerApplication(document).destroyApplication();

    expect(exits).toBe(2);
  });

  it("delivers a remote-control key only once the application's keyset asks for it", async () => {
    const handle = startRuntime();
    const appMgr = addObject("application/oipfApplicationManager") as unknown as {
      getOwnerApplication: (doc: Document) => { privateData: { keyset: { setValue: (v: number) => number } } };
    };
    await flushMutations();
    const keys: number[] = [];
    const listener = (event: KeyboardEvent) => keys.push(event.keyCode);
    document.addEventListener("keydown", listener);

    try {
      handle.dispatchKey(403)();
      appMgr.getOwnerApplication(document).privateData.keyset.setValue(0x1);
      handle.dispatchKey(403)();
      handle.dispatchKey(38)();

      expect(keys).toEqual([403]);
    } finally {
      document.removeEventListener("keydown", listener);
    }
  });

  it("stops binding objects once stopped", async () => {
    startRuntime().stop()();

    const appMgr = addObject("application/oipfApplicationManager");
    await flushMutations();

    expect(appMgr.getOwnerApplication).toBeUndefined();
  });
});

describe("runtime — host configuration", () => {
  const channel = { id: "dmax", name: "DMAX", mp4Source: "http://tv/dmax.mp4", onid: 318, tsid: 1, sid: 52 };
  const tuneTo = { idType: OIPF.DAE.Broadcast.ChannelIdType.ID_DVB_T, onid: 318, tsid: 1, sid: 52 };

  const start = () => {
    const env = createRuntimeEnv({ ...DEFAULT_EXTENSION_STATE, channels: [] });
    const handle = runtime(env)();
    started.push(handle);
    return { env, handle };
  };

  it("applies the host's user agent after start", () => {
    const { handle } = start();

    handle.updateExtensionState({ ...DEFAULT_EXTENSION_STATE, userAgent: "Custom TV/1.0 HbbTV/1.5.1" })();

    expect(navigator.userAgent).toBe("Custom TV/1.0 HbbTV/1.5.1");
  });

  it("applies the host's channel lineup after start", async () => {
    const { env, handle } = start();
    const resolve = () => resolveChannel(tuneTo as OIPF.DAE.Broadcast.Channel)(env.channelRegistry)();

    expect(E.isLeft(await resolve())).toBe(true);

    handle.updateExtensionState({ ...DEFAULT_EXTENSION_STATE, channels: [channel] })();

    expect(await resolve()).toEqual(E.right({ url: channel.mp4Source, config: channel }));
  });
});

describe("runtime — tuned channel (the tab's TV session)", () => {
  const dmax = { id: "dmax", name: "DMAX", mp4Source: "http://tv/dmax.mp4", onid: 318, tsid: 1, sid: 52 };
  const hgtv = { id: "hgtv", name: "HGTV", mp4Source: "http://tv/hgtv.mp4", onid: 318, tsid: 1, sid: 56 };

  type VideoBroadcastObject = {
    currentChannel: { ccid: string } | null;
    playState: number;
    release: () => void;
    bindToCurrentChannel: () => unknown;
  };
  type PrivateData = { currentChannel: { ccid: string; sid: number } | null };

  const start = () => {
    const handle = runtime(createRuntimeEnv({ ...DEFAULT_EXTENSION_STATE, channels: [dmax, hgtv] }))();
    started.push(handle);
    return handle;
  };

  const privateData = async (): Promise<PrivateData> => {
    const appMgr = addObject("application/oipfApplicationManager") as unknown as {
      getOwnerApplication: (doc: Document) => { privateData: PrivateData };
    };
    await flushMutations();
    return appMgr.getOwnerApplication(document).privateData;
  };

  /** A video/broadcast the application binds, as applications do at start. */
  const videoBroadcast = async (): Promise<VideoBroadcastObject> => {
    const object = addObject("video/broadcast") as unknown as VideoBroadcastObject;
    await flushMutations();
    object.bindToCurrentChannel();
    return object;
  };

  it("until the host says otherwise, the TV is on the first channel of the lineup", async () => {
    start();

    expect((await privateData()).currentChannel).toMatchObject({ ccid: "dmax", sid: 52 });
  });

  it("a new video/broadcast is unrealized until the application binds it (OIPF DAE §7.13.1.1)", async () => {
    start();

    const object = addObject("video/broadcast") as unknown as VideoBroadcastObject;
    await flushMutations();

    expect(object.playState).toBe(OIPF.DAE.Broadcast.PlayState.UNREALIZED);
    expect(object.currentChannel).toBeNull();
  });

  it("a bound video/broadcast presents the channel the TV is tuned to, at once", async () => {
    start().tune(hgtv)();

    expect((await videoBroadcast()).currentChannel).toMatchObject({ ccid: "hgtv" });
  });

  it("tuning changes the channel applications read, and switches a presenting video/broadcast", async () => {
    const handle = start();
    const data = await privateData();
    const object = await videoBroadcast();
    expect(object.currentChannel).toMatchObject({ ccid: "dmax" });

    handle.tune(hgtv)();
    await flushMutations();

    expect(data.currentChannel).toMatchObject({ ccid: "hgtv" });
    expect(object.currentChannel).toMatchObject({ ccid: "hgtv" });
  });

  it("a video/broadcast the application released stays released", async () => {
    const handle = start();
    const object = await videoBroadcast();
    object.release();
    await flushMutations();
    expect(object.playState).toBe(OIPF.DAE.Broadcast.PlayState.UNREALIZED);

    handle.tune(hgtv)();
    await flushMutations();

    expect(object.playState).toBe(OIPF.DAE.Broadcast.PlayState.UNREALIZED);
    expect(object.currentChannel).toMatchObject({ ccid: "dmax" });
  });
});

describe("runtime — an application's channel change (setChannel)", () => {
  const dmax = { id: "dmax", name: "DMAX", mp4Source: "http://tv/dmax.mp4", onid: 318, tsid: 1, sid: 52 };
  const hgtv = { id: "hgtv", name: "HGTV", mp4Source: "http://tv/hgtv.mp4", onid: 318, tsid: 1, sid: 56 };
  const DVB_T = OIPF.DAE.Broadcast.ChannelIdType.ID_DVB_T;

  type VideoBroadcastObject = {
    currentChannel: { ccid?: string; sid: number } | null;
    bindToCurrentChannel: () => unknown;
    setChannel: (channel: unknown) => void;
    createChannelObject: (idType: number, onid?: number, tsid?: number, sid?: number) => { ccid?: string } | null;
    onChannelChangeError?: (channel: unknown, error: number) => void;
  };

  const start = (requestChannelChange: ChannelChangeRequest) => {
    const env = createRuntimeEnv({ ...DEFAULT_EXTENSION_STATE, channels: [dmax, hgtv] });
    const handle = runtime({ ...env, bindings: { ...env.bindings, requestChannelChange } })();
    started.push(handle);
    return handle;
  };

  const videoBroadcast = async () => {
    const object = addObject("video/broadcast") as unknown as VideoBroadcastObject;
    await flushMutations();
    object.bindToCurrentChannel();
    const errors: number[] = [];
    object.onChannelChangeError = (_, error) => errors.push(error);
    return { object, errors };
  };

  it("asks the TV before changing to another service, and follows it once it is there", async () => {
    const asked: string[] = [];
    start((channel) => {
      asked.push(channel.id);
      return TE.right(undefined);
    });
    const { object, errors } = await videoBroadcast();

    object.setChannel(object.createChannelObject(DVB_T, 318, 1, 56));
    await flushMutations();

    expect(asked).toEqual(["hgtv"]);
    expect(object.currentChannel).toMatchObject({ ccid: "hgtv" });
    expect(errors).toEqual([]);
  });

  it("stays on its channel and reports the TV's error when the TV refuses", async () => {
    start(() => TE.left(OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNKNOWN_CHANNEL));
    const { object, errors } = await videoBroadcast();

    object.setChannel(object.createChannelObject(DVB_T, 318, 1, 56));
    await flushMutations();

    expect(errors).toEqual([OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNKNOWN_CHANNEL]);
    expect(object.currentChannel).toMatchObject({ ccid: "dmax" });
  });

  it("asks nothing for the service the TV is on, nor for one the lineup does not have", async () => {
    const asked: string[] = [];
    start((channel) => {
      asked.push(channel.id);
      return TE.right(undefined);
    });
    const { object, errors } = await videoBroadcast();

    object.setChannel(object.createChannelObject(DVB_T, 318, 1, 52));
    object.setChannel(object.createChannelObject(DVB_T, 1, 2, 3));
    await flushMutations();

    expect(asked).toEqual([]);
    expect(errors).toEqual([OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNKNOWN_CHANNEL]);
    expect(object.currentChannel).toMatchObject({ ccid: "dmax" });
  });

  it("the TV's own tuning asks nobody", async () => {
    const asked: string[] = [];
    const handle = start((channel) => {
      asked.push(channel.id);
      return TE.right(undefined);
    });
    const { object } = await videoBroadcast();

    handle.tune(hgtv)();
    await flushMutations();

    expect(asked).toEqual([]);
    expect(object.currentChannel).toMatchObject({ ccid: "hgtv" });
  });

  it("createChannelObject() gives the lineup's channel for its triplet, null without one", async () => {
    start(tuneAlone);
    const { object } = await videoBroadcast();

    expect(object.createChannelObject(DVB_T, 318, 1, 56)).toMatchObject({ ccid: "hgtv", name: "HGTV" });
    expect(object.createChannelObject(DVB_T, 1, 2, 3)).toMatchObject({ idType: DVB_T, onid: 1, tsid: 2, sid: 3 });
    expect(object.createChannelObject(DVB_T)).toBeNull();
  });
});

describe("runtime — oipfObjectFactory", () => {
  const dmax = { id: "dmax", name: "DMAX", mp4Source: "http://tv/dmax.mp4", onid: 318, tsid: 1, sid: 52 };
  const hgtv = { id: "hgtv", name: "HGTV", mp4Source: "http://tv/hgtv.mp4", onid: 318, tsid: 1, sid: 56 };

  type Factory = Record<string, (...args: unknown[]) => unknown> & {
    isObjectSupported: (mimeType: string) => boolean;
  };
  const factory = () => (window as unknown as { oipfObjectFactory?: Factory }).oipfObjectFactory;

  const start = () => {
    const handle = runtime(createRuntimeEnv({ ...DEFAULT_EXTENSION_STATE, channels: [dmax, hgtv] }))();
    started.push(handle);
    return handle;
  };

  it("is window.oipfObjectFactory while the runtime runs", () => {
    const handle = start();
    expect(factory()).toBeDefined();

    handle.stop()();

    expect(factory()).toBeUndefined();
  });

  it("supports exactly the objects the runtime binds", () => {
    start();
    const supported = (mimeType: string) => factory()?.isObjectSupported(mimeType);

    expect(supported("video/broadcast")).toBe(true);
    expect(supported("application/oipfApplicationManager")).toBe(true);
    expect(supported("application/oipfCapabilities")).toBe(true);
    expect(supported("application/oipfConfiguration")).toBe(true);
    expect(supported("video/mp4")).toBe(true);
    expect(supported("application/oipfDrmAgent")).toBe(false);
    expect(supported("application/oipfStatusView")).toBe(false);
  });

  it("creates objects that work before the application inserts them", () => {
    start();

    const appMgr = factory()?.createApplicationManagerObject() as HTMLObjectElement & {
      getOwnerApplication: (doc: Document) => { privateData: { currentChannel: { ccid: string } | null } };
    };

    expect(appMgr.type).toBe("application/oipfApplicationManager");
    expect(appMgr.isConnected).toBe(false);
    expect(appMgr.getOwnerApplication(document).privateData.currentChannel).toMatchObject({ ccid: "dmax" });
  });

  it("a created video/broadcast binds before it is inserted, and inserting it binds nothing more", async () => {
    start();

    const video = factory()?.createVideoBroadcastObject() as HTMLObjectElement & {
      currentChannel: { ccid: string } | null;
      bindToCurrentChannel: () => unknown;
    };
    video.bindToCurrentChannel();
    // Out of the document, the object shows nothing: the broadcast's video waits for it.
    expect(video.querySelectorAll("video")).toHaveLength(0);
    document.body.appendChild(video);
    await flushMutations();

    expect(video.type).toBe("video/broadcast");
    expect(video.currentChannel).toMatchObject({ ccid: "dmax" });
    expect(video.querySelectorAll("video")).toHaveLength(1);
  });

  it("createChannelConfig() lists the lineup", () => {
    start();

    const config = factory()?.createChannelConfig() as {
      channelList: { length: number; item: (i: number) => unknown };
    };

    expect(config.channelList.length).toBe(2);
    expect(config.channelList.item(1)).toMatchObject({ ccid: "hgtv" });
  });

  it("has no method for an object the emulator does not implement: calling it is a TypeError", () => {
    start();
    // What an application written for a full OITF would call.
    const unsupported = factory() as unknown as { createDrmAgentObject: () => unknown };

    expect(unsupported.createDrmAgentObject).toBeUndefined();
    expect(() => unsupported.createDrmAgentObject()).toThrow(TypeError);
  });
});
