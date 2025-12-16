import type { Stateful } from "@hbb-emu/core";
import { createLogger } from "@hbb-emu/core";
import type { HbbTVState } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import type * as RIO from "fp-ts/ReaderIO";
import * as RA from "fp-ts/ReadonlyArray";
import type { AnyOipfDefinition } from "../..";
import { getFirstInstance, type RegistryEntry, type RegistryEnv, readRegistry } from "./registry";

const logger = createLogger("State");

// Pure

const applyStateToInstance =
  (definition: AnyOipfDefinition, stateSlice: unknown) =>
  (instance: Stateful<unknown>): IO.IO<void> =>
    definition.applyState(instance, stateSlice as Partial<unknown>);

const applyStateToEntry =
  (stateSlice: unknown) =>
  (entry: RegistryEntry): IO.IO<void> =>
    pipe(
      [...entry.instances],
      RA.traverse(IO.Applicative)(applyStateToInstance(entry.definition, stateSlice)),
      IO.map(() => undefined),
    );

const collectStateFromEntry = (entry: RegistryEntry): IO.IO<O.Option<Partial<unknown>>> =>
  pipe(
    getFirstInstance(entry),
    O.traverse(IO.Applicative)((instance) => entry.definition.getState(instance)),
  );

// Operations

/** Apply external state to all registered instances */
export const applyExternalState =
  (state: Partial<HbbTVState>): RIO.ReaderIO<RegistryEnv, void> =>
  (env) =>
    pipe(
      logger.debug("Applying external state"),
      IO.flatMap(() => readRegistry(env)),
      IO.flatMap((registry) =>
        pipe(
          [...registry.entries()],
          RA.traverse(IO.Applicative)(([stateKey, entry]) =>
            pipe(
              O.fromNullable(state[stateKey]),
              O.match(
                () => IO.of(undefined),
                (stateSlice) => applyStateToEntry(stateSlice)(entry),
              ),
            ),
          ),
          IO.map(() => undefined),
        ),
      ),
      IO.tap(() => logger.debug("External state applied")),
    );

/** Collect state from all registered instances */
export const collectState: RIO.ReaderIO<RegistryEnv, Partial<HbbTVState>> = (env) =>
  pipe(
    logger.debug("Collecting state from instances"),
    IO.flatMap(() => readRegistry(env)),
    IO.flatMap((registry) =>
      pipe(
        [...registry.entries()],
        RA.traverse(IO.Applicative)(([stateKey, entry]) =>
          pipe(
            collectStateFromEntry(entry),
            IO.map((maybeState) =>
              pipe(
                maybeState,
                O.map((s) => [stateKey, s] as const),
              ),
            ),
          ),
        ),
        IO.map(RA.compact),
        IO.map((pairs) => Object.fromEntries(pairs) as Partial<HbbTVState>),
      ),
    ),
    IO.tap((state) => logger.debug("State collected:", Object.keys(state))),
  );
