import {
  type ClassType,
  type Configuration,
  compose,
  type LocalSystem,
  type OipfConfiguration,
  version,
} from "@hbb-emu/lib";
import { getCountryCode, getHbbTVVersion } from "./storage";

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

    setText = (_key: string, _value: string): void => {};
  };

const OipfConfigurationClass = compose(ConfigurationBase, WithConfiguration, WithLocalSystem, WithTextHandling);

export const createOipfConfiguration = (): OipfConfiguration => new OipfConfigurationClass();
