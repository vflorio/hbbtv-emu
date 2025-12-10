import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type * as RIO from "fp-ts/ReaderIO";
import type { StateKey } from "../../../types";

const logger = createLogger("Callback");

/** Callback invoked when local state changes */
export type OnLocalStateChangeCallback = (type: StateKey, state: Partial<unknown>) => IO.IO<void>;

export type CallbackEnv = Readonly<{
  callbackRef: IORef.IORef<O.Option<OnLocalStateChangeCallback>>;
}>;

// Operations

/** Set callback for local state changes */
export const setCallback =
  (callback: OnLocalStateChangeCallback): RIO.ReaderIO<CallbackEnv, void> =>
  (env) =>
    pipe(
      logger.debug("Setting local state change callback"),
      IO.flatMap(() => env.callbackRef.write(O.some(callback))),
    );

/** Clear callback */
export const clearCallback: RIO.ReaderIO<CallbackEnv, void> = (env) =>
  pipe(
    logger.debug("Clearing local state change callback"),
    IO.flatMap(() => env.callbackRef.write(O.none)),
  );

/** Invoke callback if set */
export const invokeCallback =
  (stateKey: StateKey, state: Partial<unknown>): RIO.ReaderIO<CallbackEnv, void> =>
  (env) =>
    pipe(
      env.callbackRef.read,
      IO.flatMap(
        O.match(
          () => IO.of(undefined),
          (callback) => callback(stateKey, state),
        ),
      ),
    );

/** Create a handler that invokes the callback when state changes */
export const createChangeHandler =
  (stateKey: StateKey): RIO.ReaderIO<CallbackEnv, (state: Partial<unknown>) => IO.IO<void>> =>
  (env) =>
    IO.of((changedState: Partial<unknown>) => invokeCallback(stateKey, changedState)(env));
