import { getCapabilities } from "./storage";
import type { ClassType } from "./utils";
import { compose } from "./utils";

export interface OipfCapabilities {
  xmlCapabilities: Document;
  extraSDVideoDecodes: number;
  extraHDVideoDecodes: number;
  hasCapability: (capability: string) => boolean;
}

class CapabilitiesBase {
  protected capabilitiesXML = getCapabilities();
}

const WithXMLCapabilities = <T extends ClassType<CapabilitiesBase>>(Base: T) =>
  class extends Base {
    get xmlCapabilities(): Document {
      return new DOMParser().parseFromString(this.capabilitiesXML, "text/xml");
    }
  };

const WithVideoProfiles = <T extends ClassType<CapabilitiesBase>>(Base: T) =>
  class extends Base {
    private countVideoProfiles = (type: "SD" | "HD"): number => {
      const videoProfiles = this.capabilitiesXML.split("video_profile");
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
  };

const WithCapabilityCheck = <T extends ClassType<CapabilitiesBase & { xmlCapabilities: Document }>>(Base: T) =>
  class extends Base {
    hasCapability = (capability: string): boolean => {
      const serialized = new XMLSerializer().serializeToString(this.xmlCapabilities);
      return serialized.includes(capability.toString() || "??");
    };
  };

const CapabilitiesClass = compose(CapabilitiesBase, WithXMLCapabilities, WithVideoProfiles, WithCapabilityCheck);

export const createOipfCapabilities = (): OipfCapabilities => new CapabilitiesClass();
