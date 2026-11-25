import type { OIPF } from "@hbb-emu/oipf-api";
import { describe, expect, it } from "vitest";
import { applyProgrammes, createMiscEnv, miscApi } from "./misc";

describe("data and programmes", () => {
  it("data is always the empty string, and setting it has no effect", () => {
    const api = miscApi(createMiscEnv());

    api.data = "dvb://1.2.3";

    expect(api.data).toBe("");
  });

  it("programmes is the collection the settings UI provides, read live", () => {
    const env = createMiscEnv();
    const api = miscApi(env);
    const now = { name: "News at six" } as OIPF.DAE.Broadcast.Programme;

    expect(api.programmes.length).toBe(0);
    applyProgrammes([now])(env)();

    expect(api.programmes.length).toBe(1);
    expect(api.programmes.item(0)).toBe(now);
  });
});
