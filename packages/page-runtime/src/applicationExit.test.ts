import type { PageMessage } from "@hbb-emu/protocol";
import { describe, expect, it } from "vitest";
import { createHostApplicationExit } from "./applicationExit";

describe("createHostApplicationExit", () => {
  it("tells the host that the application exits", () => {
    const sent: PageMessage[] = [];
    const exit = createHostApplicationExit((message) => () => sent.push(message));

    exit();

    expect(sent).toEqual([{ _tag: "Page/DestroyApplication" }]);
  });

  it("tells it once: the application exits once, however many times it asks", () => {
    const sent: PageMessage[] = [];
    const exit = createHostApplicationExit((message) => () => sent.push(message));

    exit();
    exit();

    expect(sent).toHaveLength(1);
  });
});
