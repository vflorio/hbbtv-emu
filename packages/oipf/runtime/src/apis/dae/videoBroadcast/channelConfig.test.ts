import type { ChannelConfig } from "@hbb-emu/extension-common";
import type { OIPF } from "@hbb-emu/oipf-api";
import * as O from "fp-ts/Option";
import { describe, expect, it } from "vitest";
import { toBroadcastChannel } from "../../../subsystems";
import { createChannelConfig, createChannelList, neighbourChannel } from "./channelConfig";

const config = (id: string, sid: number): ChannelConfig => ({
  id,
  name: id.toUpperCase(),
  mp4Source: `http://tv/${id}.mp4`,
  onid: 318,
  tsid: 1,
  sid,
});
const channel = (id: string, sid: number) => toBroadcastChannel(config(id, sid)) as OIPF.DAE.Broadcast.Channel;

const dmax = channel("dmax", 52);
const hgtv = channel("hgtv", 56);
const news = channel("news", 60);
const lineup = [dmax, hgtv, news];

describe("createChannelList", () => {
  it("is a collection: length, item() and index access, in the lineup's order", () => {
    const list = createChannelList(lineup);

    expect(list.length).toBe(3);
    expect(list.item(1)).toBe(hgtv);
    expect(list[2]).toBe(news);
    expect(list.item(3)).toBeUndefined();
  });

  it("finds a channel by ccid and by DVB triplet, null when there is none", () => {
    const list = createChannelList(lineup);

    expect(list.getChannel("news")).toBe(news);
    expect(list.getChannelByTriplet(318, 1, 56)).toBe(hgtv);
    expect(list.getChannel("missing")).toBeNull();
    expect(list.getChannelByTriplet(1, 2, 3)).toBeNull();
  });
});

describe("createChannelConfig", () => {
  it("exposes the lineup as channelList", () => {
    expect(createChannelConfig(lineup).channelList.item(0)).toBe(dmax);
  });
});

describe("neighbourChannel", () => {
  it("goes forward and back, cycling at both ends", () => {
    expect(neighbourChannel(lineup, dmax, 1)).toEqual(O.some(hgtv));
    expect(neighbourChannel(lineup, news, 1)).toEqual(O.some(dmax));
    expect(neighbourChannel(lineup, hgtv, -1)).toEqual(O.some(dmax));
    expect(neighbourChannel(lineup, dmax, -1)).toEqual(O.some(news));
  });

  it("recognises the current channel by its service, not by identity", () => {
    expect(neighbourChannel(lineup, channel("hgtv", 56), 1)).toEqual(O.some(news));
  });

  it("from outside the lineup, gives the first one forward and the last one back", () => {
    const other = channel("other", 99);

    expect(neighbourChannel(lineup, other, 1)).toEqual(O.some(dmax));
    expect(neighbourChannel(lineup, null, -1)).toEqual(O.some(news));
  });

  it("with a single channel, stays on it; with none, gives nothing", () => {
    expect(neighbourChannel([dmax], dmax, 1)).toEqual(O.some(dmax));
    expect(neighbourChannel([], dmax, 1)).toEqual(O.none);
  });
});
