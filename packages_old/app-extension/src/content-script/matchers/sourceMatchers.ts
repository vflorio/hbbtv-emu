import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { ElementMatcher } from "../elementMatcher";

export interface DashSource {
  element: HTMLSourceElement;
  src: string;
  parentVideo: HTMLVideoElement | null;
}

export type SourceListener = (source: DashSource) => void;

const DASH_MIME_TYPE = "application/dash+xml";

const isDashSource = (element: Element): element is HTMLSourceElement =>
  element instanceof HTMLSourceElement && element.type === DASH_MIME_TYPE;

const getParentVideo = (source: HTMLSourceElement): HTMLVideoElement | null => source.closest("video");

const toDashSource = (element: HTMLSourceElement): DashSource => ({
  element,
  src: element.src,
  parentVideo: getParentVideo(element),
});

export const createDashSourceMatcher = (
  onSourceDetected: SourceListener,
): ElementMatcher<HTMLSourceElement, DashSource> => ({
  name: "DashSource",
  selector: `source[type="${DASH_MIME_TYPE}"]`,
  predicate: isDashSource,
  transform: toDashSource,
  onDetected: (source: DashSource) =>
    pipe(
      IO.of(undefined),
      IO.tap(() => () => onSourceDetected(source)),
    ),
});
