import * as IO from "fp-ts/IO";
import { describe, expect, it, vi } from "vitest";
import { createFakeTabs, createFakeWebRequest, flushPromises, silentLogger } from "../../../__tests__/fakes";
import { TabsManager } from "./tabs";

const setup = async () => {
  const tabs = createFakeTabs();
  const webRequest = createFakeWebRequest();
  const onTabRemoved = vi.fn((_: number) => IO.of(undefined));

  new TabsManager({
    logger: silentLogger(),
    tabs: tabs.tabs,
    webRequest: webRequest.webRequest,
    handlers: { onTabRemoved, onActiveTabChanged: IO.of(undefined) },
  });

  return { tabs, webRequest, onTabRemoved };
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
  it("notifies the handler when a tab is closed", async () => {
    const { tabs, onTabRemoved } = await setup();

    tabs.close(7);
    await flushPromises();

    expect(onTabRemoved).toHaveBeenCalledWith(7);
  });

  it.each([
    "loading",
    "complete",
    "unloaded",
  ] as const)("a tab that is %s is still open (navigations, reloads and discarded tabs end nothing)", async (status) => {
    const { tabs, onTabRemoved } = await setup();

    tabs.emit(7, status);
    await flushPromises();

    expect(onTabRemoved).not.toHaveBeenCalled();
  });
});
