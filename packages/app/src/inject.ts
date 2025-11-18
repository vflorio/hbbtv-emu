import {
  createApplicationManager,
  createObjectFactory,
  createOipf,
  createOipfCapabilities,
  createOipfConfiguration,
  VideoBroadcastObject,
} from "@hbb-emu/hbbtv-api";

customElements.define("video-broadcast", VideoBroadcastObject, { extends: "video" });

const objectTypeMap: Record<string, unknown> = {
  //"video/broadcast": () => window.oipfObjectFactory?.createVideoBroadcastObject(),
  "application/oipfApplicationManager": createApplicationManager(),
  "application/oipfConfiguration": createOipfConfiguration(),
  "application/oipfCapabilities": createOipfCapabilities(),
};

const attachObjectElement = (objectElement: HTMLObjectElement) => {
  const type = objectElement.getAttribute("type");
  if (!type || !objectTypeMap[type]) {
    return;
  }

  const apiObject = objectTypeMap[type];
  if (!apiObject) {
    return;
  }

  // Copy properties from the API object to the <object> element
  Object.keys(apiObject).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(apiObject, key);
    if (descriptor) {
      Object.defineProperty(objectElement, key, descriptor);
    }
  });

  // Also copy prototype methods
  const proto = Object.getPrototypeOf(apiObject);
  if (proto) {
    Object.getOwnPropertyNames(proto).forEach((key) => {
      if (key !== "constructor") {
        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        if (descriptor && !(key in objectElement)) {
          Object.defineProperty(objectElement, key, descriptor);
        }
      }
    });
  }
};

const processObjects = (context: Document | HTMLElement) =>
  Array.from(context.querySelectorAll<HTMLObjectElement>("object")).forEach(attachObjectElement);

const observer = new MutationObserver((mutations) => {
  mutations
    .flatMap((mutation) => mutation.addedNodes)
    .forEach((node) => {
      if (node instanceof HTMLObjectElement) {
        attachObjectElement(node);
      } else if (node instanceof HTMLElement) {
        processObjects(node);
      }
    });
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    processObjects(document);
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  processObjects(document);
  observer.observe(document.body, { childList: true, subtree: true });
}
