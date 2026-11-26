/**
 * video/broadcast — stream events
 *
 * `addStreamEventListener()` and `removeStreamEventListener()` (TS 102 796 §8.2.1). The
 * events themselves come from the page's stream event scheduler, which knows the channel
 * and the schedule (the emulator's broadcast).
 *
 * Reader-style module (ROADMAP D1): the object's subscriptions live in an injected `IORef`.
 * - the same listener can be added more than once; each addition is a subscription;
 * - removing takes away one subscription with that URL, name and listener;
 * - a `targetURL` over HTTP(S) (absolute, or relative to the document) is an XML description
 *   of the event (§8.2.1.1, §9.3.1): the subscription starts once the description names the
 *   event, and the listener gets an event with status "error" if it cannot be fetched or read,
 *   or does not name it (§8.2.1.2). The schedule's events for it are those of the absolute URL;
 * - any other `targetURL` is a DSM-CC object of the carousel, which the emulator does not
 *   have: the schedule's events for that URL and name reach the listener;
 * - the object drops every subscription when it enters the unrealized state or connects to
 *   another channel (`dropStreamEventListeners`, §8.2.1.1).
 */

import { createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf-api";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type IORef, newIORef } from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type * as R from "fp-ts/Reader";
import * as RIO from "fp-ts/ReaderIO";
import * as T from "fp-ts/Task";
import {
  broadbandDescriptionUrl,
  createStreamEvent,
  describeStreamEvent,
  type FetchStreamEventDescription,
  type StreamEventSchedulerApi,
} from "../../../subsystems";

const logger = createLogger("VideoBroadcast:StreamEvent");

type Listener = OIPF.DAE.Broadcast.StreamEventListener;

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

type Subscription = Readonly<{
  /** Identifies the subscription while its description is being fetched. */
  key: object;
  targetURL: string;
  eventName: string;
  listener: Listener;
  /** Nothing to undo until it is subscribed to the schedule. */
  unsubscribe: IO.IO<void>;
}>;

/** A subscription as the settings UI sees it. */
export type StreamEventListenerState = Readonly<{ targetURL: string; eventName: string }>;

export type StreamEventEnv = Readonly<{
  scheduler: Pick<StreamEventSchedulerApi, "addListener">;
  /** Fetches the XML descriptions of the events (`targetURL` over HTTP(S)). */
  fetchDescription: FetchStreamEventDescription;
  /** What a relative `targetURL` is relative to: the document's base URL. */
  baseURI: IO.IO<string>;
  subscriptions: IORef<ReadonlyArray<Subscription>>;
}>;

export const createStreamEventEnv = (dependencies: Omit<StreamEventEnv, "subscriptions">): IO.IO<StreamEventEnv> =>
  pipe(
    newIORef<ReadonlyArray<Subscription>>([]),
    IO.map((subscriptions) => ({ ...dependencies, subscriptions })),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

const isSubscribed =
  (key: object): RIO.ReaderIO<StreamEventEnv, boolean> =>
  ({ subscriptions }) =>
    pipe(
      subscriptions.read,
      IO.map((list) => list.some((subscription) => subscription.key === key)),
    );

/** Subscribes to the schedule's events for `scheduleURL` and the subscription's name. */
const subscribeToSchedule =
  (subscription: Subscription, scheduleURL: string): RIO.ReaderIO<StreamEventEnv, void> =>
  ({ scheduler, subscriptions }) =>
    pipe(
      scheduler.addListener(scheduleURL, subscription.eventName, subscription.listener),
      IO.flatMap(({ unsubscribe }) =>
        subscriptions.modify((list) =>
          list.map((other) => (other.key === subscription.key ? { ...other, unsubscribe } : other)),
        ),
      ),
    );

/** The listener hears that its event cannot be monitored (§8.2.1.2). */
const dispatchError =
  (subscription: Subscription): IO.IO<void> =>
  () => {
    try {
      subscription.listener(
        createStreamEvent({ eventName: subscription.eventName, data: "", text: "", status: "error" }),
      );
    } catch (error) {
      logger.warn("StreamEvent listener threw", error)();
    }
  };

/**
 * Fetches the description, then subscribes to the event it names, or tells the listener it
 * cannot. Unless the subscription is gone meanwhile (removed, or dropped by the object).
 */
const subscribeThroughDescription =
  (subscription: Subscription, url: string): RIO.ReaderIO<StreamEventEnv, void> =>
  (env) =>
  () => {
    void pipe(
      describeStreamEvent(env.fetchDescription)(url, subscription.eventName),
      T.flatMapIO((described) =>
        pipe(
          isSubscribed(subscription.key)(env),
          IO.flatMap((subscribed) =>
            !subscribed
              ? IO.of(undefined)
              : pipe(
                  described,
                  E.match(
                    (reason) =>
                      pipe(
                        logger.warn(`No "${subscription.eventName}" events: ${reason}`),
                        IO.flatMap(() => dispatchError(subscription)),
                      ),
                    () => subscribeToSchedule(subscription, url)(env),
                  ),
                ),
          ),
        ),
      ),
    )();
  };

export const addStreamEventListener =
  (targetURL: string, eventName: string, listener: Listener): RIO.ReaderIO<StreamEventEnv, void> =>
  (env) =>
    pipe(
      logger.debug("addStreamEventListener", targetURL, eventName),
      IO.map((): Subscription => ({ key: {}, targetURL, eventName, listener, unsubscribe: IO.of(undefined) })),
      IO.tap((subscription) => env.subscriptions.modify((list) => [...list, subscription])),
      IO.flatMap((subscription) =>
        pipe(
          broadbandDescriptionUrl(targetURL, env.baseURI()),
          O.match(
            () => subscribeToSchedule(subscription, targetURL)(env),
            (url) => subscribeThroughDescription(subscription, url)(env),
          ),
        ),
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

/**
 * The object stops monitoring the stream events of its channel: it entered the unrealized
 * state, or connects to another channel (TS 102 796 §8.2.1.1). Every subscription goes.
 */
export const dropStreamEventListeners: RIO.ReaderIO<StreamEventEnv, void> = ({ subscriptions }) =>
  pipe(
    subscriptions.read,
    IO.flatMap((list) =>
      list.length === 0
        ? IO.of(undefined)
        : pipe(
            logger.debug(`Dropping ${list.length} stream event listener(s)`),
            IO.flatMap(() => subscriptions.write([])),
            IO.flatMap(() => IO.sequenceArray(list.map((subscription) => subscription.unsubscribe))),
            IO.asUnit,
          ),
    ),
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
