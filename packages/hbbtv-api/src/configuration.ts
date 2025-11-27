import {
  type ClassType,
  type Configuration,
  compose,
  type LocalSystem,
  type MessageBus,
  type OipfConfiguration,
  version,
  WithMessageBus,
  WithPostMessageAdapter,
} from "@hbb-emu/lib";

const WithConfiguration = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base {
    protected hbbtvVersion: string = "";
    protected countryCode: string = "";

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_COUNTRY_CODE", ({ message: { payload } }) => {
        this.countryCode = payload;
      });

      this.bus.on("UPDATE_VERSION", ({ message: { payload } }) => {
        this.hbbtvVersion = payload;
      });
    }

    get configuration(): Configuration {
      const baseConfig: Configuration = {
        preferredAudioLanguage: this.countryCode,
        preferredSubtitleLanguage: `${this.countryCode},ENG`,
        preferredUILanguage: `${this.countryCode},ENG`,
        countryId: this.countryCode,
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

    getText = (_key: string): string | undefined => undefined;

    setText = (_key: string, _value: string): void => {};
  };

export const createOipfConfiguration = (): OipfConfiguration => {
  const OipfConfigurationClass = compose(
    class {},
    WithPostMessageAdapter,
    WithMessageBus("CONTENT_SCRIPT"),
    WithConfiguration,
  );
  return new OipfConfigurationClass();
};
