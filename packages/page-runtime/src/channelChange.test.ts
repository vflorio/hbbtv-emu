import type { ChannelConfig } from "@hbb-emu/extension-common";
import type { PageMessage } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { createHostChannelChanges } from "./channelChange";

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
