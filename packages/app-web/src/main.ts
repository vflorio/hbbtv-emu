import {
  createApplicationManager,
  createOipfCapabilities,
  createOipfConfiguration,
  WithVideoBroadcastObject,
} from "@hbb-emu/hbbtv-api";

import { compose, copyProperties, WithDebugMessageAdapter, WithMessageBus } from "@hbb-emu/lib";

const createObjectElement = (type: string, apiObject: object): HTMLObjectElement => {
  const element = document.createElement("object");
  element.setAttribute("type", type);
  copyProperties(apiObject, element);
  return element;
};

const VideoBroadcastObject = compose(
  class {},
  WithDebugMessageAdapter,
  WithMessageBus("CONTENT_SCRIPT"),
  WithVideoBroadcastObject,
);

const inject = () => {
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inject);
} else {
  inject();
}
