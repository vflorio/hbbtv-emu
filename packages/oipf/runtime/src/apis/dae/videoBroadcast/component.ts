/**
 * video/broadcast — components (video, audio and subtitle tracks)
 *
 * OIPF DAE component extensions to video/broadcast: `COMPONENT_TYPE_*`,
 * `getComponents()`, `getCurrentActiveComponents()`, `selectComponent()`,
 * `unselectComponent()`. Not implemented yet: the methods answer "not known"
 * (`undefined`) or do nothing. The settings UI's component state is kept, so it
 * reads back as it was written.
 *
 * Reader-style module (ROADMAP D1): the state lives in an injected `IORef`.
 */

import { createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type IORef, newIORef } from "fp-ts/IORef";
import type * as R from "fp-ts/Reader";
import type * as RIO from "fp-ts/ReaderIO";

const logger = createLogger("VideoBroadcast:Component");

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

export type ComponentState = Readonly<{
  components: ReadonlyArray<unknown>;
  selectedComponents: Readonly<Record<string, unknown>>;
}>;

export type ComponentEnv = Readonly<{
  componentState: IORef<ComponentState>;
}>;

export const createComponentEnv: IO.IO<ComponentEnv> = pipe(
  newIORef<ComponentState>({ components: [], selectedComponents: {} }),
  IO.map((componentState) => ({ componentState })),
);

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

export const readComponentState: RIO.ReaderIO<ComponentEnv, ComponentState> = ({ componentState }) =>
  componentState.read;

/** External state (settings UI, scenario): the object keeps its own copy. */
export const applyComponentState =
  (patch: Partial<ComponentState>): RIO.ReaderIO<ComponentEnv, void> =>
  ({ componentState }) =>
    componentState.modify((state) => ({
      components: patch.components ? [...patch.components] : state.components,
      selectedComponents: patch.selectedComponents ? { ...patch.selectedComponents } : state.selectedComponents,
    }));

// ─────────────────────────────────────────────────────────────────────────────
// OIPF surface
// ─────────────────────────────────────────────────────────────────────────────

export type ComponentApi = Pick<
  OIPF.DAE.Broadcast.VideoBroadcast,
  | "COMPONENT_TYPE_VIDEO"
  | "COMPONENT_TYPE_AUDIO"
  | "COMPONENT_TYPE_SUBTITLE"
  | "onSelectedComponentChanged"
  | "onComponentChanged"
  | "getComponents"
  | "getCurrentActiveComponents"
  | "selectComponent"
  | "unselectComponent"
>;

export const componentApi: R.Reader<ComponentEnv, ComponentApi> = () => ({
  COMPONENT_TYPE_VIDEO: 0,
  COMPONENT_TYPE_AUDIO: 1,
  COMPONENT_TYPE_SUBTITLE: 2,
  onSelectedComponentChanged: null,
  onComponentChanged: null,
  getComponents: () => {
    logger.debug("getComponents")();
    return undefined;
  },
  getCurrentActiveComponents: () => {
    logger.debug("getCurrentActiveComponents")();
    return undefined;
  },
  selectComponent: () => {
    logger.debug("selectComponent")();
  },
  unselectComponent: () => {
    logger.debug("unselectComponent")();
  },
});
