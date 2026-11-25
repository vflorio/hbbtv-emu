import * as E from "fp-ts/Either";
import * as IO from "fp-ts/IO";
import { describe, expect, it, vi } from "vitest";
import {
  createFakeStorage,
  createFakeTabs,
  createFakeWebRequest,
  flushPromises,
  silentLogger,
} from "../../../__tests__/fakes";
import type { ExtensionState } from "../../../state";
import { StateManager } from "./state";
import { TabsManager } from "./tabs";

const setup = async () => {
  const stateManager = new StateManager({ storage: createFakeStorage<ExtensionState>().storage });
  await stateManager.init()();
  const tabs = createFakeTabs();
  const webRequest = createFakeWebRequest();
  const onTabAdded = vi.fn((_: number) => IO.of(undefined));
  const onTabRemoved = vi.fn((_: number) => IO.of(undefined));

  new TabsManager({
    logger: silentLogger(),
    stateManager,
    tabs: tabs.tabs,
    webRequest: webRequest.webRequest,
    handlers: { onTabAdded, onTabRemoved },
  });

  const enabledTabIds = () => {
    const state = stateManager.getState()();
    if (E.isLeft(state)) throw new Error("state not initialized");
    return [...state.right.enabledTabIds];
  };

  return { tabs, webRequest, onTabAdded, onTabRemoved, enabledTabIds };
};

const header = (name: string, value: string) => ({ name, value });

describe("TabsManager — content-type rewrite", () => {
  it("serves HbbTV documents as XHTML so the browser renders them", async () => {
    const { webRequest } = await setup();

    const result = webRequest.respond({
      type: "main_frame",
      responseHeaders: [header("Content-Type", "application/vnd.hbbtv.xhtml+xml; charset=utf-8")],
    });

    expect(result.responseHeaders).toEqual([header("Content-Type", "application/xhtml+xml")]);
  });

  it("also rewrites HbbTV documents loaded in iframes", async () => {
    const { webRequest } = await setup();

    const result = webRequest.respond({
      type: "sub_frame",
      responseHeaders: [header("content-type", "application/vnd.hbbtv.xhtml+xml")],
    });

    expect(result.responseHeaders?.[0]?.value).toBe("application/xhtml+xml");
  });

  it("keeps the other headers untouched", async () => {
    const { webRequest } = await setup();

    const result = webRequest.respond({
      type: "main_frame",
      responseHeaders: [header("Set-Cookie", "a=1"), header("Content-Type", "application/vnd.hbbtv.xhtml+xml")],
    });

    expect(result.responseHeaders?.[0]).toEqual(header("Set-Cookie", "a=1"));
  });

  it.each([
    ["a normal HTML page", "main_frame", "text/html"],
    ["an HbbTV content-type on a non-document request", "xmlhttprequest", "application/vnd.hbbtv.xhtml+xml"],
  ])("leaves %s alone", async (_, type, contentType) => {
    const { webRequest } = await setup();

    const result = webRequest.respond({
      type: type as chrome.webRequest.ResourceType,
      responseHeaders: [header("Content-Type", contentType)],
    });

    expect(result.responseHeaders).toEqual([header("Content-Type", contentType)]);
  });
});

describe("TabsManager — tab lifecycle", () => {
  it("enables a tab when it starts loading and notifies the handler", async () => {
    const { tabs, onTabAdded, enabledTabIds } = await setup();

    tabs.emit(7, "loading");
    await flushPromises();

    expect(enabledTabIds()).toEqual([7]);
    expect(onTabAdded).toHaveBeenCalledWith(7);
  });

  it("disables a tab when it is unloaded", async () => {
    const { tabs, onTabRemoved, enabledTabIds } = await setup();

    tabs.emit(7, "loading");
    await flushPromises();
    tabs.emit(7, "unloaded");
    await flushPromises();

    expect(enabledTabIds()).toEqual([]);
    expect(onTabRemoved).toHaveBeenCalledWith(7);
  });

  it("ignores the 'complete' status", async () => {
    const { tabs, onTabAdded, onTabRemoved, enabledTabIds } = await setup();

    tabs.emit(7, "complete");
    await flushPromises();

    expect(enabledTabIds()).toEqual([]);
    expect(onTabAdded).not.toHaveBeenCalled();
    expect(onTabRemoved).not.toHaveBeenCalled();
  });
});
