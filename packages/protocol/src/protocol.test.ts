import { describe, expect, it, vi } from "vitest";
import { createBridgeChannel, createPageChannel, TO_HOST_EVENT, TO_PAGE_EVENT } from "./domChannel";
import { type HostMessage, isHostMessage, isPageMessage, type PageMessage } from "./messages";

const collect = <T>() => {
  const received: T[] = [];
  return { received, handler: (message: T) => () => void received.push(message) };
};

describe("message guards", () => {
  it.each<[unknown, boolean]>([
    [{ _tag: "Host/Hello" }, true],
    [{ _tag: "Host/DispatchKey", keyCode: 403 }, true],
    [{ _tag: "Host/DispatchKey", keyCode: "403" }, false],
    [{ _tag: "Host/DispatchKey", keyCode: 4.5 }, false],
    [{ _tag: "Host/Config", config: { userAgent: "ua", channels: [] } }, true],
    [{ _tag: "Host/Config", config: { userAgent: "ua" } }, false],
    [{ _tag: "Page/Ready", url: "x" }, false],
    [null, false],
    ["Host/Hello", false],
  ])("isHostMessage(%j) → %s", (value, expected) => {
    expect(isHostMessage(value)).toBe(expected);
  });

  it.each<[unknown, boolean]>([
    [{ _tag: "Page/Ready", url: "http://app" }, true],
    [{ _tag: "Page/Ready" }, false],
    [{ _tag: "Page/SetChannel", channelId: "hgtv" }, true],
    [{ _tag: "Page/SetChannel" }, false],
    [{ _tag: "Page/TvKey", keyCode: 427 }, true],
    [{ _tag: "Page/TvKey", keyCode: "427" }, false],
    [{ _tag: "Page/TvKey" }, false],
    [{ _tag: "Page/FetchStreamEventDescription", url: "http://tv/a.ste" }, true],
    [{ _tag: "Page/FetchStreamEventDescription" }, false],
    [{ _tag: "Page/DestroyApplication" }, true],
    [{ _tag: "Page/CreateApplication", url: "dvb://current.ait/1.1" }, true],
    [{ _tag: "Page/CreateApplication" }, false],
    [{ _tag: "Host/Hello" }, false],
  ])("isPageMessage(%j) → %s", (value, expected) => {
    expect(isPageMessage(value)).toBe(expected);
  });
});

describe("DOM channel", () => {
  it("carries page messages to the bridge and host messages to the page", () => {
    const page = createPageChannel(document);
    const bridge = createBridgeChannel(document);
    const atBridge = collect<PageMessage>();
    const atPage = collect<HostMessage>();
    bridge.subscribe(atBridge.handler)();
    page.subscribe(atPage.handler)();

    page.send({ _tag: "Page/Ready", url: "http://app" })();
    bridge.send({ _tag: "Host/DispatchKey", keyCode: 403 })();

    expect(atBridge.received).toEqual([{ _tag: "Page/Ready", url: "http://app" }]);
    expect(atPage.received).toEqual([{ _tag: "Host/DispatchKey", keyCode: 403 }]);
  });

  it("does not echo a side's own messages back to it", () => {
    const page = createPageChannel(document);
    const atPage = collect<HostMessage>();
    page.subscribe(atPage.handler)();

    page.send({ _tag: "Page/Ready", url: "http://app" })();

    expect(atPage.received).toEqual([]);
  });

  it("travels as a JSON string, the only payload that crosses JS worlds", () => {
    const seen = vi.fn();
    document.addEventListener(TO_HOST_EVENT, (event) => seen((event as CustomEvent).detail), { once: true });

    createPageChannel(document).send({ _tag: "Page/Ready", url: "http://app" })();

    expect(seen).toHaveBeenCalledWith('{"_tag":"Page/Ready","url":"http://app"}');
  });

  it("drops malformed or foreign payloads (e.g. forged by the application)", () => {
    const page = createPageChannel(document);
    const atPage = collect<HostMessage>();
    page.subscribe(atPage.handler)();

    for (const detail of ["not json", '{"_tag":"Host/Unknown"}', { _tag: "Host/Hello" }, null]) {
      document.dispatchEvent(new CustomEvent(TO_PAGE_EVENT, { detail }));
    }

    expect(atPage.received).toEqual([]);
  });

  it("stops delivering after unsubscribe", () => {
    const page = createPageChannel(document);
    const bridge = createBridgeChannel(document);
    const atPage = collect<HostMessage>();
    const unsubscribe = page.subscribe(atPage.handler)();

    unsubscribe();
    bridge.send({ _tag: "Host/Hello" })();

    expect(atPage.received).toEqual([]);
  });
});

describe("host edits and session", () => {
  it.each<[unknown, boolean]>([
    [{ _tag: "Host/ApplyState", patch: { videoBroadcast: { volume: 30 } } }, true],
    [{ _tag: "Host/ApplyState", patch: "volume=30" }, false],
    [{ _tag: "Host/Session", session: { channel: { id: "ch1", name: "DMAX" }, volume: 100 } }, true],
    [{ _tag: "Host/Session", session: { channel: null, volume: 40 } }, true],
    [{ _tag: "Host/Session", session: { channel: null } }, false],
    [{ _tag: "Host/Session", session: { channel: null, volume: "40" } }, false],
    [{ _tag: "Host/Session", session: { channel: { name: "DMAX" }, volume: 100 } }, false],
    [{ _tag: "Host/Session", session: {} }, false],
    [{ _tag: "Host/ChannelChangeError", channelId: "hgtv", error: 5 }, true],
    [{ _tag: "Host/ChannelChangeError", channelId: "hgtv", error: "5" }, false],
    [{ _tag: "Host/ChannelChangeError", error: 5 }, false],
    [
      { _tag: "Host/StreamEventDescription", url: "u", result: { ok: true, contentType: null, body: "<dsmcc/>" } },
      true,
    ],
    [{ _tag: "Host/StreamEventDescription", url: "u", result: { ok: true, contentType: "text/xml", body: "" } }, true],
    [{ _tag: "Host/StreamEventDescription", url: "u", result: { ok: false, reason: "HTTP 404" } }, true],
    [{ _tag: "Host/StreamEventDescription", url: "u", result: { ok: true, body: "" } }, false],
    [{ _tag: "Host/StreamEventDescription", url: "u", result: { ok: false } }, false],
    [{ _tag: "Host/StreamEventDescription", result: { ok: false, reason: "x" } }, false],
  ])("isHostMessage(%j) → %s", (value, expected) => {
    expect(isHostMessage(value)).toBe(expected);
  });
});
