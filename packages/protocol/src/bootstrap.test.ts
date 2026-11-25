import type { ChannelConfig } from "@hbb-emu/extension-common";
import * as O from "fp-ts/Option";
import { describe, expect, it } from "vitest";
import {
  type BootstrapData,
  configBootstrapScript,
  initialChannel,
  receiveBootstrap,
  tunedChannelId,
} from "./bootstrap";

const dmax: ChannelConfig = { id: "dmax", name: "DMAX", mp4Source: "http://tv/dmax.mp4", onid: 318, tsid: 1, sid: 52 };
const hgtv: ChannelConfig = { ...dmax, id: "hgtv", name: "HGTV", sid: 56 };

const data: BootstrapData = {
  config: { userAgent: 'Custom TV/1.0 "quoted" </script>', channels: [dmax] },
  tunings: [{ url: "http://app.example/", channelId: "dmax" }],
};

const HBBTV = { contentType: "application/xhtml+xml" };

/** Runs the injected code as the host would in a page with this document. */
const runBootstrap = (scope: object, code: string, document: { contentType: string } = HBBTV) =>
  new Function("globalThis", "document", code)(scope, document);

describe("configuration bootstrap", () => {
  it("bootstrap first: the runtime finds the data when it starts", () => {
    const scope = {};
    runBootstrap(scope, configBootstrapScript(data));
    const late: BootstrapData[] = [];

    expect(receiveBootstrap(scope, (d) => late.push(d))()).toEqual(O.some(data));
    expect(late).toEqual([]);
  });

  it("runtime first (Chromium's order): the runtime is notified when the bootstrap runs", () => {
    const scope = {};
    const late: BootstrapData[] = [];

    expect(receiveBootstrap(scope, (d) => late.push(d))()).toEqual(O.none);
    runBootstrap(scope, configBootstrapScript(data));

    expect(late).toEqual([data]);
  });

  it("leaves nothing enumerable on the page's global object", () => {
    const scope = {};
    receiveBootstrap(scope, () => {})();
    runBootstrap(scope, configBootstrapScript(data));

    expect(Object.keys(scope)).toEqual([]);
  });

  it("gives nothing to documents that are not HbbTV (some hosts run it in every page)", () => {
    const scope = {};
    runBootstrap(scope, configBootstrapScript(data), { contentType: "text/html" });

    expect(receiveBootstrap(scope, () => {})()).toEqual(O.none);
  });

  it("ignores a value that is not bootstrap data", () => {
    const scope = {};
    const late: BootstrapData[] = [];
    receiveBootstrap(scope, (d) => late.push(d))();

    runBootstrap(scope, 'globalThis[Symbol.for("hbb-emu.config")] = { nope: true };');
    runBootstrap(scope, `globalThis[Symbol.for("hbb-emu.config")] = ${JSON.stringify(data.config)};`);

    expect(late).toEqual([]);
  });
});

describe("tunedChannelId", () => {
  it("is the channel of the TV showing the page, fragment aside", () => {
    expect(
      tunedChannelId([{ url: "http://app.example/a.html", channelId: "hgtv" }], "http://app.example/a.html#x"),
    ).toBe("hgtv");
  });

  it("is null for a page no TV shows, or that TVs on different channels show", () => {
    const tunings = [
      { url: "http://app.example/", channelId: "dmax" },
      { url: "http://app.example/", channelId: "hgtv" },
      { url: "http://other.example/", channelId: "dmax" },
      { url: "http://other.example/", channelId: "dmax" },
    ];

    expect(tunedChannelId(tunings, "http://app.example/")).toBeNull();
    expect(tunedChannelId(tunings, "http://other.example/")).toBe("dmax");
    expect(tunedChannelId(tunings, "http://nowhere.example/")).toBeNull();
    expect(tunedChannelId(tunings, "not a url")).toBeNull();
  });
});

describe("initialChannel", () => {
  const url = "http://app.example/index.html";
  const signalledByHgtv: ChannelConfig = {
    ...hgtv,
    ait: { applications: [{ orgId: 1, appId: 1, controlCode: "AUTOSTART", url }] },
  };
  const config = { userAgent: "TV", channels: [dmax, signalledByHgtv] };

  it("is the channel of the TV showing the page, before what the AIT says", () => {
    expect(initialChannel({ config, tunings: [{ url, channelId: "dmax" }] }, url)).toBe(dmax);
  });

  it("is the channel whose AIT signals the page when no TV shows it", () => {
    expect(initialChannel({ config, tunings: [] }, url)).toBe(signalledByHgtv);
  });

  it("is the first of the lineup otherwise, also when the tuned channel left the lineup", () => {
    expect(
      initialChannel({ config, tunings: [{ url: "http://x.example/", channelId: "gone" }] }, "http://x.example/"),
    ).toBe(dmax);
    expect(initialChannel({ config: { ...config, channels: [] }, tunings: [] }, url)).toBeNull();
  });
});
