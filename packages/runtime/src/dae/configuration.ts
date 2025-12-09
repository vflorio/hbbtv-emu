import {
  createLogger,
  createStatefulMethods,
  deriveSchema,
  type OnStateChangeCallback,
  type Stateful,
} from "@hbb-emu/core";
import {
  DEFAULT_COUNTRY_ID,
  DEFAULT_LANGUAGE,
  DEFAULT_NETWORK,
  DEFAULT_PARENTAL_CONTROL,
  OIPF,
  type OipfConfigurationState,
  OipfConfigurationStateCodec,
} from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RR from "fp-ts/ReadonlyRecord";
import type { ObjectDefinition } from "../objectDefinitions";

const logger = createLogger("OipfConfiguration");

export const oipfConfigurationDefinition: ObjectDefinition<
  OipfConfiguration,
  OipfConfigurationState,
  "oipfConfiguration"
> = {
  name: "OipfConfiguration",
  selector: `object[type="${OIPF.DAE.Configuration.MIME_TYPE}"]`,
  predicate: OIPF.DAE.Configuration.isValidElement,
  factory: () => new OipfConfiguration(),
  stateKey: "oipfConfiguration",
  attachStrategy: "copy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class OipfConfiguration implements OIPF.DAE.Configuration.Configuration, Stateful<OipfConfigurationState> {
  countryId = DEFAULT_COUNTRY_ID;
  language = DEFAULT_LANGUAGE;
  preferredAudioLanguage: string[] = [DEFAULT_LANGUAGE, "eng"];
  preferredSubtitleLanguage: string[] = [DEFAULT_LANGUAGE, "eng"];
  network = DEFAULT_NETWORK;
  parentalControl = DEFAULT_PARENTAL_CONTROL;

  /** Custom key-value store for vendor-specific settings */
  customValues: RR.ReadonlyRecord<string, unknown> = {};

  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface
  // ═══════════════════════════════════════════════════════════════════════════

  readonly stateful = createStatefulMethods(
    deriveSchema<OipfConfigurationState, OipfConfiguration>(OipfConfigurationStateCodec),
    this,
  );

  applyState = (state: Partial<OipfConfigurationState>): IO.IO<void> => this.stateful.applyState(state);

  getState = (): IO.IO<Partial<OipfConfigurationState>> => this.stateful.getState();

  subscribe = (callback: OnStateChangeCallback<OipfConfigurationState>): IO.IO<() => void> =>
    this.stateful.subscribe(callback);

  notifyStateChange = (changedKeys: ReadonlyArray<keyof OipfConfigurationState>): IO.IO<void> =>
    this.stateful.notifyStateChange(changedKeys);

  // ═══════════════════════════════════════════════════════════════════════════
  // Configuration API
  // ═══════════════════════════════════════════════════════════════════════════

  setHbbTVAppAutoStart = (enabled: boolean): void => {
    logger.debug("setHbbTVAppAutoStart:", enabled)();
  };

  getValue = (key: string): unknown =>
    pipe(
      logger.debug("getValue:", key),
      IO.map(() => pipe(RR.lookup(key)(this.customValues), O.toUndefined)),
    )();

  setValue = (key: string, value: unknown): void => {
    pipe(
      logger.debug("setValue:", key, value),
      IO.tap(
        IO.of(() => {
          this.customValues = pipe(this.customValues, RR.upsertAt(key, value));
        }),
      ),
    )();
  };
}
