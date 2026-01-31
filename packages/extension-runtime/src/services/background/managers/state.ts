import { Logger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOE from "fp-ts/IOEither";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { StorageAdapter } from "../../../adapter";
import { DEFAULT_STATE, type ExtensionState } from "../../../state";
import type { BackgroundServiceError } from "../background";

export type StateManagerEnv = {
  readonly storage: StorageAdapter<ExtensionState>;
};

export class StateManager {
  private state: O.Option<ExtensionState> = O.none;
  private logger: Logger;

  constructor(private readonly env: StateManagerEnv) {
    this.logger = new Logger("StateManager");
  }

  /**
   * Initializes state from storage or creates default if empty.
   */
  readonly init = (): TE.TaskEither<BackgroundServiceError, void> =>
    pipe(
      TE.Do,
      TE.tapIO(() => this.logger.info("Initializing")),
      TE.flatMap(() => this.getInitialState()),
      TE.tapIO((state) => this.setState(state)),
      TE.tapIO(() => this.logger.info("Initialized")),
      TE.asUnit,
    );

  /**
   * Cleanup resources
   */
  readonly destroy = (): IO.IO<void> =>
    pipe(
      IO.Do,
      IO.tap(() => this.logger.info("Destroying")),
      IO.tap(() => () => {
        this.state = O.none;
      }),
      IO.tap(() => this.logger.info("Destroyed")),
    );

  readonly setLogger =
    (logger: Logger): IO.IO<void> =>
    () => {
      this.logger = logger.create("StateManager");
    };

  /**
   * Loads state from storage or returns default
   */
  private readonly getInitialState = (): TE.TaskEither<BackgroundServiceError, ExtensionState> =>
    pipe(this.env.storage.read(), TE.map(O.getOrElse(() => DEFAULT_STATE)));

  /**
   * Returns current state. Fails if not initialized.
   */
  readonly getState = (): IOE.IOEither<BackgroundServiceError, ExtensionState> =>
    pipe(
      this.state,
      IOE.fromOption(() => ({ _tag: "StateNotInitialized" })),
    );

  /**
   * Sets state locally
   */
  private readonly setState =
    (state: ExtensionState): IO.IO<void> =>
    () => {
      this.state = O.some(state);
    };

  /**
   * Updates state locally and persists to storage
   */
  readonly updateState = (handler: (state: ExtensionState) => ExtensionState): T.Task<void> =>
    pipe(
      this.getState(),
      IOE.map(handler),
      IOE.map((newState) => ({ ...newState, lastUpdated: Date.now() })),
      TE.fromIOEither,
      TE.tapIO((newState) => this.setState(newState)),
      TE.tap((newState) => this.persistState(newState)),
      TE.match(
        (error) => {
          this.logger.error("Failed to update state", error);
        },
        () => {
          this.logger.debug("State updated successfully");
        },
      ),
    );

  /**
   * Persists state to storage
   */
  private readonly persistState = (state: ExtensionState): TE.TaskEither<BackgroundServiceError, void> =>
    pipe(
      this.env.storage.write(state),
      TE.tapIO(() => this.logger.debug("State persisted to storage")),
    );
}
