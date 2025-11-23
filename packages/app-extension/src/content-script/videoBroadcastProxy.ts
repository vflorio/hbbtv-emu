/** biome-ignore-all lint/suspicious/noExplicitAny: ack */
import { VideoBroadcastObject } from "@hbb-emu/hbbtv-api";

export const createVideoBroadcastProxy = (objectElement: HTMLObjectElement) => {
  if (!objectElement.parentNode) return;

  const videoBroadcastObject = new VideoBroadcastObject();
  objectElement.parentNode.insertBefore(videoBroadcastObject.videoElement, objectElement.nextSibling);

  createStyleSynchronizer(objectElement, videoBroadcastObject.videoElement);
  proxyProperties(objectElement, videoBroadcastObject);
};

const proxyProperties = (objectElement: HTMLObjectElement, videoBroadcastObject: InstanceType<typeof VideoBroadcastObject>) => {
  const propertyNames = new Set<string>([
    ...Object.keys(videoBroadcastObject),
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(videoBroadcastObject)),
  ]);

  const proxyProperty = (key: string) => {
    if (key === "constructor" || key in objectElement) return;

    const descriptor =
      Object.getOwnPropertyDescriptor(videoBroadcastObject, key) ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(videoBroadcastObject), key);

    if (!descriptor) return;

    if (typeof descriptor.value === "function") {
      Object.defineProperty(objectElement, key, {
        value: (...args: unknown[]) => (videoBroadcastObject as any)[key](...args),
        writable: true,
        configurable: true,
      });
    } else {
      Object.defineProperty(objectElement, key, {
        get: () => (videoBroadcastObject as any)[key],
        set: (value: unknown) => {
          (videoBroadcastObject as any)[key] = value;
        },
        configurable: true,
      });
    }
  };

  propertyNames.forEach(proxyProperty);
};

const createStyleSynchronizer = (source: HTMLElement, target: HTMLElement) => {
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
