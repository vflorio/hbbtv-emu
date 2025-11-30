import {
  type ClassType,
  type Configuration,
  compose,
  type LocalSystem,
  type MessageBus,
  type OipfConfiguration,
  ordVersion,
  parseVersion,
  unsafeParseVersion,
  type Version,
  WithMessageBus,
  WithPostMessageAdapter,
} from "@hbb-emu/lib";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import * as Ord from "fp-ts/Ord";

const base = (countryCode: string): Configuration => ({
  preferredAudioLanguage: countryCode,
  preferredSubtitleLanguage: `${countryCode},ENG`,
  preferredUILanguage: `${countryCode},ENG`,
  countryId: countryCode,
});

const extended = (base: Configuration): Configuration => ({
  ...base,
  subtitlesEnabled: true,
  audioDescriptionEnabled: true,
  timeShiftSynchronized: true,
  dtt_network_ids: [],
  deviceId: "abcdef12345",
  requestAccessToDistinctiveIdentifier: (cb) => {
    cb?.(true);
  },
});

const localSystemV2: LocalSystem = {
  deviceID: "no name",
  modelName: "tv",
  vendorName: "unknown",
  softwareVersion: "1.0.0",
  hardwareVersion: "1.0",
  serialNumber: "12345",
};

const isGreaterThanOrEqual = Ord.geq(ordVersion);
const isVersion2 = (version: Version) => isGreaterThanOrEqual(version, unsafeParseVersion("2.0.0"));

const WithConfiguration = <T extends ClassType<MessageBus.Contract>>(Base: T) =>
  class extends Base {
    hbbtvVersionRef = IORef.newIORef("")();
    countryCodeRef = IORef.newIORef("")();

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) =>
        pipe(
          IO.of(payload),
          IO.flatMap(() => this.countryCodeRef.write(payload.countryCode)),
          IO.flatMap(() => this.hbbtvVersionRef.write(payload.version)),
        ),
      );
    }

    get configuration(): Configuration {
      return pipe(
        parseVersion(this.hbbtvVersionRef.read()),
        E.match(
          () => base(this.countryCodeRef.read()),
          (hbbtvVersion) =>
            pipe(base(this.countryCodeRef.read()), (base) => (isVersion2(hbbtvVersion) ? extended(base) : base)),
        ),
      );
    }

    get localSystem(): LocalSystem | undefined {
      return pipe(
        parseVersion(this.hbbtvVersionRef.read()),
        E.match(
          () => O.none,
          (hbbtvVersion) => (isVersion2(hbbtvVersion) ? O.some(localSystemV2) : O.none),
        ),
        O.toUndefined,
      );
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
