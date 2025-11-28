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

export interface ObjectHandler {
  attachObject: (element: HTMLObjectElement) => IO.IO<void>;
  videoBroadcastObject: O.Option<VideoBroadcast>;
  onVideoBroadcastCreated?: (obj: VideoBroadcast) => void;
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
  class extends Base implements ObjectHandler {
    videoBroadcastObject: O.Option<VideoBroadcast> = O.none;
    onVideoBroadcastCreated?: (obj: VideoBroadcast) => void;

    // biome-ignore format: ack
    attachObject = (element: HTMLObjectElement): IO.IO<void> =>
      pipe(
        O.fromNullable(element.getAttribute("type")),
        O.match(() => IO.of(undefined), (type) =>
          type === "video/broadcast" 
            ? this.createVideoBroadcast(element) 
            : this.createOipfObject(element, type),
        ),
      );

    private createVideoBroadcast =
      (objectElement: HTMLObjectElement): IO.IO<void> =>
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
      (element: HTMLObjectElement, type: string): IO.IO<void> =>
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
