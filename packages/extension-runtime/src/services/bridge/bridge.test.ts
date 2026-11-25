import { createBridgeChannel, createPageChannel, type HostMessage, type PageMessage } from "@hbb-emu/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeExtensionChannel, flushPromises, silentLogger } from "../../__tests__/fakes";
import { startBridge } from "./bridge";

const stops: Array<() => void> = [];

/** The real DOM channel on jsdom's document; the page side is played by `page`. */
const setup = () => {
  const extension = createFakeExtensionChannel<PageMessage>();
  const page = createPageChannel(document);
  const atPage: HostMessage[] = [];
  stops.push(page.subscribe((message) => () => void atPage.push(message))());
  const stop = startBridge({ page: createBridgeChannel(document), extension: extension.channel, logger: silentLogger() })();
  stops.push(stop);
  return { extension, page, atPage, stop };
};

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

describe("bridge", () => {
  it("says hello to the page on start, in case the page announced itself first", () => {
    const { atPage } = setup();

    expect(atPage).toEqual([{ _tag: "Host/Hello" }]);
  });

  it("forwards page announcements to the background", () => {
    const { extension, page } = setup();

    page.send({ _tag: "Page/Ready", url: "http://app" })();

    expect(extension.sent).toEqual([{ _tag: "Page/Ready", url: "http://app" }]);
  });

  it("forwards host messages from the background to the page", () => {
    const { extension, atPage } = setup();

    extension.receive({ _tag: "Host/DispatchKey", keyCode: 403 });

    expect(atPage).toContainEqual({ _tag: "Host/DispatchKey", keyCode: 403 });
  });

  it("drops anything from the background that is not a host message", () => {
    const { extension, atPage } = setup();

    extension.receive({ _tag: "Something/Else" });
    extension.receive("noise");

    expect(atPage).toEqual([{ _tag: "Host/Hello" }]);
  });

  it("survives a failed forward (e.g. the background is restarting)", async () => {
    const { extension, page } = setup();
    extension.failNextSend();

    page.send({ _tag: "Page/Ready", url: "http://app" })();
    await flushPromises();
    page.send({ _tag: "Page/Ready", url: "http://app" })();

    expect(extension.sent).toHaveLength(1);
  });

  it("stops forwarding once stopped", () => {
    const { extension, page, atPage, stop } = setup();

    stop();
    page.send({ _tag: "Page/Ready", url: "http://app" })();
    extension.receive({ _tag: "Host/DispatchKey", keyCode: 403 });

    expect(extension.sent).toEqual([]);
    expect(atPage).toEqual([{ _tag: "Host/Hello" }]);
  });
});
