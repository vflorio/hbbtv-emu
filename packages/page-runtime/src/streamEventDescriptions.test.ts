import type { PageMessage } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHostStreamEventDescriptions, STREAM_EVENT_DESCRIPTION_TIMEOUT_MS } from "./streamEventDescriptions";

const url = "http://tv/it/default.ste";

const setup = () => {
  const sent: PageMessage[] = [];
  const descriptions = createHostStreamEventDescriptions((message) => () => void sent.push(message));
  return { sent, descriptions };
};

describe("stream event descriptions fetched by the host", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the host once per URL, and every request gets the answer", async () => {
    const { sent, descriptions } = setup();
    const first = descriptions.fetch(url)();
    const second = descriptions.fetch(url)();

    descriptions.settle(url, { ok: true, contentType: "application/vnd.dvb.streamevent+xml", body: "<dsmcc/>" })();

    expect(sent).toEqual([{ _tag: "Page/FetchStreamEventDescription", url }]);
    const file = E.right({ contentType: "application/vnd.dvb.streamevent+xml", body: "<dsmcc/>" });
    expect(await first).toEqual(file);
    expect(await second).toEqual(file);
  });

  it("fails with the host's reason, and only for that URL", async () => {
    const { descriptions } = setup();
    const missing = descriptions.fetch(url)();
    const other = descriptions.fetch("http://tv/other.ste")();

    descriptions.settle(url, { ok: false, reason: "HTTP 404" })();
    descriptions.settle("http://tv/other.ste", { ok: true, contentType: null, body: "" })();

    expect(await missing).toEqual(E.left("HTTP 404"));
    expect(await other).toEqual(E.right({ contentType: null, body: "" }));
  });

  it("asks again once answered", () => {
    const { sent, descriptions } = setup();
    void descriptions.fetch(url)();
    descriptions.settle(url, { ok: false, reason: "HTTP 404" })();

    void descriptions.fetch(url)();

    expect(sent).toHaveLength(2);
  });

  it("fails after the timeout when the host does not answer", async () => {
    vi.useFakeTimers();
    const { descriptions } = setup();
    const result = descriptions.fetch(url)();

    vi.advanceTimersByTime(STREAM_EVENT_DESCRIPTION_TIMEOUT_MS);

    expect(E.isLeft(await result)).toBe(true);
  });
});
