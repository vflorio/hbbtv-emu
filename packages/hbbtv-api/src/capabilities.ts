import {
  type ClassType,
  compose,
  type MessageBus,
  type OipfCapabilities,
  WithMessageBus,
  WithPostMessageAdapter,
} from "@hbb-emu/lib";
import * as IORef from "fp-ts/IORef";
import * as TE from "fp-ts/TaskEither";

const WithCapabilities = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base {
    protected capabilitiesXMLRef = IORef.newIORef("")();

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        this.capabilitiesXMLRef.write(payload.capabilities);
        return TE.right(void 0);
      });
    }

    get xmlCapabilities(): Document {
      return new DOMParser().parseFromString(this.capabilitiesXMLRef.read(), "text/xml");
    }

    private countVideoProfiles = (type: "SD" | "HD"): number => {
      const capabilitiesXML = this.capabilitiesXMLRef.read();
      const videoProfiles = capabilitiesXML.split("video_profile");
      if (videoProfiles.length <= 1) return 0;

      const profilesString = videoProfiles.slice(1).join();
      return profilesString.split(`_${type}_`).slice(1).length;
    };

    get extraSDVideoDecodes(): number {
      return this.countVideoProfiles("SD");
    }

    get extraHDVideoDecodes(): number {
      return this.countVideoProfiles("HD");
    }

    hasCapability = (capability: string): boolean => {
      const serialized = new XMLSerializer().serializeToString(this.xmlCapabilities);
      return serialized.includes(capability.toString() || "??");
    };
  };

export const createOipfCapabilities = (): OipfCapabilities => {
  const CapabilitiesClass = compose(
    class {},
    WithPostMessageAdapter,
    WithMessageBus("CONTENT_SCRIPT"),
    WithCapabilities,
  );
  return new CapabilitiesClass();
};
