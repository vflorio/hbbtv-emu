import {
  createLogger,
  createStatefulMethods,
  deriveSchema,
  type OnStateChangeCallback,
  type Stateful,
} from "@hbb-emu/core";
import {
  type ApplicationManagerState,
  ApplicationManagerStateCodec,
  DEFAULT_APPLICATION,
  DEFAULT_KEYSET,
  type OIPF,
} from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";

const logger = createLogger("OipfApplicationManager");

// ─────────────────────────────────────────────────────────────────────────────
// Keyset Implementation
// ─────────────────────────────────────────────────────────────────────────────

class KeysetImpl implements OIPF.DAE.ApplicationManager.Keyset {
  currentValue = DEFAULT_KEYSET.value ?? 0;

  setValue = (mask: number): void => {
    this.currentValue = mask;
  };

  getValue = (): number => this.currentValue;

  setKey = (keyCode: number, enabled: boolean): void => {
    if (enabled) {
      this.currentValue |= keyCode;
    } else {
      this.currentValue &= ~keyCode;
    }
  };
}

export const createKeyset = (): OIPF.DAE.ApplicationManager.Keyset => new KeysetImpl();

// ─────────────────────────────────────────────────────────────────────────────
// Application Implementation
// ─────────────────────────────────────────────────────────────────────────────

class ApplicationImpl implements OIPF.DAE.ApplicationManager.Application {
  privateData: OIPF.DAE.ApplicationManager.ApplicationPrivateData = DEFAULT_APPLICATION.privateData ?? {};
  keyset: KeysetImpl;

  constructor(private readonly document: Document) {
    this.keyset = new KeysetImpl();
  }

  getKeyset = (): OIPF.DAE.ApplicationManager.Keyset => this.keyset;

  show = (): void => {
    pipe(
      logger.debug("Application.show()"),
      IO.flatMap(() =>
        IO.of(() => {
          if (this.document.body) {
            this.document.body.style.visibility = "visible";
          }
        }),
      ),
    )();
  };

  hide = (): void => {
    pipe(
      logger.debug("Application.hide()"),
      IO.flatMap(() =>
        IO.of(() => {
          if (this.document.body) {
            this.document.body.style.visibility = "hidden";
          }
        }),
      ),
    )();
  };

  activate = (): void => {
    logger.debug("Application.activate()")();
  };

  deactivate = (): void => {
    logger.debug("Application.deactivate()")();
  };

  destroy = (): void => {
    logger.debug("Application.destroy()")();
  };
}

export const createApplication = (document: Document): OIPF.DAE.ApplicationManager.Application =>
  new ApplicationImpl(document);

// ─────────────────────────────────────────────────────────────────────────────
// ApplicationManager Implementation
// ─────────────────────────────────────────────────────────────────────────────

/** WeakMap cache for applications per document */
const applicationCache = new WeakMap<Document, OIPF.DAE.ApplicationManager.Application>();

/** Pure function to get or create application for a document */
const getOrCreateApplication = (doc: Document): IO.IO<OIPF.DAE.ApplicationManager.Application> =>
  pipe(
    IO.of(applicationCache.get(doc)),
    IO.map(O.fromNullable),
    IO.flatMap(
      O.match(
        () =>
          pipe(
            logger.debug("Creating new Application for document"),
            IO.map(() => {
              const app = createApplication(doc);
              applicationCache.set(doc, app);
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
  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface
  // ═══════════════════════════════════════════════════════════════════════════

  readonly stateful = createStatefulMethods(
    deriveSchema<ApplicationManagerState, OipfApplicationManager>(ApplicationManagerStateCodec),
    this,
  );

  applyState = (state: Partial<ApplicationManagerState>): IO.IO<void> => this.stateful.applyState(state);

  getState = (): IO.IO<Partial<ApplicationManagerState>> => this.stateful.getState();

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
            (doc): IO.IO<OIPF.DAE.ApplicationManager.Application | null> => getOrCreateApplication(doc),
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
