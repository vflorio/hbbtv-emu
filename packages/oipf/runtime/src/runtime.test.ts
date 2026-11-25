import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import { OIPF } from "@hbb-emu/oipf-api";
import * as E from "fp-ts/Either";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntimeEnv, type RuntimeHandle, runtime } from "./runtime";
import { resolveChannel } from "./subsystems";

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

  const videoBroadcast = async (): Promise<VideoBroadcastObject> => {
    const object = addObject("video/broadcast") as unknown as VideoBroadcastObject;
    await flushMutations();
    return object;
  };

  it("until the host says otherwise, the TV is on the first channel of the lineup", async () => {
    start();

    expect((await privateData()).currentChannel).toMatchObject({ ccid: "dmax", sid: 52 });
  });

  it("a video/broadcast presents the channel the TV is tuned to", async () => {
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
