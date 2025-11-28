import {
  createApplicationManager,
  createOipfCapabilities,
  createOipfConfiguration,
  type VideoBroadcastObject as VideoBroadcast,
  WithVideoBroadcastObject,
} from "@hbb-emu/hbbtv-api";
import {
  type ClassType,
  compose,
  copyProperties,
  ObjectStyleMirror,
  proxyProperties,
  WithMessageBus,
  WithPostMessageAdapter,
} from "@hbb-emu/lib";

export interface ObjectHandler {
  attachObject: (element: HTMLObjectElement) => void;
  videoBroadcastObject: VideoBroadcast | null;
  onVideoBroadcastCreated?: (obj: VideoBroadcast) => void;
}

const VideoBroadcastObject = compose(
  class {},
  WithPostMessageAdapter,
  WithMessageBus("CONTENT_SCRIPT"),
  WithVideoBroadcastObject,
);

export const WithObjectHandler = <T extends ClassType>(Base: T) =>
  class extends Base implements ObjectHandler {
    videoBroadcastObject: VideoBroadcast | null = null;

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

      this.videoBroadcastObject = new VideoBroadcastObject();

      objectElement.parentNode.insertBefore(this.videoBroadcastObject.videoElement, objectElement.nextSibling);

      new ObjectStyleMirror(objectElement, this.videoBroadcastObject.videoElement);
      proxyProperties(objectElement, this.videoBroadcastObject);
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
