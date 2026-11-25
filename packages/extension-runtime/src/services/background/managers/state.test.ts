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

  /**
   * KNOWN BUG — `enabledTabIds` is a Set, and chrome.storage serializes to JSON:
   * after a reload (e.g. the MV3 service worker restarts) it comes back as `{}`
   * and the next update that spreads it throws.
   * Fix with the Scenario/TvSession split (ROADMAP D5) + io-ts codecs.
   * `it.fails` turns red once the bug is fixed: then switch it to `it`.
   */
  it.fails("keeps working after the state survives a storage round-trip", async () => {
    const storage = createFakeStorage<ExtensionState>();
    const first = await initialized(storage);
    await first.manager.updateState((s) => ({ ...s, enabledTabIds: new Set([1]) }))();

    const afterRestart = await initialized(storage);
    await afterRestart.manager.updateState((s) => ({ ...s, enabledTabIds: new Set([...s.enabledTabIds, 2]) }))();

    expect([...getStateOrThrow(afterRestart.manager).enabledTabIds]).toEqual([1, 2]);
  });
});
