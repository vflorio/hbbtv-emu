import {
  createLogger,
  DEFAULT_COUNTRY_ID,
  DEFAULT_LANGUAGE,
  DEFAULT_NETWORK,
  DEFAULT_PARENTAL_CONTROL,
  type OIPF,
  type OipfConfigurationState,
  OipfConfigurationStateCodec,
} from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RR from "fp-ts/ReadonlyRecord";
import { createBidirectionalMethods, deriveSchema, type OnStateChangeCallback, type Stateful } from "../stateful";

const logger = createLogger("OipfConfiguration");

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class OipfConfiguration implements OIPF.Configuration.Configuration, Stateful<OipfConfigurationState> {
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

  readonly stateful = createBidirectionalMethods(
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
