import {
  createApplicationManager,
  createOipfCapabilities,
  createOipfConfiguration,
  type OipfObjectType,
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
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import * as R from "fp-ts/Record";

export interface ObjectHandler {
  attachObject: (element: Element) => IO.IO<void>;
  videoBroadcastObjectRef: IORef.IORef<O.Option<VideoBroadcast>>;
}

const VideoBroadcastObject = compose(
  class {},
  WithPostMessageAdapter,
  WithMessageBus("CONTENT_SCRIPT"),
  WithVideoBroadcastObject,
);

const objectFactoryMap: Record<OipfObjectType, () => unknown> = {
  "application/oipfApplicationManager": createApplicationManager,
  "application/oipfConfiguration": createOipfConfiguration,
  "application/oipfCapabilities": createOipfCapabilities,
};

const insertAfter =
  (newNode: Node) =>
  (referenceNode: Node) =>
  (parent: ParentNode): IO.IO<void> =>
  () => {
    parent.insertBefore(newNode, referenceNode.nextSibling);
  };

export const WithObjectHandler = <T extends ClassType>(Base: T) =>
  class extends Base implements ObjectHandler {
    videoBroadcastObjectRef: IORef.IORef<O.Option<VideoBroadcast>> = IORef.newIORef<O.Option<VideoBroadcast>>(O.none)();

    attachObject = (element: Element): IO.IO<void> =>
      pipe(
        O.fromNullable(element.getAttribute("type")),
        O.match(
          () => IO.Do,
          (type) =>
            type === "video/broadcast" ? this.createVideoBroadcast(element) : this.createOipfObject(element, type),
        ),
      );

    createVideoBroadcast = (objectElement: Element): IO.IO<void> =>
      pipe(
        IO.of(O.fromNullable(objectElement.parentNode)),
        IO.flatMap(
          O.match(
            () => IO.Do,
            (parentNode) =>
              pipe(
                IO.of(new VideoBroadcastObject()),
                IO.tap((videoBroadcast) => this.videoBroadcastObjectRef.write(O.some(videoBroadcast))),
                IO.tap((videoBroadcast) => insertAfter(videoBroadcast.videoElement)(objectElement)(parentNode)),
                IO.tap((videoBroadcast) => new ObjectStyleMirror(objectElement, videoBroadcast.videoElement).start),
                IO.tap((videoBroadcast) => () => proxyProperties(objectElement, videoBroadcast)),
                IO.asUnit,
              ),
          ),
        ),
      );

    createOipfObject = (element: Element, type: string): IO.IO<void> =>
      pipe(
        IO.of(R.lookup(type)(objectFactoryMap)),
        IO.flatMap(
          O.match(
            () => IO.Do,
            (factory) => () => copyProperties(factory() as object, element),
          ),
        ),
      );
  };
