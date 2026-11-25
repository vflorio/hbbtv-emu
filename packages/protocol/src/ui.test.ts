import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import { describe, expect, it } from "vitest";
import { isUiNotification, isUiRequest, isUiResponse } from "./ui";

const state = DEFAULT_EXTENSION_STATE;

describe("UI messages", () => {
  it.each<[unknown, boolean]>([
    [{ _tag: "UI/GetState" }, true],
    [{ _tag: "UI/SaveState", state }, true],
    [{ _tag: "UI/SaveState", state: { userAgent: "x" } }, false],
    [{ _tag: "UI/DispatchKey", keyCode: 403 }, true],
    [{ _tag: "UI/DispatchKey", keyCode: "red" }, false],
    [{ _tag: "UI/PlayChannel", channel: state.channels[0] }, true],
    [{ _tag: "Page/Ready", url: "x" }, false],
  ])("isUiRequest(%j) → %s", (value, expected) => {
    expect(isUiRequest(value)).toBe(expected);
  });

  it.each<[unknown, boolean]>([
    [{ _tag: "UI/State", state }, true],
    [{ _tag: "UI/Done" }, true],
    [{ _tag: "UI/Failed", reason: "no tab" }, true],
    [{ _tag: "UI/Failed" }, false],
    [undefined, false],
  ])("isUiResponse(%j) → %s", (value, expected) => {
    expect(isUiResponse(value)).toBe(expected);
  });

  it("recognises state notifications only", () => {
    expect(isUiNotification({ _tag: "UI/StateChanged", state })).toBe(true);
    expect(isUiNotification({ _tag: "UI/State", state })).toBe(false);
  });
});
