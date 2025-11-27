import {
  createApplicationManager,
  createOipfCapabilities,
  createOipfConfiguration,
  WithVideoBroadcastObject,
} from "@hbb-emu/hbbtv-api";
import { type ClassType, compose, copyProperties, ObjectStyleMirror, proxyProperties } from "@hbb-emu/lib";
import { WithContentScriptMessageBus } from "./messageBus";

export interface ObjectHandler {
  attachObject: (element: HTMLObjectElement) => void;
}

const VideoBroadcastObject = compose(class {}, WithContentScriptMessageBus, WithVideoBroadcastObject);

export const WithObjectHandler = <T extends ClassType>(Base: T) =>
  class extends Base implements ObjectHandler {
    attachObject = (element: HTMLObjectElement) => {
      const type = element.getAttribute("type");
      if (!type) return;

      if (type === "video/broadcast") {
        this.createVideoBroadcast(element);
        return;
      }

      const object = this.createObject(type);
      if (!object) return;

      copyProperties(object, element);
    };

    private createVideoBroadcast = (objectElement: HTMLObjectElement) => {
      if (!objectElement.parentNode) return;

      const videoBroadcastObject = new VideoBroadcastObject();
      objectElement.parentNode.insertBefore(videoBroadcastObject.videoElement, objectElement.nextSibling);

      new ObjectStyleMirror(objectElement, videoBroadcastObject.videoElement);
      proxyProperties(objectElement, videoBroadcastObject);
    };

    private createObject = (type: string) => {
      const objectMap: Record<string, () => unknown> = {
        "application/oipfApplicationManager": createApplicationManager,
        "application/oipfConfiguration": createOipfConfiguration,
        "application/oipfCapabilities": createOipfCapabilities,
      };

      return objectMap[type]?.();
    };
  };
