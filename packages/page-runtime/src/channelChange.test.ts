import type { ChannelConfig } from "@hbb-emu/extension-common";
import { OIPF } from "@hbb-emu/oipf-api";
import type { PageMessage } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_CHANGE_TIMEOUT_MS, createHostChannelChanges } from "./channelChange";

const hgtv = { id: "hgtv", name: "HGTV", onid: 318, tsid: 1, sid: 56 } as ChannelConfig;
const dmax = { id: "dmax", name: "DMAX", onid: 318, tsid: 1, sid: 52 } as ChannelConfig;

const setup = () => {
  const sent: PageMessage[] = [];
  const changes = createHostChannelChanges((message) => () => void sent.push(message));
  return { sent, changes };
};

describe("channel changes asked of the host", () => {
  it("asks the host for the channel", () => {
    const { sent, changes } = setup();

    void changes.request(hgtv)();

    expect(sent).toEqual([{ _tag: "Page/SetChannel", channelId: "hgtv" }]);
  });

  it("succeeds once the tab's session is on that channel", async () => {
    const { changes } = setup();
    const result = changes.request(hgtv)();

    changes.settle({ channel: dmax })();
    changes.settle({ channel: hgtv })();

    expect(await result).toEqual(E.right(undefined));
  });

  it("fails with the error the host gives for that channel", async () => {
    const { changes } = setup();
    const toDmax = changes.request(dmax)();
    const toHgtv = changes.request(hgtv)();

    changes.fail("hgtv", 5)();
    changes.settle({ channel: dmax })();

    expect(await toHgtv).toEqual(E.left(5));
    expect(await toDmax).toEqual(E.right(undefined));
  });
});

describe("channel changes the host does not answer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fail after the timeout with an unidentified error", async () => {
    vi.useFakeTimers();
    const { changes } = setup();
    const result = changes.request(hgtv)();

    vi.advanceTimersByTime(CHANNEL_CHANGE_TIMEOUT_MS);

    expect(await result).toEqual(E.left(OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNIDENTIFIED_ERROR));
  });

  it("…without affecting a later request for the same channel, which the host answers", async () => {
    vi.useFakeTimers();
    const { changes } = setup();
    const lost = changes.request(hgtv)();
    vi.advanceTimersByTime(CHANNEL_CHANGE_TIMEOUT_MS);
    const answered = changes.request(hgtv)();

    changes.settle({ channel: hgtv })();

    expect(await lost).toEqual(E.left(OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNIDENTIFIED_ERROR));
    expect(await answered).toEqual(E.right(undefined));
  });

  it("an answered request does not fail later", async () => {
    vi.useFakeTimers();
    const { changes } = setup();
    const results: unknown[] = [];
    void changes
      .request(hgtv)()
      .then((result) => results.push(result));

    changes.settle({ channel: hgtv })();
    await vi.advanceTimersByTimeAsync(CHANNEL_CHANGE_TIMEOUT_MS);

    expect(results).toEqual([E.right(undefined)]);
  });
});
