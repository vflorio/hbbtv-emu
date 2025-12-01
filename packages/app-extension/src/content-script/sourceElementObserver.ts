import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as IORef from "fp-ts/IORef";
import * as NEA from "fp-ts/NonEmptyArray";
import * as O from "fp-ts/Option";
import { querySelectorAll } from "fp-ts-std/DOM";

const logger = createLogger("SourceElementObserver");

const DASH_MIME_TYPE = "application/dash+xml";

const isSource = (element: Element): element is HTMLSourceElement =>
  element instanceof HTMLSourceElement && element.type === DASH_MIME_TYPE;

const getParentVideo = (source: HTMLSourceElement): HTMLVideoElement | null => source.closest("video");

const toSource = (element: HTMLSourceElement): Source => ({
  element,
  src: element.src,
  parentVideo: getParentVideo(element),
});

const extractSources = (mutations: MutationRecord[]): Source[] =>
  pipe(
    mutations,
    A.flatMap((mutation) => Array.from(mutation.addedNodes)),
    A.filter((node): node is Element => node instanceof Element),
    A.flatMap((element) => [element, ...Array.from(element.querySelectorAll("source"))]),
    A.filter(isSource),
    A.map(toSource),
  );

const scanExistingSources: IOO.IOOption<NEA.NonEmptyArray<Source>> = pipe(
  querySelectorAll(`source[type="${DASH_MIME_TYPE}"]`)(document),
  IOO.map(NEA.filter(isSource)),
  IOO.flatMap(IOO.fromOption),
  IOO.map(NEA.map(toSource)),
);

export interface Source {
  element: HTMLSourceElement;
  src: string;
  parentVideo: HTMLVideoElement | null;
}

export type SourceListener = (source: Source) => void;

export interface SourceElementObserver {
  sourceObserverRef: IORef.IORef<O.Option<MutationObserver>>;
  startSourceObserver: (onSourceDetected: SourceListener) => IO.IO<void>;
  stopSourceObserver: IO.IO<void>;
}

export const WithSourceElementObserver = <T extends ClassType>(Base: T) =>
  class extends Base implements SourceElementObserver {
    sourceObserverRef: IORef.IORef<O.Option<MutationObserver>> = IORef.newIORef<O.Option<MutationObserver>>(O.none)();

    handleMutations =
      (onSourceDetected: SourceListener) =>
      (mutations: MutationRecord[]): IO.IO<void> =>
        pipe(
          IO.of(extractSources(mutations)),
          IO.flatMap(
            A.traverse(IO.Applicative)((source) =>
              pipe(
                logger.info("DASH source detected", { src: source.src }),
                IO.tap(() => () => onSourceDetected(source)),
              ),
            ),
          ),
          IO.asUnit,
        );

    scanSources = (onSourceDetected: SourceListener): IO.IO<void> =>
      pipe(
        scanExistingSources,
        IOO.flatMap((sources) =>
          pipe(
            sources,
            A.traverse(IO.Applicative)((source) =>
              pipe(
                logger.info("dash source found", { src: source.src }),
                IO.tap(() => () => onSourceDetected(source)),
              ),
            ),
            IO.map(() => O.some(undefined)),
          ),
        ),
        IOO.getOrElse(() => IO.of(undefined)),
      );

    startSourceObserver = (onSourceDetected: SourceListener): IO.IO<void> =>
      pipe(
        this.sourceObserverRef.read,
        IO.flatMap(
          O.match(
            () =>
              pipe(
                logger.info("starting"),
                IO.flatMap(() =>
                  pipe(
                    IO.of(new MutationObserver((mutations) => this.handleMutations(onSourceDetected)(mutations)())),
                    IO.tap((observer) => () => {
                      observer.observe(document.documentElement, {
                        childList: true,
                        subtree: true,
                      });
                    }),
                    IO.flatMap((observer) => this.sourceObserverRef.write(O.some(observer))),
                  ),
                ),
                IO.flatMap(() => this.scanSources(onSourceDetected)),
              ),
            () => logger.info("already running"),
          ),
        ),
      );

    stopSourceObserver: IO.IO<void> = pipe(
      this.sourceObserverRef.read,
      IO.flatMap(
        O.match(
          () => logger.info("not running"),
          (observer) =>
            pipe(
              logger.info("stopping"),
              IO.tap(() => () => observer.disconnect()),
              IO.flatMap(() => this.sourceObserverRef.write(O.none)),
            ),
        ),
      ),
    );
  };
