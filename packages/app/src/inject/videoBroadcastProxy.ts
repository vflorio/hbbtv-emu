/** biome-ignore-all lint/suspicious/noExplicitAny: ack */
import type { VideoBroadcastObject } from "@hbb-emu/hbbtv-api";

export const createVideoBroadcastProxy = (objectElement: HTMLObjectElement): VideoBroadcastObject => {
  const videoElement = document.createElement("video", { is: "video-broadcast" }) as VideoBroadcastObject;

  objectElement.parentNode?.insertBefore(videoElement, objectElement.nextSibling);
  syncStyles(objectElement, videoElement);
  objectElement.style.display = "none";

  proxyProperties(objectElement, videoElement);
  return videoElement;
};

const proxyProperties = (objectElement: HTMLObjectElement, videoElement: VideoBroadcastObject) => {
  const propertyNames = new Set<string>([
    ...Object.keys(videoElement),
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(videoElement)),
  ]);

  for (const key of propertyNames) {
    if (key === "constructor" || key in objectElement) continue;

    const descriptor =
      Object.getOwnPropertyDescriptor(videoElement, key) ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(videoElement), key);

    if (!descriptor) continue;

    if (typeof descriptor.value === "function") {
      Object.defineProperty(objectElement, key, {
        value: (...args: unknown[]) => (videoElement as any)[key](...args),
        writable: true,
        configurable: true,
      });
    } else {
      Object.defineProperty(objectElement, key, {
        get: () => (videoElement as any)[key],
        set: (value: unknown) => {
          (videoElement as any)[key] = value;
        },
        configurable: true,
      });
    }
  }
};

const syncStyles = (source: HTMLElement, target: HTMLElement) => {
  const copyStyle = () => {
    const styleAttr = source.getAttribute("style");
    if (styleAttr) target.setAttribute("style", styleAttr);
  };

  copyStyle();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "style") {
        copyStyle();
      }
    }
  });

  observer.observe(source, { attributes: true, attributeFilter: ["style"] });
};
