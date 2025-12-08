import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import { createLogger } from "./logger";
import type { ClassType } from "./mixin";

const logger = createLogger("DomObserver");

export type MutationHandler = (mutations: MutationRecord[]) => IO.IO<void>;

export interface DomObserver {
  observerRef: IORef.IORef<O.Option<MutationObserver>>;
  handlersRef: IORef.IORef<MutationHandler[]>;
  registerHandler: (handler: MutationHandler) => IO.IO<void>;
  unregisterHandler: (handler: MutationHandler) => IO.IO<void>;
  startObserver: IO.IO<void>;
  stopObserver: IO.IO<void>;
}

export const WithDomObserver = <T extends ClassType>(Base: T) =>
  class extends Base implements DomObserver {
    observerRef: IORef.IORef<O.Option<MutationObserver>> = IORef.newIORef<O.Option<MutationObserver>>(O.none)();
    handlersRef: IORef.IORef<MutationHandler[]> = IORef.newIORef<MutationHandler[]>([])();

    handleMutations = (mutations: MutationRecord[]): IO.IO<void> =>
      pipe(this.handlersRef.read, IO.flatMap(A.traverse(IO.Applicative)((handler) => handler(mutations))), IO.asUnit);

    registerHandler = (handler: MutationHandler): IO.IO<void> =>
      pipe(
        this.handlersRef.read,
        IO.map((handlers) => [...handlers, handler]),
        IO.flatMap((handlers) => this.handlersRef.write(handlers)),
      );

    unregisterHandler = (handler: MutationHandler): IO.IO<void> =>
      pipe(
        this.handlersRef.read,
        IO.map(A.filter((h) => h !== handler)),
        IO.flatMap((handlers) => this.handlersRef.write(handlers)),
      );

    startObserver: IO.IO<void> = pipe(
      this.observerRef.read,
      IO.flatMap(
        O.match(
          () =>
            pipe(
              logger.info("starting"),
              IO.flatMap(() =>
                pipe(
                  IO.of(new MutationObserver((mutations) => this.handleMutations(mutations)())),
                  IO.tap((observer) => () => {
                    observer.observe(document.documentElement, {
                      childList: true,
                      subtree: true,
                    });
                  }),
                  IO.flatMap((observer) => this.observerRef.write(O.some(observer))),
                ),
              ),
            ),
          () => logger.info("already running"),
        ),
      ),
    );

    stopObserver: IO.IO<void> = pipe(
      this.observerRef.read,
      IO.flatMap(
        O.match(
          () => logger.info("not running"),
          (observer) =>
            pipe(
              logger.info("stopping"),
              IO.tap(() => () => observer.disconnect()),
              IO.flatMap(() => this.observerRef.write(O.none)),
            ),
        ),
      ),
    );
  };
