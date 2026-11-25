import type { DomChannel, HostMessage, PageConfig, PageMessage } from "@hbb-emu/protocol";
import * as IO from "fp-ts/IO";
import { describe, expect, it } from "vitest";
import { connectToHost, type PageRuntimeControl } from "./host";

/** An in-memory channel: `deliver` plays the host. */
const createFakeChannel = () => {
  const sent: PageMessage[] = [];
  let handler: ((message: HostMessage) => IO.IO<void>) | undefined;
  const channel: DomChannel<PageMessage, HostMessage> = {
    send: (message) => () => void sent.push(message),
    subscribe: (h) => () => {
      handler = h;
      return () => {
        handler = undefined;
      };
    },
  };
  return { channel, sent, deliver: (message: HostMessage) => handler?.(message)() };
};

const setup = () => {
  const fake = createFakeChannel();
  const calls: Array<{ config: PageConfig } | { key: number }> = [];
  const control: PageRuntimeControl = {
    applyConfig: (config) => () => void calls.push({ config }),
    dispatchKey: (key) => () => void calls.push({ key }),
  };
  const disconnect = connectToHost({ channel: fake.channel, control, url: "http://app/index.xhtml" })();
  return { ...fake, calls, disconnect };
};

const config: PageConfig = { userAgent: "HbbTV/1.5.1", channels: [] };

describe("connectToHost", () => {
  it("announces the page", () => {
    const { sent } = setup();

    expect(sent).toEqual([{ _tag: "Page/Ready", url: "http://app/index.xhtml" }]);
  });

  it("announces again when the bridge says hello (they can start in any order)", () => {
    const { sent, deliver } = setup();

    deliver({ _tag: "Host/Hello" });

    expect(sent).toHaveLength(2);
  });

  it("applies the host configuration", () => {
    const { calls, deliver } = setup();

    deliver({ _tag: "Host/Config", config });

    expect(calls).toEqual([{ config }]);
  });

  it("dispatches remote-control keys", () => {
    const { calls, deliver } = setup();

    deliver({ _tag: "Host/DispatchKey", keyCode: 403 });

    expect(calls).toEqual([{ key: 403 }]);
  });

  it("stops handling messages once disconnected", () => {
    const { calls, deliver, disconnect } = setup();

    disconnect();
    deliver({ _tag: "Host/DispatchKey", keyCode: 403 });

    expect(calls).toEqual([]);
  });

  it("is lazy", () => {
    const fake = createFakeChannel();

    connectToHost({
      channel: fake.channel,
      control: { applyConfig: () => IO.of(undefined), dispatchKey: () => IO.of(undefined) },
      url: "x",
    });

    expect(fake.sent).toEqual([]);
  });
});
