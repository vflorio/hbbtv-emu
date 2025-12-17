import {
  createLogger,
  createStatefulMethods,
  deriveSchema,
  type OnStateChangeCallback,
  type Stateful,
} from "@hbb-emu/core";
import { type ApplicationManagerState, ApplicationManagerStateCodec, type OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import { type ApplicationEnv, createApplication } from "./application";

const logger = createLogger("OipfApplicationManager");

/**
 * Environment for ApplicationManager.
 * Provides access to the current broadcast channel for ApplicationPrivateData.
 */
export type ApplicationManagerEnv = Readonly<{
  /** Returns the current channel from the active VideoBroadcast */
  getCurrentChannel: () => OIPF.DAE.Broadcast.Channel | null;

  /** Creates a Keyset instance for new ApplicationPrivateData */
  createKeyset: () => OIPF.DAE.ApplicationManager.Keyset;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// ApplicationManager
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Application cache per ApplicationManager instance.
 * WeakMap keyed by Document to allow garbage collection.
 */
type ApplicationCache = WeakMap<Document, OIPF.DAE.ApplicationManager.Application>;

/**
 * Creates a function to get or create an application for a document.
 */
const createGetOrCreateApplication =
  (cache: ApplicationCache, env: ApplicationEnv) =>
  (doc: Document): IO.IO<OIPF.DAE.ApplicationManager.Application> =>
    pipe(
      IO.of(cache.get(doc)),
      IO.map(O.fromNullable),
      IO.flatMap(
        O.match(
          () =>
            pipe(
              logger.debug("Creating new Application for document"),
              IO.map(() => {
                const app = createApplication(doc, env);
                cache.set(doc, app);
                return app;
              }),
            ),
          (existingApp) => IO.of(existingApp),
        ),
      ),
    );

export class OipfApplicationManager
  implements OIPF.DAE.ApplicationManager.ApplicationManager, Stateful<ApplicationManagerState>
{
  readonly #env: ApplicationManagerEnv;
  readonly #applicationCache: ApplicationCache = new WeakMap();
  readonly #getOrCreateApplication: (doc: Document) => IO.IO<OIPF.DAE.ApplicationManager.Application>;

  constructor(env: ApplicationManagerEnv) {
    this.#env = env;
    this.#getOrCreateApplication = createGetOrCreateApplication(this.#applicationCache, {
      getCurrentChannel: this.#env.getCurrentChannel,
      createKeyset: this.#env.createKeyset,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface
  // ═══════════════════════════════════════════════════════════════════════════

  readonly stateful = createStatefulMethods(
    deriveSchema<ApplicationManagerState, OipfApplicationManager>(ApplicationManagerStateCodec),
    this,
  );

  applyState = (state: Partial<ApplicationManagerState>): IO.IO<void> => this.stateful.applyState(state);

  getState: IO.IO<Partial<ApplicationManagerState>> = this.stateful.getState;

  subscribe = (callback: OnStateChangeCallback<ApplicationManagerState>): IO.IO<() => void> =>
    this.stateful.subscribe(callback);

  notifyStateChange = (changedKeys: ReadonlyArray<keyof ApplicationManagerState>): IO.IO<void> =>
    this.stateful.notifyStateChange(changedKeys);

  // ═══════════════════════════════════════════════════════════════════════════
  // ApplicationManager API
  // ═══════════════════════════════════════════════════════════════════════════

  getOwnerApplication = (document?: Document): OIPF.DAE.ApplicationManager.Application | null =>
    pipe(
      logger.debug("getOwnerApplication"),
      IO.flatMap(() =>
        pipe(
          O.fromNullable(document ?? globalThis.document),
          O.match(
            (): IO.IO<OIPF.DAE.ApplicationManager.Application | null> =>
              pipe(
                logger.warn("No document available"),
                IO.map(() => null),
              ),
            (doc): IO.IO<OIPF.DAE.ApplicationManager.Application | null> => this.#getOrCreateApplication(doc),
          ),
        ),
      ),
    )();

  getApplication = (appId: string): OIPF.DAE.ApplicationManager.Application | null => {
    logger.debug("getApplication:", appId)();
    // TODO
    return null;
  };

  onLowMemory = (): void => {
    logger.info("onLowMemory triggered")();
  };
}
