import type { PageMessage } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { createHostApplicationLaunches } from "./applicationLaunch";

describe("createHostApplicationLaunches", () => {
  it("asks the host to start the application, and fails with the host's reason", async () => {
    const sent: PageMessage[] = [];
    const launches = createHostApplicationLaunches((message) => () => sent.push(message));

    const result = launches.launch("dvb://current.ait/a.1")();
    launches.fail("dvb://current.ait/a.1", "not signalled")();

    expect(sent).toEqual([{ _tag: "Page/CreateApplication", url: "dvb://current.ait/a.1" }]);
    expect(await result).toEqual(E.left("not signalled"));
  });

  it("fails only the launches of that URL: the others wait for their page", async () => {
    const launches = createHostApplicationLaunches(() => () => undefined);
    const settled: string[] = [];

    void launches
      .launch("http://a.example/")()
      .then(() => settled.push("a"));
    void launches
      .launch("http://b.example/")()
      .then(() => settled.push("b"));
    launches.fail("http://a.example/", "HTTP 404")();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(settled).toEqual(["a"]);
  });
});
