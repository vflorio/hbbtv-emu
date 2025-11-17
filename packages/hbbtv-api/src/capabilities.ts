import { getCapabilities } from "./storage";

export interface OipfCapabilities {
  xmlCapabilities: Document;
  extraSDVideoDecodes: number;
  extraHDVideoDecodes: number;
  hasCapability: (capability: string) => boolean;
}

const parseXMLCapabilities = (xmlString: string): Document => {
  return new DOMParser().parseFromString(xmlString, "text/xml");
};

const countVideoProfiles = (xmlString: string, type: "SD" | "HD"): number => {
  const videoProfiles = xmlString.split("video_profile");
  if (videoProfiles.length <= 1) return 0;

  const profilesString = videoProfiles.slice(1).join();
  return profilesString.split(`_${type}_`).slice(1).length;
};

export const createOipfCapabilities = (): OipfCapabilities => {
  const capabilitiesXML = getCapabilities();
  const xmlCapabilities = parseXMLCapabilities(capabilitiesXML);

  return {
    xmlCapabilities,
    extraSDVideoDecodes: countVideoProfiles(capabilitiesXML, "SD"),
    extraHDVideoDecodes: countVideoProfiles(capabilitiesXML, "HD"),

    hasCapability: (capability: string) => {
      const serialized = new XMLSerializer().serializeToString(xmlCapabilities);
      return serialized.includes(capability.toString() || "??");
    },
  };
};
