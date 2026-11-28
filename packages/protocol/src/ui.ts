/**
 * Messages between the settings UI (side panel) and the background.
 *
 * The UI works on a whole-state snapshot (`UiState`); the background turns saves into
 * configuration updates for every page and minimal object-state patches for the TV the
 * user is looking at (ROADMAP D5), so the UI never overwrites what applications did.
 */

import { type DeviceProfile, DeviceProfileCodec } from "@hbb-emu/oipf-api";
import type { ChannelConfig, ExtensionState } from "@hbb-emu/state";

/**
 * The snapshot the settings UI edits (legacy shape, until the Scenario/TvSession split),
 * with the TV the emulator is. `userAgent` is the header that device sends: the UI shows
 * it, and changes it through `device`.
 */
export type UiState = ExtensionState & Readonly<{ device: DeviceProfile }>;

export type UiRequest =
  | Readonly<{ _tag: "UI/GetState" }>
  | Readonly<{ _tag: "UI/SaveState"; state: UiState }>
  | Readonly<{ _tag: "UI/DispatchKey"; keyCode: number }>
  | Readonly<{ _tag: "UI/PlayChannel"; channel: ChannelConfig }>
  /** A new TV (a new tab, in TV mode) on this channel of the lineup. */
  | Readonly<{ _tag: "UI/TurnOnTv"; channelId: string }>;

export type UiResponse =
  | Readonly<{ _tag: "UI/State"; state: UiState }>
  | Readonly<{ _tag: "UI/Done" }>
  | Readonly<{ _tag: "UI/Failed"; reason: string }>;

/** Pushed by the background to every open UI when the state changes. */
export type UiNotification = Readonly<{ _tag: "UI/StateChanged"; state: UiState }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isUiState = (value: unknown): value is UiState =>
  isRecord(value) &&
  typeof value.userAgent === "string" &&
  DeviceProfileCodec.is(value.device) &&
  Array.isArray(value.channels) &&
  isRecord(value.hbbtv);

export const isUiRequest = (value: unknown): value is UiRequest => {
  if (!isRecord(value)) return false;
  switch (value._tag) {
    case "UI/GetState":
      return true;
    case "UI/SaveState":
      return isUiState(value.state);
    case "UI/DispatchKey":
      return typeof value.keyCode === "number" && Number.isInteger(value.keyCode);
    case "UI/PlayChannel":
      return isRecord(value.channel) && typeof value.channel.id === "string";
    case "UI/TurnOnTv":
      return typeof value.channelId === "string";
    default:
      return false;
  }
};

export const isUiResponse = (value: unknown): value is UiResponse => {
  if (!isRecord(value)) return false;
  switch (value._tag) {
    case "UI/State":
      return isUiState(value.state);
    case "UI/Done":
      return true;
    case "UI/Failed":
      return typeof value.reason === "string";
    default:
      return false;
  }
};

export const isUiNotification = (value: unknown): value is UiNotification =>
  isRecord(value) && value._tag === "UI/StateChanged" && isUiState(value.state);
