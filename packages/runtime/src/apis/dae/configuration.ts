import {
  createLogger,
  createStatefulMethods,
  deriveSchema,
  type OnStateChangeCallback,
  type Stateful,
} from "@hbb-emu/core";
import { type OIPF, type OipfConfigurationState, OipfConfigurationStateCodec } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RR from "fp-ts/ReadonlyRecord";

const logger = createLogger("OipfConfiguration");

export type OipfConfigurationEnv = Readonly<{
  defaults: OipfConfigurationState;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class OipfConfiguration implements OIPF.DAE.Configuration.Configuration, Stateful<OipfConfigurationState> {
  countryId: NonNullable<OipfConfigurationState["countryId"]>;
  language: NonNullable<OipfConfigurationState["language"]>;
  preferredAudioLanguage: NonNullable<OipfConfigurationState["preferredAudioLanguage"]>;
  preferredSubtitleLanguage: NonNullable<OipfConfigurationState["preferredSubtitleLanguage"]>;
  network: NonNullable<OipfConfigurationState["network"]>;
  parentalControl: NonNullable<OipfConfigurationState["parentalControl"]>;

  /** Custom key-value store for vendor-specific settings */
  customValues: RR.ReadonlyRecord<string, unknown> = {};

  constructor(env: OipfConfigurationEnv) {
    const defaults = env.defaults;
    this.countryId = defaults.countryId ?? "";
    this.language = defaults.language ?? "";
    this.preferredAudioLanguage = [...(defaults.preferredAudioLanguage ?? [])];
    this.preferredSubtitleLanguage = [...(defaults.preferredSubtitleLanguage ?? [])];
    this.network = defaults.network ?? {};
    this.parentalControl = defaults.parentalControl ?? {};
  }

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
