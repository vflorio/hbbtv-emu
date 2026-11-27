import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import { EMULATOR_DEVICE } from "@hbb-emu/oipf-api";
import { describe, expect, it } from "vitest";
import { isUiNotification, isUiRequest, isUiResponse } from "./ui";

const state = { ...DEFAULT_EXTENSION_STATE, device: EMULATOR_DEVICE };

describe("UI messages", () => {
  it.each<[unknown, boolean]>([
    [{ _tag: "UI/GetState" }, true],
    [{ _tag: "UI/SaveState", state }, true],
    [{ _tag: "UI/SaveState", state: { userAgent: "x" } }, false],
    // A state from before device profiles: the device is what the background stores.
    [{ _tag: "UI/SaveState", state: DEFAULT_EXTENSION_STATE }, false],
    [{ _tag: "UI/DispatchKey", keyCode: 403 }, true],
    [{ _tag: "UI/DispatchKey", keyCode: "red" }, false],
    [{ _tag: "UI/PlayChannel", channel: state.channels[0] }, true],
    [{ _tag: "UI/TurnOnTv", channelId: "channel-1" }, true],
    [{ _tag: "UI/TurnOnTv", channel: state.channels[0] }, false],
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
