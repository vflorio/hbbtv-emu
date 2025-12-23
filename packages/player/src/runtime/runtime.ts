import { createLogger } from "@hbb-emu/core";
import * as B from "fp-ts/boolean";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import type * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { PlaybackType } from "../playback/types";
import type { PlayerState } from "../state/states";
import { NativeAdapter } from "./adapters/native";
import { initialState, reduce } from "./reducer";
import type {
  PlayerEffect,
  PlayerEvent,
  PlayerRuntimeError,
  PlayerRuntime as PlayerRuntimeI,
  PlayerStateListener,
  UnsubscribeFn,
} from "./types";

type AnyAdapter = NativeAdapter;

type RuntimeAdapter = {
  readonly type: PlaybackType;
  readonly name: string;
  mount: (videoElement: HTMLVideoElement) => IO.IO<void>;
  load: (url: string) => T.Task<void>;
  play: T.Task<void>;
  pause: T.Task<void>;
  seek: (time: number) => T.Task<void>;
  destroy: T.Task<void>;
  subscribe: (listener: (event: PlayerEvent) => void) => IO.IO<UnsubscribeFn>;
};

export class PlayerRuntime implements PlayerRuntimeI<PlayerState.Any> {
  private state: PlayerState.Any = initialState();
  private playbackType: O.Option<PlaybackType> = O.none;

  private videoElement: O.Option<HTMLVideoElement> = O.none;
  private adapter: O.Option<RuntimeAdapter> = O.none;
  private adapterUnsub: O.Option<UnsubscribeFn> = O.none;

  private listeners = new Set<PlayerStateListener<PlayerState.Any>>();

  private readonly logger = createLogger("PlayerRuntime");

  private eventQueue: PlayerEvent[] = [];
  private processing = false;

  getState: IO.IO<PlayerState.Any> = () => this.state;

  getPlaybackType: IOO.IOOption<PlaybackType> = () => this.playbackType;

  subscribe =
    (listener: PlayerStateListener<PlayerState.Any>): IO.IO<UnsubscribeFn> =>
    () => {
      this.listeners.add(listener);
      listener(this.state);
      return () => this.listeners.delete(listener);
    };

  mount = (videoElement: HTMLVideoElement): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      TE.right(videoElement),
      TE.tapIO((ve) => () => {
        this.videoElement = O.some(ve);
      }),
      TE.tapTask(() => this.dispatch({ _tag: "Engine/Mounted" })),
      TE.map(() => undefined),
    );

  destroy: TE.TaskEither<PlayerRuntimeError, void> = pipe(
    TE.fromIO(() => this.destroyAdapter()),
    TE.flatten,
    TE.tapIO(() => () => {
      this.listeners.clear();
    }),
  );

  dispatch =
    (event: PlayerEvent): T.Task<void> =>
    () => {
      this.eventQueue.push(event);
      return this.processQueue();
    };

  private notify: IO.IO<void> = () => {
    pipe(
      Array.from(this.listeners),
      RA.map((listener) => listener(this.state)),
      () => undefined,
    );
  };

  private processQueue: T.Task<void> = () =>
    pipe(
      this.processing,
      B.fold(
        () =>
          pipe(
            T.fromIO(() => {
              this.processing = true;
            }),
            T.flatMap(() => T.fromIO(this.processAllEvents)),
            T.tap(() =>
              T.fromIO(() => {
                this.processing = false;
              }),
            ),
          )(),
        T.of(undefined),
      ),
    );

  private processAllEvents: IO.IO<void> = () => {
    const processNext: T.Task<void> = () =>
      pipe(
        O.fromNullable(this.eventQueue.shift()),
        O.match(
          () => Promise.resolve(undefined), // queue empty -> done
          (event) =>
            pipe(
              // Reduce event
              T.fromIO(() => {
                const prev = this.state;
                const { next, effects } = reduce(prev, event);
                this.state = next;
                this.logger.debug("event", event._tag, "prev", prev._tag, "next", next._tag)();
                return effects;
              }),
              // Notify listeners
              T.tap(() => T.fromIO(this.notify)),
              // Execute effects
              T.flatMap((effects) => pipe(effects, RA.traverse(T.ApplicativeSeq)(this.runEffect))),
              // Recurse
              T.flatMap(() => processNext),
            )(),
        ),
      );

    return processNext();
  };

  private runEffect = (effect: PlayerEffect): TE.TaskEither<PlayerRuntimeError, void> =>
    match(effect)
      .with({ _tag: "Effect/DestroyAdapter" }, () => this.destroyAdapter())
      .with({ _tag: "Effect/CreateAdapter" }, ({ playbackType, url }) => this.createAdapter(playbackType, url))
      .with({ _tag: "Effect/AttachVideoElement" }, () => this.attachVideoElement())
      .with({ _tag: "Effect/LoadSource" }, ({ url }) => this.loadSource(url))
      .with({ _tag: "Effect/Play" }, () => this.playAdapter())
      .with({ _tag: "Effect/Pause" }, () => this.pauseAdapter())
      .with({ _tag: "Effect/Seek" }, ({ time }) => this.seekAdapter(time))
      .exhaustive();

  // Effect implementations
  private destroyAdapter = (): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      TE.right(undefined),
      TE.tapIO(() => () => {
        pipe(
          this.adapterUnsub,
          O.map((unsub) => unsub()),
        );
        this.adapterUnsub = O.none;
      }),
      TE.flatMap(() =>
        pipe(
          this.adapter,
          O.match(
            () => TE.right<PlayerRuntimeError, void>(undefined),
            (adapter) =>
              pipe(
                TE.right(undefined),
                TE.tapIO(() => () => {
                  this.adapter = O.none;
                  this.playbackType = O.none;
                }),
                TE.flatMap(() =>
                  pipe(
                    TE.tryCatch(
                      () => adapter.destroy(),
                      (cause): PlayerRuntimeError => ({
                        _tag: "RuntimeError/DestroyFailed",
                        message: "Adapter destroy failed",
                        cause,
                      }),
                    ),
                    TE.orElseFirstIOK((error) =>
                      this.logger.warn(
                        "destroy failed",
                        error.message,
                        error._tag === "RuntimeError/DestroyFailed" ? error.cause : undefined,
                      ),
                    ),
                  ),
                ),
              ),
          ),
        ),
      ),
    );

  private createAdapter = (playbackType: PlaybackType, url: string): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      TE.right(playbackType),
      TE.tapIO((pt) => () => {
        this.playbackType = O.some(pt);
      }),
      TE.flatMap((pt) => {
        if (pt !== "native") {
          return pipe(
            this.dispatch({
              _tag: "Engine/Error",
              kind: "not-supported",
              message: `Playback type not supported by runtime yet: ${pt}`,
              url,
            }),
            TE.rightTask,
          );
        }

        const adapter: AnyAdapter = new NativeAdapter();
        return pipe(
          TE.right(adapter as unknown as RuntimeAdapter),
          TE.tapIO((a) => () => {
            this.adapter = O.some(a);
            pipe(
              this.adapterUnsub,
              O.map((unsub) => unsub()),
            );
            this.adapterUnsub = O.some(a.subscribe((e: PlayerEvent) => this.dispatch(e)())());
          }),
          TE.map(() => undefined),
        );
      }),
    );

  private attachVideoElement = (): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      TE.fromOption(
        (): PlayerRuntimeError => ({
          _tag: "RuntimeError/NoAdapter",
          message: "No adapter to attach",
        }),
      )(this.adapter),
      TE.flatMap((adapter) =>
        pipe(
          TE.fromOption(
            (): PlayerRuntimeError => ({
              _tag: "RuntimeError/NoVideoElement",
              message: "No video element mounted",
            }),
          )(this.videoElement),
          TE.flatMap((ve) =>
            TE.tryCatch(
              () => Promise.resolve(adapter.mount(ve)()),
              (cause): PlayerRuntimeError => ({
                _tag: "RuntimeError/AttachFailed",
                message: "Attach failed",
                cause,
              }),
            ),
          ),
        ),
      ),
      TE.orElseFirstTaskK((error) =>
        this.dispatch({
          _tag: "Engine/Error",
          kind: "unknown",
          message: error.message,
          cause: "cause" in error ? error.cause : undefined,
        }),
      ),
    );

  private loadSource = (url: string): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      TE.fromOption(
        (): PlayerRuntimeError => ({
          _tag: "RuntimeError/NoAdapter",
          message: "No adapter to load source",
        }),
      )(this.adapter),
      TE.flatMap((adapter) =>
        pipe(
          TE.tryCatch(
            () => adapter.load(url)(),
            (cause): PlayerRuntimeError => ({
              _tag: "RuntimeError/AttachFailed",
              message: "Load failed",
              cause,
            }),
          ),
          TE.orElseFirstTaskK(() =>
            this.dispatch({
              _tag: "Engine/Error",
              kind: "network",
              message: "Load failed",
              url,
            }),
          ),
        ),
      ),
    );

  private playAdapter = (): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      this.adapter,
      O.match(
        () => TE.right<PlayerRuntimeError, void>(undefined),
        (adapter) =>
          pipe(
            TE.tryCatch(
              () => adapter.play(),
              (cause): PlayerRuntimeError => ({
                _tag: "RuntimeError/AttachFailed",
                message: "Play failed",
                cause,
              }),
            ),
            TE.orElseFirstTaskK(() =>
              this.dispatch({
                _tag: "Engine/Error",
                kind: "media",
                message: "Play failed",
              }),
            ),
          ),
      ),
    );

  private pauseAdapter = (): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      this.adapter,
      O.match(
        () => TE.right<PlayerRuntimeError, void>(undefined),
        (adapter) =>
          pipe(
            TE.tryCatch(
              () => adapter.pause(),
              (cause): PlayerRuntimeError => ({
                _tag: "RuntimeError/AttachFailed",
                message: "Pause failed",
                cause,
              }),
            ),
            TE.orElseFirstTaskK(() =>
              this.dispatch({
                _tag: "Engine/Error",
                kind: "media",
                message: "Pause failed",
              }),
            ),
          ),
      ),
    );

  private seekAdapter = (time: number): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      this.adapter,
      O.match(
        () => TE.right<PlayerRuntimeError, void>(undefined),
        (adapter) =>
          pipe(
            TE.tryCatch(
              () => adapter.seek(time)(),
              (cause): PlayerRuntimeError => ({
                _tag: "RuntimeError/AttachFailed",
                message: "Seek failed",
                cause,
              }),
            ),
            TE.orElseFirstTaskK(() =>
              this.dispatch({
                _tag: "Engine/Error",
                kind: "media",
                message: "Seek failed",
              }),
            ),
          ),
      ),
    );
}
