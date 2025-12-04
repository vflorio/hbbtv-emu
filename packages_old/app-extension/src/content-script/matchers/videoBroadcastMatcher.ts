import { type VideoBroadcastObject as VideoBroadcast, WithVideoBroadcastObject } from "@hbb-emu/hbbtv-api";
import { compose, ObjectStyleMirror, proxyProperties, WithMessageBus, WithPostMessageAdapter } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type { ElementMatcher } from "../elementMatcher";

export interface VideoBroadcastElement {
  element: HTMLObjectElement;
  parentNode: ParentNode;
}

const VideoBroadcastObject = compose(
  class {},
  WithPostMessageAdapter,
  WithMessageBus("CONTENT_SCRIPT"),
  WithVideoBroadcastObject,
);

const VIDEO_BROADCAST_TYPE = "video/broadcast";

const isVideoBroadcastObject = (element: Element): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.getAttribute("type") === VIDEO_BROADCAST_TYPE;

const toVideoBroadcastElement = (element: HTMLObjectElement): O.Option<VideoBroadcastElement> =>
  pipe(
    O.fromNullable(element.parentNode),
    O.map((parentNode) => ({ element, parentNode })),
  );

const insertAfter =
  (newNode: Node) =>
  (referenceNode: Node) =>
  (parent: ParentNode): IO.IO<void> =>
  () => {
    parent.insertBefore(newNode, referenceNode.nextSibling);
  };

const createVideoBroadcastHandler =
  (videoBroadcastRef: IORef.IORef<O.Option<VideoBroadcast>>) =>
  (vb: VideoBroadcastElement): IO.IO<void> =>
    pipe(
      IO.of(new VideoBroadcastObject()),
      IO.tap((videoBroadcast) => videoBroadcastRef.write(O.some(videoBroadcast))),
      IO.tap((videoBroadcast) => insertAfter(videoBroadcast.videoElement)(vb.element)(vb.parentNode)),
      IO.tap((videoBroadcast) => new ObjectStyleMirror(vb.element, videoBroadcast.videoElement).start),
      IO.tap((videoBroadcast) => () => proxyProperties(vb.element, videoBroadcast)),
      IO.asUnit,
    );

export const createVideoBroadcastMatcher = (
  videoBroadcastRef: IORef.IORef<O.Option<VideoBroadcast>>,
): ElementMatcher<HTMLObjectElement, O.Option<VideoBroadcastElement>> => ({
  name: "VideoBroadcast",
  selector: `object[type="${VIDEO_BROADCAST_TYPE}"]`,
  predicate: isVideoBroadcastObject,
  transform: toVideoBroadcastElement,
  onDetected: O.match(() => IO.of(undefined), createVideoBroadcastHandler(videoBroadcastRef)),
});
