import { OIPF } from "@hbb-emu/oipf-api";
import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/state";
import { describe, expect, it } from "vitest";
import { toBroadcastChannel } from "./broadcastChannel";

const channel = { ...DEFAULT_EXTENSION_STATE.channels[0]!, id: "dmax", name: "DMAX", onid: 318, tsid: 5, sid: 52 };

describe("toBroadcastChannel", () => {
  it("keeps the DVB triplet, the name, and uses the channel id as ccid", () => {
    expect(toBroadcastChannel(channel)).toMatchObject({ onid: 318, tsid: 5, sid: 52, name: "DMAX", ccid: "dmax" });
  });

  it("is a DVB-T TV service with the OIPF constant values", () => {
    const mapped = toBroadcastChannel(channel);

    expect(mapped.idType).toBe(OIPF.DAE.Broadcast.ChannelIdType.ID_DVB_T);
    expect(mapped.idType).toBe(12);
    expect(mapped.channelType).toBe(0);
  });
});
