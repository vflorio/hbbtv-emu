import {
  createApplicationManager,
  createOipfCapabilities,
  createOipfConfiguration,
  VideoBroadcastObject,
} from "@hbb-emu/hbbtv-api";

const copyProperties = (source: object, target: HTMLObjectElement) => {
  Object.keys(source).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor) Object.defineProperty(target, key, descriptor);
  });

  const proto = Object.getPrototypeOf(source);
  if (!proto) return;

  Object.getOwnPropertyNames(proto).forEach((key) => {
    if (key !== "constructor" && !(key in target)) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor) Object.defineProperty(target, key, descriptor);
    }
  });
};

const createObjectElement = (type: string, apiObject: object): HTMLObjectElement => {
  const element = document.createElement("object");
  element.setAttribute("type", type);
  copyProperties(apiObject, element);
  return element;
};

const createAndInjectHbbTVObjects = () => {
  const objects = [
    {
      type: "application/oipfApplicationManager",
      api: createApplicationManager(),
    },
    {
      type: "application/oipfConfiguration",
      api: createOipfConfiguration(),
    },
    {
      type: "application/oipfCapabilities",
      api: createOipfCapabilities(),
    },
    {
      type: "video/broadcast",
      api: new VideoBroadcastObject(),
    },
  ];

  objects.forEach(({ type, api }) => {
    const element = createObjectElement(type, api);
    document.body.appendChild(element);
    console.log(`Injected HbbTV object: ${type}`, element);
  });
};

const onDOMContentLoaded = () => {
  createAndInjectHbbTVObjects();
};

export const initializeHbbTVAPI = () => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
  } else {
    onDOMContentLoaded();
  }
};
