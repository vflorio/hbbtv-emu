import type { ChannelConfig } from "@hbb-emu/extension-common";
import { EMULATOR_DEVICE, EMULATOR_TERMINAL, emulatorUserAgent } from "@hbb-emu/oipf-api";
import * as E from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { createFakeStorage } from "../../../__tests__/fakes";
import { DEFAULT_STATE, type ExtensionState, userAgentOf } from "../../../state";
import { StateManager } from "./state";

const getStateOrThrow = (manager: StateManager): ExtensionState => {
  const result = manager.getState()();
  if (E.isLeft(result)) throw new Error(`expected state, got ${result.left._tag}`);
  return result.right;
};

const initialized = async (storage = createFakeStorage<ExtensionState>()) => {
  const manager = new StateManager({ storage: storage.storage });
  const result = await manager.init()();
  expect(E.isRight(result)).toBe(true);
  return { manager, storage };
};

describe("StateManager", () => {
  it("fails with StateNotInitialized before init()", () => {
    const manager = new StateManager({ storage: createFakeStorage<ExtensionState>().storage });

    expect(manager.getState()()).toEqual(E.left({ _tag: "StateNotInitialized" }));
  });

  it("starts from DEFAULT_STATE when storage is empty", async () => {
    const { manager } = await initialized();

    expect(getStateOrThrow(manager).common).toEqual(DEFAULT_STATE.common);
    expect(getStateOrThrow(manager).version).toBe(DEFAULT_STATE.version);
  });

  it("starts from the persisted state when there is one", async () => {
    const persisted = { ...DEFAULT_STATE, common: { autoInjectHbbTV: false, playerUiVisible: true } };
    const { manager } = await initialized(createFakeStorage<ExtensionState>(persisted));

    expect(getStateOrThrow(manager).common).toEqual({ autoInjectHbbTV: false, playerUiVisible: true });
  });

  it("moves the channels still on the DASH-IF live simulator, the old default, to the shipped test card", async () => {
    const [first, second] = DEFAULT_STATE.runtime.channels as [ChannelConfig, ChannelConfig];
    const channels = [
      { ...first, mp4Source: "https://livesim2.dashif.org/livesim2/testpic_2s/Manifest.mpd" },
      { ...second, mp4Source: "https://cdn.example/own.mpd" },
    ];
    const persisted = { ...DEFAULT_STATE, runtime: { ...DEFAULT_STATE.runtime, channels } };
    const { manager } = await initialized(createFakeStorage<ExtensionState>(persisted));

    expect(getStateOrThrow(manager).runtime.channels.map((channel) => channel.mp4Source)).toEqual([
      "hbbtv-emu:broadcast/test-card.mp4",
      "https://cdn.example/own.mpd",
    ]);
  });

  it("propagates storage read errors from init()", async () => {
    const storage = createFakeStorage<ExtensionState>();
    storage.failNextWith({ _tag: "StorageReadError", cause: "boom" });
    const manager = new StateManager({ storage: storage.storage });

    const result = await manager.init()();

    expect(result).toEqual(E.left({ _tag: "StorageReadError", cause: "boom" }));
  });

  it("updateState() applies the change, bumps lastUpdated and persists it", async () => {
    const { manager, storage } = await initialized();
    const before = getStateOrThrow(manager).lastUpdated;

    await new Promise((resolve) => setTimeout(resolve, 2));
    await manager.updateState((s) => ({ ...s, common: { ...s.common, playerUiVisible: true } }))();

    const after = getStateOrThrow(manager);
    expect(after.common.playerUiVisible).toBe(true);
    expect(after.lastUpdated).toBeGreaterThan(before);
    expect(storage.stored()?.common.playerUiVisible).toBe(true);
  });

  it("destroy() drops the in-memory state", async () => {
    const { manager } = await initialized();

    manager.destroy()();

    expect(E.isLeft(manager.getState()())).toBe(true);
  });

  it("keeps working after the state survives a storage round-trip (service-worker restart)", async () => {
    const storage = createFakeStorage<ExtensionState>();
    const first = await initialized(storage);
    await first.manager.updateState((s) => ({ ...s, common: { ...s.common, playerUiVisible: true } }))();

    const afterRestart = await initialized(storage);
    const device = { terminal: { ...EMULATOR_TERMINAL, vendorName: "Custom" }, userAgent: "Custom TV/1.0" };
    await afterRestart.manager.updateState((s) => ({ ...s, runtime: { ...s.runtime, device } }))();

    const state = getStateOrThrow(afterRestart.manager);
    expect(state.common.playerUiVisible).toBe(true);
    expect(state.runtime.device).toEqual(device);
  });

  it("loads a state stored by an older version, dropping enabledTabIds (a Set stored as {})", async () => {
    const legacy = { ...DEFAULT_STATE, enabledTabIds: {} } as unknown as ExtensionState;
    const storage = createFakeStorage<ExtensionState>(legacy);
    const { manager } = await initialized(storage);

    await manager.updateState((s) => ({ ...s, common: { ...s.common, playerUiVisible: true } }))();

    expect("enabledTabIds" in getStateOrThrow(manager)).toBe(false);
    expect(storage.stored()).not.toHaveProperty("enabledTabIds");
  });

  it("drops the single current channel older versions stored (it belongs to each tab's session)", async () => {
    const legacy = {
      ...DEFAULT_STATE,
      runtime: { ...DEFAULT_STATE.runtime, currentChannel: DEFAULT_STATE.runtime.channels[0] },
    } as unknown as ExtensionState;
    const storage = createFakeStorage<ExtensionState>(legacy);
    const { manager } = await initialized(storage);

    await manager.updateState((s) => ({ ...s, common: { ...s.common, playerUiVisible: true } }))();

    expect("currentChannel" in getStateOrThrow(manager).runtime).toBe(false);
    expect(storage.stored()?.runtime).not.toHaveProperty("currentChannel");
  });

  describe("a state from before device profiles (only a user agent)", () => {
    /** The runtime part older versions stored: `userAgent`, no `device`. */
    const legacyWith = (userAgent: string, hbbtvVersion = "2.0.1") => {
      const { device: _none, ...runtime } = DEFAULT_STATE.runtime;
      const api = { ...runtime.api, oipfCapabilities: { ...runtime.api.oipfCapabilities, hbbtvVersion } };
      return { ...DEFAULT_STATE, runtime: { ...runtime, api, userAgent } } as unknown as ExtensionState;
    };

    it("is the emulator, at the HbbTV version of its Capabilities object", async () => {
      const storage = createFakeStorage<ExtensionState>(legacyWith(emulatorUserAgent("2.0.4"), "2.0.4"));
      const { manager } = await initialized(storage);
      await manager.updateState((s) => s)();

      expect(getStateOrThrow(manager).runtime.device).toEqual({
        terminal: { ...EMULATOR_TERMINAL, hbbtvVersion: "2.0.4" },
      });
      expect(storage.stored()?.runtime).not.toHaveProperty("userAgent");
    });

    it("keeps the user agent it had, when it is not the one the emulator gives", async () => {
      const userAgent =
        "Mozilla/5.0 (SmartTV; HbbTV/1.5.1 (+DL;Vendor/ModelName;0.0.1;0.0.1;) CE-HTML/1.0 HBBTV-EMU/0.1";
      const { manager } = await initialized(createFakeStorage<ExtensionState>(legacyWith(userAgent)));

      const state = getStateOrThrow(manager);
      expect(state.runtime.device).toEqual({ terminal: EMULATOR_TERMINAL, userAgent });
      expect(userAgentOf(state)).toBe(userAgent);
    });

    it("an HbbTV version the emulator does not know is its own", async () => {
      const { manager } = await initialized(createFakeStorage<ExtensionState>(legacyWith("", "9.9")));

      expect(getStateOrThrow(manager).runtime.device).toEqual(EMULATOR_DEVICE);
    });
  });
});
