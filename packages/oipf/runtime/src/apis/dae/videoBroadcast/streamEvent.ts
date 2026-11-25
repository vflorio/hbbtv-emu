/**
 * video/broadcast — stream events
 *
 * OIPF DAE (DSM-CC stream events on video/broadcast), as HbbTV uses them:
 * `addStreamEventListener()` and `removeStreamEventListener()`. The events themselves come from the page's stream
 * event scheduler, which knows the channel and the schedule.
 *
 * Reader-style module (ROADMAP D1): the object's subscriptions live in an injected
 * `IORef`.
 * - the same listener can be added more than once; each addition is a subscription;
 * - removing takes away one subscription with that URL, name and listener.
 */

import { createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type IORef, newIORef } from "fp-ts/IORef";
import type * as R from "fp-ts/Reader";
import * as RIO from "fp-ts/ReaderIO";
import type { StreamEventSchedulerApi } from "../../../subsystems";

const logger = createLogger("VideoBroadcast:StreamEvent");

type Listener = OIPF.DAE.Broadcast.StreamEventListener;

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

type Subscription = Readonly<{
  targetURL: string;
  eventName: string;
  listener: Listener;
  unsubscribe: IO.IO<void>;
}>;

/** A subscription as the settings UI sees it. */
export type StreamEventListenerState = Readonly<{ targetURL: string; eventName: string }>;

export type StreamEventEnv = Readonly<{
  scheduler: Pick<StreamEventSchedulerApi, "addListener">;
  subscriptions: IORef<ReadonlyArray<Subscription>>;
}>;

export const createStreamEventEnv = (scheduler: StreamEventEnv["scheduler"]): IO.IO<StreamEventEnv> =>
  pipe(
    newIORef<ReadonlyArray<Subscription>>([]),
    IO.map((subscriptions) => ({ scheduler, subscriptions })),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

export const addStreamEventListener =
  (targetURL: string, eventName: string, listener: Listener): RIO.ReaderIO<StreamEventEnv, void> =>
  ({ scheduler, subscriptions }) =>
    pipe(
      logger.debug("addStreamEventListener", targetURL, eventName),
      IO.flatMap(() => scheduler.addListener(targetURL, eventName, listener)),
      IO.flatMap(({ unsubscribe }) =>
        subscriptions.modify((list) => [...list, { targetURL, eventName, listener, unsubscribe }]),
      ),
    );

export const removeStreamEventListener =
  (targetURL: string, eventName: string, listener: Listener): RIO.ReaderIO<StreamEventEnv, void> =>
  ({ subscriptions }) =>
    pipe(
      logger.debug("removeStreamEventListener", targetURL, eventName),
      IO.flatMap(() => subscriptions.read),
      IO.flatMap((list) => {
        const index = list.findIndex(
          (s) => s.targetURL === targetURL && s.eventName === eventName && s.listener === listener,
        );
        const found = list[index];
        return found === undefined
          ? IO.of(undefined)
          : pipe(
              found.unsubscribe,
              IO.flatMap(() => subscriptions.write(list.filter((_, i) => i !== index))),
            );
      }),
    );

export const readStreamEventListeners: RIO.ReaderIO<StreamEventEnv, ReadonlyArray<StreamEventListenerState>> = pipe(
  RIO.asks((env: StreamEventEnv) => env.subscriptions),
  RIO.flatMapIO((subscriptions) => subscriptions.read),
  RIO.map((list) => list.map(({ targetURL, eventName }) => ({ targetURL, eventName }))),
);

// ─────────────────────────────────────────────────────────────────────────────
// OIPF surface
// ─────────────────────────────────────────────────────────────────────────────

export type StreamEventApi = Pick<
  OIPF.DAE.Broadcast.VideoBroadcast,
  "addStreamEventListener" | "removeStreamEventListener"
>;

export const streamEventApi: R.Reader<StreamEventEnv, StreamEventApi> = (env) => ({
  addStreamEventListener: (targetURL, eventName, listener) =>
    addStreamEventListener(targetURL, eventName, listener)(env)(),
  removeStreamEventListener: (targetURL, eventName, listener) =>
    removeStreamEventListener(targetURL, eventName, listener)(env)(),
});
