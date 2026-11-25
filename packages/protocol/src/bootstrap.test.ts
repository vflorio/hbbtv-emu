import * as O from "fp-ts/Option";
import { describe, expect, it } from "vitest";
import { configBootstrapScript, receiveBootstrapConfig } from "./bootstrap";
import type { PageConfig } from "./messages";

const config: PageConfig = {
  userAgent: 'Custom TV/1.0 "quoted" </script>',
  channels: [{ id: "dmax", name: "DMAX", mp4Source: "http://tv/dmax.mp4", onid: 318, tsid: 1, sid: 52 }],
};

/** Runs the injected code against a given global object, as the host would in the page. */
const runBootstrap = (scope: object, code: string) => new Function("globalThis", code)(scope);

describe("configuration bootstrap", () => {
  it("bootstrap first: the runtime finds the configuration when it starts", () => {
    const scope = {};
    runBootstrap(scope, configBootstrapScript(config));
    const late: PageConfig[] = [];

    expect(receiveBootstrapConfig(scope, (c) => late.push(c))()).toEqual(O.some(config));
    expect(late).toEqual([]);
  });

  it("runtime first (Chromium's order): the runtime is notified when the bootstrap runs", () => {
    const scope = {};
    const late: PageConfig[] = [];

    expect(receiveBootstrapConfig(scope, (c) => late.push(c))()).toEqual(O.none);
    runBootstrap(scope, configBootstrapScript(config));

    expect(late).toEqual([config]);
  });

  it("leaves nothing enumerable on the page's global object", () => {
    const scope = {};
    receiveBootstrapConfig(scope, () => {})();
    runBootstrap(scope, configBootstrapScript(config));

    expect(Object.keys(scope)).toEqual([]);
  });

  it("ignores a value that is not a configuration", () => {
    const scope = {};
    const late: PageConfig[] = [];
    receiveBootstrapConfig(scope, (c) => late.push(c))();

    runBootstrap(scope, 'globalThis[Symbol.for("hbb-emu.config")] = { nope: true };');

    expect(late).toEqual([]);
  });
});
