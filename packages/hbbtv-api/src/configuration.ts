import { getCountryCode, getHbbTVVersion } from "./storage";
import { version, compose, type ClassType } from "@hbb-emu/lib";

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

class ConfigurationBase {
  protected hbbtvVersion = getHbbTVVersion();
}

const WithConfiguration = <T extends ClassType<ConfigurationBase>>(Base: T) =>
  class extends Base {
    get configuration(): Configuration {
      const countryId = getCountryCode();

      const baseConfig: Configuration = {
        preferredAudioLanguage: countryId,
        preferredSubtitleLanguage: `${countryId},ENG`,
        preferredUILanguage: `${countryId},ENG`,
        countryId,
      };

      if (version(this.hbbtvVersion).isLessThan("2.0.0")) return baseConfig;

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
  };

const WithLocalSystem = <T extends ClassType<ConfigurationBase>>(Base: T) =>
  class extends Base {
    get localSystem(): LocalSystem | undefined {
      if (version(this.hbbtvVersion).isLessThan("2.0.0")) return undefined;

      return {
        deviceID: "no name",
        modelName: "tv",
        vendorName: "unknown",
        softwareVersion: "1.0.0",
        hardwareVersion: "1.0",
        serialNumber: "12345",
      };
    }
  };

const WithTextHandling = <T extends ClassType<ConfigurationBase>>(Base: T) =>
  class extends Base {
    getText = (_key: string): string | undefined => undefined;

    setText = (_key: string, _value: string): void => { };
  };

const OipfConfigurationClass = compose(ConfigurationBase, WithConfiguration, WithLocalSystem, WithTextHandling);

export const createOipfConfiguration = (): OipfConfiguration => new OipfConfigurationClass();
