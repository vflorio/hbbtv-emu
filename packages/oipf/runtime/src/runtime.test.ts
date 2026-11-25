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
