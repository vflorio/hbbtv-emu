/**
 * oipfObjectFactory (OIPF DAE §7.1)
 *
 * "The OITF shall support a globally accessible object of type OipfObjectFactory as
 * a static property oipfObjectFactory of the Window interface."
 *
 * Reader-style module (ROADMAP D1). Rules:
 * - `isObjectSupported(mimeType)` is true if and only if the runtime binds objects of
 *   that type (the bindings' own predicates decide, so it cannot drift from them);
 * - a `create…()` method returns an `<object>` of that type, already bound: it works
 *   before (or without) the application inserting it into the document, and
 *   inserting it binds nothing more. For a supported type it never fails (§7.1.1);
 * - only the objects the emulator implements have a `create…()` method. Calling a
 *   missing one throws a `TypeError`, as the spec requires for an unsupported method
 *   name, and an application that checks for the method sees it is not there;
 * - `createChannelConfig()` gives the lineup, as video/broadcast `getChannelConfig()`.
 */

import { createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as R from "fp-ts/Reader";
import type * as RIO from "fp-ts/ReaderIO";
import { type ChannelRegistryEnv, toBroadcastChannel } from "../../subsystems";
import { createChannelConfig } from "./videoBroadcast/channelConfig";

const logger = createLogger("OipfObjectFactory");

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

export type ObjectFactoryEnv = Readonly<{
  document: Document;
  /** Whether the runtime binds this `<object>` (its bindings' predicates). */
  isBindable: (element: HTMLObjectElement) => boolean;
  /** Binds the `<object>` now, in the document or not. */
  bindElement: (element: HTMLObjectElement) => IO.IO<boolean>;
  channelRegistry: ChannelRegistryEnv;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

const objectOfType =
  (mimeType: string): RIO.ReaderIO<ObjectFactoryEnv, HTMLObjectElement> =>
  ({ document }) =>
  () => {
    const element = document.createElement("object");
    element.type = mimeType;
    return element;
  };

export const isObjectSupported =
  (mimeType: string): RIO.ReaderIO<ObjectFactoryEnv, boolean> =>
  (env) =>
    pipe(objectOfType(mimeType)(env), IO.map(env.isBindable));

/** A bound `<object>` of that type. */
export const createObject =
  (mimeType: string): RIO.ReaderIO<ObjectFactoryEnv, HTMLObjectElement> =>
  (env) =>
    pipe(
      logger.debug("create", mimeType),
      IO.flatMap(() => objectOfType(mimeType)(env)),
      IO.tap(env.bindElement),
    );

export const createLineupConfig: RIO.ReaderIO<ObjectFactoryEnv, OIPF.DAE.Broadcast.ChannelConfig> =
  ({ channelRegistry }) =>
  () =>
    createChannelConfig(
      // The OIPF Channel object has more members (methods, …) than the emulator fills in.
      channelRegistry
        .getChannels()
        .map((config) => toBroadcastChannel(config) as OIPF.DAE.Broadcast.Channel),
    );

// ─────────────────────────────────────────────────────────────────────────────
// OIPF surface
// ─────────────────────────────────────────────────────────────────────────────

/** The factory's methods for the objects the emulator implements. */
export type ObjectFactory = Pick<
  OIPF.DAE.ObjectFactory.OipfObjectFactory,
  | "isObjectSupported"
  | "createVideoBroadcastObject"
  | "createApplicationManagerObject"
  | "createCapabilitiesObject"
  | "createConfigurationObject"
  | "createChannelConfig"
>;

export const objectFactory: R.Reader<ObjectFactoryEnv, ObjectFactory> = (env) => ({
  isObjectSupported: (mimeType) => isObjectSupported(mimeType)(env)(),
  // Required capabilities aside, the emulator can always present: it never returns null.
  createVideoBroadcastObject: () => createObject(OIPF.DAE.Broadcast.MIME_TYPE)(env)(),
  createApplicationManagerObject: () => createObject(OIPF.DAE.ApplicationManager.MIME_TYPE)(env)(),
  createCapabilitiesObject: () => createObject(OIPF.DAE.Capabilities.MIME_TYPE)(env)(),
  createConfigurationObject: () => createObject(OIPF.DAE.Configuration.MIME_TYPE)(env)(),
  createChannelConfig: () => createLineupConfig(env)(),
});

export const OBJECT_FACTORY_KEY = "oipfObjectFactory";

/** Makes the factory `window.oipfObjectFactory`. Returns the effect that removes it. */
export const installObjectFactory =
  (window: Window): RIO.ReaderIO<ObjectFactoryEnv, IO.IO<void>> =>
  (env) =>
  () => {
    Object.defineProperty(window, OBJECT_FACTORY_KEY, {
      value: objectFactory(env),
      writable: false,
      configurable: true,
    });
    return () => {
      Reflect.deleteProperty(window, OBJECT_FACTORY_KEY);
    };
  };
