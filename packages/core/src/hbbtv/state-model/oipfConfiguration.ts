/**
 * OIPF Configuration State
 *
 * State for application/oipfConfiguration object.
 * Represents device configuration settings like language preferences,
 * country ID, network status, and parental control settings.
 */

import * as t from "io-ts";
import type { OIPF } from "../api";
import { NetworkConfigCodec, ParentalControlCodec } from "./network";

// ─────────────────────────────────────────────────────────────────────────────
// OIPF Configuration State
// ─────────────────────────────────────────────────────────────────────────────

export const OipfConfigurationStateCodec = t.partial({
  /** Country identifier (ISO 3166-1 alpha-2) */
  countryId: t.string,

  /** Primary UI language (ISO 639-2/B code) */
  language: t.string,

  /** Preferred audio languages in order of preference */
  preferredAudioLanguage: t.array(t.string),

  /** Preferred subtitle languages in order of preference */
  preferredSubtitleLanguage: t.array(t.string),

  /** Network configuration and status */
  network: NetworkConfigCodec,

  /** Parental control settings */
  parentalControl: ParentalControlCodec,
});

export type OipfConfigurationState = t.TypeOf<typeof OipfConfigurationStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_COUNTRY_ID = "IT";

export const DEFAULT_LANGUAGE = "ita";

export const DEFAULT_NETWORK: NonNullable<OIPF.Configuration.Configuration["network"]> = {
  interfaces: [],
  online: true,
};

export const DEFAULT_PARENTAL_CONTROL: NonNullable<OIPF.Configuration.Configuration["parentalControl"]> = {
  rating: 0,
  enabled: false,
};

export const DEFAULT_OIPF_CONFIGURATION: OipfConfigurationState = {
  countryId: DEFAULT_COUNTRY_ID,
  language: DEFAULT_LANGUAGE,
  preferredAudioLanguage: [DEFAULT_LANGUAGE, "eng"],
  preferredSubtitleLanguage: [DEFAULT_LANGUAGE, "eng"],
  network: DEFAULT_NETWORK,
  parentalControl: DEFAULT_PARENTAL_CONTROL,
};
