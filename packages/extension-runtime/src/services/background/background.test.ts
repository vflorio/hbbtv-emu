import type { HostMessage } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import {
  createFakeMessaging,
  createFakeStorage,
  createFakeTabs,
  createFakeWebRequest,
  flushPromises,
  silentLogger,
} from "../../__tests__/fakes";
import { DEFAULT_STATE, type ExtensionState, toPageConfig } from "../../state";
import { BackgroundService } from "./background";

const setup = async (stored?: ExtensionState) => {
  const messaging = createFakeMessaging<HostMessage>();
  const background = new BackgroundService({
    config: { engine: "chrome", manifest: 3, storageKey: "test" },
    logger: silentLogger(),
    adapter: {
      storage: createFakeStorage<ExtensionState>(stored).storage,
      messaging: messaging.messaging,
      tabs: createFakeTabs().tabs,
      webRequest: createFakeWebRequest().webRequest,
    },
  });
  expect(E.isRight(await background.init()())).toBe(true);
  return { background, messaging };
};

describe("BackgroundService", () => {
  it("sends the configuration to a page runtime that announces itself", async () => {
    const { messaging } = await setup();

    messaging.receive({ _tag: "Page/Ready", url: "http://app" }, 7);
    await flushPromises();

    expect(messaging.sent).toEqual([
      { tabId: 7, message: { _tag: "Host/Config", config: toPageConfig(DEFAULT_STATE) } },
    ]);
  });

  it("sends the persisted configuration, not the defaults", async () => {
    const stored = { ...DEFAULT_STATE, runtime: { ...DEFAULT_STATE.runtime, userAgent: "Custom TV/1.0" } };
    const { messaging } = await setup(stored);

    messaging.receive({ _tag: "Page/Ready", url: "http://app" }, 7);
    await flushPromises();

    expect(messaging.sent[0]?.message).toMatchObject({ _tag: "Host/Config", config: { userAgent: "Custom TV/1.0" } });
  });

  it("never pushes OIPF object state to the page (it would wipe what the application did)", async () => {
    const { messaging } = await setup();

    messaging.receive({ _tag: "Page/Ready", url: "http://app" }, 7);
    await flushPromises();

    const config = (messaging.sent[0]?.message as Extract<HostMessage, { _tag: "Host/Config" }>).config;
    expect(Object.keys(config).sort()).toEqual(["channels", "userAgent"]);
  });

  it("ignores messages that are not from a page runtime", async () => {
    const { messaging } = await setup();

    messaging.receive({ _tag: "Something/Else" }, 7);
    await flushPromises();

    expect(messaging.sent).toEqual([]);
  });
});

describe("default configuration", () => {
  it("has a real user agent and the default channel lineup", () => {
    const config = toPageConfig(DEFAULT_STATE);

    expect(config.userAgent).toContain("HbbTV/");
    expect(config.channels.length).toBeGreaterThan(0);
  });
});
