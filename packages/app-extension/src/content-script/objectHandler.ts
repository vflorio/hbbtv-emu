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
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as R from "fp-ts/Record";

export namespace ObjectHandler {
  export interface Contract {
    attachObject: AttachObject;
    videoBroadcastObject: O.Option<VideoBroadcast>;
    onVideoBroadcastCreated?: OnVideoBroadcastCreated;
  }

  export type AttachObject = (element: Element) => IO.IO<void>;
  export type OnVideoBroadcastCreated = (obj: VideoBroadcast) => void;
}

const VideoBroadcastObject = compose(
  class {},
  WithPostMessageAdapter,
  WithMessageBus("CONTENT_SCRIPT"),
  WithVideoBroadcastObject,
);

type OipfObjectType =
  | "application/oipfApplicationManager"
  | "application/oipfConfiguration"
  | "application/oipfCapabilities";

const objectFactoryMap: Record<OipfObjectType, () => unknown> = {
  "application/oipfApplicationManager": createApplicationManager,
  "application/oipfConfiguration": createOipfConfiguration,
  "application/oipfCapabilities": createOipfCapabilities,
};

export const WithObjectHandler = <T extends ClassType>(Base: T) =>
  class extends Base implements ObjectHandler.Contract {
    videoBroadcastObject: O.Option<VideoBroadcast> = O.none;
    onVideoBroadcastCreated?: ObjectHandler.OnVideoBroadcastCreated;

    // biome-ignore format: ack
    attachObject: ObjectHandler.AttachObject = (element) =>
      pipe(
        O.fromNullable(element.getAttribute("type")),
        O.match(() => IO.of(undefined), (type) =>
          type === "video/broadcast" 
            ? this.createVideoBroadcast(element) 
            : this.createOipfObject(element, type),
        ),
      );

    private createVideoBroadcast =
      (objectElement: Element): IO.IO<void> =>
      () =>
        pipe(
          O.fromNullable(objectElement.parentNode),
          O.match(
            () => {},
            (parentNode) => {
              const videoBroadcast = new VideoBroadcastObject();
              this.videoBroadcastObject = O.some(videoBroadcast);

              parentNode.insertBefore(videoBroadcast.videoElement, objectElement.nextSibling);

              const objectStyleMirror = new ObjectStyleMirror(objectElement, videoBroadcast.videoElement);
              objectStyleMirror.start();

              proxyProperties(objectElement, videoBroadcast);

              pipe(
                O.fromNullable(this.onVideoBroadcastCreated),
                O.map((callback) => callback(videoBroadcast)),
              );
            },
          ),
        );

    private createOipfObject =
      (element: Element, type: string): IO.IO<void> =>
      () =>
        pipe(
          objectFactoryMap,
          R.lookup(type),
          O.match(
            () => {},
            (factory) => copyProperties(factory() as object, element),
          ),
        );
  };
