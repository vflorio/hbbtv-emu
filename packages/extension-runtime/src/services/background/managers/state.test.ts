import * as E from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { createFakeStorage } from "../../../__tests__/fakes";
import { DEFAULT_STATE, type ExtensionState } from "../../../state";
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
    await afterRestart.manager.updateState((s) => ({ ...s, runtime: { ...s.runtime, userAgent: "Custom TV/1.0" } }))();

    const state = getStateOrThrow(afterRestart.manager);
    expect(state.common.playerUiVisible).toBe(true);
    expect(state.runtime.userAgent).toBe("Custom TV/1.0");
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
});
