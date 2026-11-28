import { type DeviceProfile, EMULATOR_DEVICE } from "@hbb-emu/oipf-api";
import { DEFAULT_EXTENSION_STATE, type ExtensionState } from "@hbb-emu/state";

/**
 * What the UI edits: the background's snapshot (`UiState` of `@hbb-emu/protocol`). The
 * TV the emulator is, `device`, is the source of `userAgent`, which only shows the header
 * that device sends.
 */
export type SettingsState = ExtensionState & Readonly<{ device: DeviceProfile }>;

export const DEFAULT_SETTINGS_STATE: SettingsState = { ...DEFAULT_EXTENSION_STATE, device: EMULATOR_DEVICE };
