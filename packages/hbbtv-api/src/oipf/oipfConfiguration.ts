import {
  createLogger,
  DEFAULT_COUNTRY_ID,
  DEFAULT_LANGUAGE,
  DEFAULT_NETWORK,
  DEFAULT_PARENTAL_CONTROL,
  type OIPF,
} from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RR from "fp-ts/ReadonlyRecord";

const logger = createLogger("OipfConfiguration");

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class OipfConfiguration implements OIPF.Configuration.Configuration {
  countryId = DEFAULT_COUNTRY_ID;
  language = DEFAULT_LANGUAGE;
  preferredAudioLanguage: string[] = [DEFAULT_LANGUAGE, "eng"];
  preferredSubtitleLanguage: string[] = [DEFAULT_LANGUAGE, "eng"];
  network = DEFAULT_NETWORK;
  parentalControl = DEFAULT_PARENTAL_CONTROL;

  /** Custom key-value store for vendor-specific settings */
  customValues: RR.ReadonlyRecord<string, unknown> = {};

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
