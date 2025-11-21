import { getCountryCode, getHbbTVVersion } from "./storage";

export interface Configuration {
  preferredAudioLanguage: string;
  preferredSubtitleLanguage: string;
  preferredUILanguage: string;
  countryId: string;
  subtitlesEnabled?: boolean;
  audioDescriptionEnabled?: boolean;
  timeShiftSynchronized?: boolean;
  dtt_network_ids?: string[];
  deviceId?: string;
  requestAccessToDistinctiveIdentifier?: (cb: (granted: boolean) => void) => void;
}

export interface LocalSystem {
  deviceID: string;
  modelName: string;
  vendorName: string;
  softwareVersion: string;
  hardwareVersion: string;
  serialNumber: string;
}

export interface OipfConfiguration {
  configuration: Configuration;
  localSystem?: LocalSystem;
  getText: (key: string) => string | undefined;
  setText: (key: string, value: string) => void;
}

const createConfiguration = (): Configuration => {
  const countryId = getCountryCode();
  const hbbtvVersion = getHbbTVVersion();

  const baseConfig: Configuration = {
    preferredAudioLanguage: countryId,
    preferredSubtitleLanguage: `${countryId},ENG`,
    preferredUILanguage: `${countryId},ENG`,
    countryId,
  };

  // HbbTV 2.0+ features
  if (hbbtvVersion === "2.0.1" || hbbtvVersion === "2.0.2") {
    return {
      ...baseConfig,
      subtitlesEnabled: true,
      audioDescriptionEnabled: true,
      timeShiftSynchronized: true,
      dtt_network_ids: [],
      deviceId: "abcdef12345",
      requestAccessToDistinctiveIdentifier: (cb) => {
        cb?.(true);
      },
    };
  }

  return baseConfig;
};

const createLocalSystem = (): LocalSystem => ({
  deviceID: "no name",
  modelName: "tv",
  vendorName: "unknown",
  softwareVersion: "1.0.0",
  hardwareVersion: "1.0",
  serialNumber: "12345",
});

export const createOipfConfiguration = (): OipfConfiguration => {
  const hbbtvVersion = getHbbTVVersion();
  const configuration = createConfiguration();

  const config: OipfConfiguration = {
    configuration,
    getText: (_key: string) => undefined,
    setText: (_key: string, _value: string) => {},
  };

  // Add localSystem for HbbTV 2.0+
  if (hbbtvVersion === "2.0.1" || hbbtvVersion === "2.0.2") {
    config.localSystem = createLocalSystem();
  }

  return config;
};
