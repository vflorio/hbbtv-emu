import { createLogger } from "@hbb-emu/core";
import * as B from "fp-ts/boolean";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
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
  ReduceResult,
  RuntimeAdapter,
  UnsubscribeFn,
} from "./types";

export class PlayerRuntime implements PlayerRuntimeI<PlayerState.Any> {
  private state: PlayerState.Any = initialState();
  private playbackType: O.Option<PlaybackType> = O.none;

  private videoElement: O.Option<HTMLVideoElement> = O.none;
  private adapter: O.Option<RuntimeAdapter> = O.none;
  private adapterUnsubscribe: O.Option<UnsubscribeFn> = O.none;

  private listeners = new Set<PlayerStateListener<PlayerState.Any>>();

  private readonly logger = createLogger("PlayerRuntime");

  private eventQueue: PlayerEvent[] = [];
  private processing = false;

  getState: IO.IO<PlayerState.Any> = () => this.state;

  getPlaybackType: IOO.IOOption<PlaybackType> = () => this.playbackType;

  mount = (videoElement: HTMLVideoElement): T.Task<void> =>
    pipe(
      T.of(undefined),
      T.tapIO(() => () => {
        this.videoElement = O.some(videoElement);
      }),
      T.tap(() => this.dispatch({ _tag: "Engine/Mounted" })),
    );

  destroy: TE.TaskEither<PlayerRuntimeError, void> = pipe(
    TE.Do,
    TE.flatMap(() => this.destroyAdapter()),
    TE.tapIO(() => () => {
      this.listeners.clear();
    }),
  );

  subscribe =
    (listener: PlayerStateListener<PlayerState.Any>): IO.IO<UnsubscribeFn> =>
    () => {
      this.listeners.add(listener);
      listener(this.state);
      return () => this.listeners.delete(listener);
    };

  dispatch = (event: PlayerEvent): T.Task<void> =>
    pipe(
      T.fromIO(() => {
        this.eventQueue.push(event);
      }),
      T.flatMap(() => this.processQueue),
    );

  private processQueue: T.Task<void> = () => {
    const setProcessing =
      (next: boolean): IO.IO<void> =>
      () => {
        this.processing = next;
      };

    const processAll = pipe(
      T.fromIO(setProcessing(true)),
      T.flatMap(() => T.fromIO(this.processAllEvents)),
      T.tap(() => T.fromIO(setProcessing(false))),
    );

    return pipe(
      T.of(this.processing),
      T.flatMap(
        B.match(
          () => processAll,
          () => T.of(undefined),
        ),
      ),
    )();
  };

  private processAllEvents: IO.IO<void> = () => {
    const reduceState = (playerEvent: PlayerEvent): IO.IO<ReduceResult<PlayerState.Any>> =>
      pipe(
        IO.of(playerEvent),
        IO.map(reduce(this.state)),
        IO.tap(({ next }) =>
          this.logger.info(`Runtime state transition: ${this.state._tag} -> ${next._tag}`, playerEvent),
        ),
      );

    const notify = (state: PlayerState.Any): IO.IO<void> =>
      pipe(
        Array.from(this.listeners),
        RA.traverse(IO.Applicative)((listener) => IO.of(listener(state))),
      );

    const runEffect = (effect: PlayerEffect): TE.TaskEither<PlayerRuntimeError, void> =>
      pipe(
        TE.Do,
        TE.tapIO(() => this.logger.info(`Running effect: ${effect._tag}`)),
        TE.flatMap(() =>
          match(effect)
            .with({ _tag: "Effect/CreateAdapter" }, ({ playbackType }) => this.createAdapter(playbackType))
            .with({ _tag: "Effect/DestroyAdapter" }, () => this.destroyAdapter())
            .with({ _tag: "Effect/AttachVideoElement" }, () => this.attachVideoElement())
            .with({ _tag: "Effect/LoadSource" }, ({ url }) => this.loadSource(url))
            .with({ _tag: "Effect/Play" }, () => this.playAdapter())
            .with({ _tag: "Effect/Pause" }, () => this.pauseAdapter())
            .with({ _tag: "Effect/Seek" }, ({ time }) => this.seekAdapter(time))
            .exhaustive(),
        ),
      );

    const runEffectBestEffort = (effect: PlayerEffect): T.Task<void> =>
      pipe(
        runEffect(effect),
        TE.matchE(
          (error) =>
            effect._tag === "Effect/DestroyAdapter"
              ? T.fromIO(this.logger.warn("Effect failed (ignored)", { effect, error }))
              : pipe(
                  T.fromIO(this.logger.error("Effect failed", { effect, error })),
                  T.flatMap(() => this.dispatch(error)),
                ),
          () => T.of(undefined),
        ),
      );

    const processNext: T.Task<void> = pipe(
      T.fromIO(() => O.fromNullable(this.eventQueue.shift())),
      T.flatMap(
        O.match(
          () => T.of(undefined),
          (playerEvent) =>
            pipe(
              T.fromIO(reduceState(playerEvent)),
              T.tapIO(({ next }) => () => {
                this.state = next;
              }),
              T.tapIO(({ next }) => notify(next)),
              T.flatMap(({ effects }) =>
                pipe(
                  effects,
                  RA.traverse(T.ApplicativeSeq)(runEffectBestEffort),
                  T.map(() => undefined),
                ),
              ),
              T.flatMap(() => processNext),
            ),
        ),
      ),
    );

    return processNext();
  };

  // Adapter effects

  private createAdapter = (playbackType: PlaybackType): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      TE.right(new NativeAdapter() satisfies RuntimeAdapter), // FIXME: Adapter selection logic
      TE.tapIO(() => () => {
        this.playbackType = O.some(playbackType);
      }),
      TE.filterOrElse(
        (adapter) => playbackType === adapter.type,
        () => ({
          _tag: "RuntimeError/NoAdapter" as const,
          message: `No adapter found for playback type: ${playbackType}`,
        }),
      ),
      TE.tapIO((adapter) => () => {
        this.adapter = O.some(adapter);
        this.adapterUnsubscribe = O.some(adapter.subscribe((event) => this.dispatch(event)())());
      }),
      TE.asUnit,
    );

  private adapterFailure = (
    operation: Extract<PlayerRuntimeError, { _tag: "RuntimeError/AdapterFailure" }>["operation"],
    message: string,
    cause?: unknown,
  ): PlayerRuntimeError => ({
    _tag: "RuntimeError/AdapterFailure",
    operation,
    message,
    cause,
  });

  private destroyAdapter = (): TE.TaskEither<PlayerRuntimeError, void> => {
    const notifyAndUnsub = pipe(
      TE.fromIO(() => this.adapterUnsubscribe),
      TE.tapIO(
        O.match(
          () => IO.of(undefined),
          (unsub) => () => {
            unsub();
            this.adapterUnsubscribe = O.none;
          },
        ),
      ),
    );

    return pipe(
      notifyAndUnsub,
      TE.flatMap(() => TE.fromIO(() => this.adapter)),
      TE.flatMap(
        O.match(
          () => TE.right(undefined),
          (adapter) =>
            pipe(
              TE.tryCatch(
                () => adapter.destroy(),
                (cause) => this.adapterFailure("destroy", "Adapter destroy failed", cause),
              ),
              TE.matchE(
                (error) =>
                  pipe(
                    TE.fromIO(() => {
                      this.adapter = O.none;
                      this.playbackType = O.none;
                    }),
                    TE.flatMap(() => TE.left(error)),
                  ),
                () =>
                  pipe(
                    TE.fromIO(() => {
                      this.adapter = O.none;
                      this.playbackType = O.none;
                    }),
                    TE.map(() => undefined),
                  ),
              ),
            ),
        ),
      ),
    );
  };

  private attachVideoElement = () =>
    pipe(
      TE.Do,
      TE.bind("videoElement", () =>
        pipe(
          this.videoElement,
          TE.fromOption<PlayerRuntimeError>(() => ({
            _tag: "RuntimeError/NoVideoElement" as const,
            message: "No video element mounted",
          })),
        ),
      ),
      TE.bind("adapter", () =>
        pipe(
          this.adapter,
          TE.fromOption<PlayerRuntimeError>(() => ({
            _tag: "RuntimeError/NoAdapter" as const,
            message: "No adapter to attach",
          })),
        ),
      ),
      TE.flatMap(({ adapter, videoElement }) =>
        TE.tryCatch(
          async () => {
            adapter.mount(videoElement)();
          },
          (cause) => this.adapterFailure("mount", "Adapter mount failed", cause),
        ),
      ),
    );

  private getAdapter = (): TE.TaskEither<PlayerRuntimeError, RuntimeAdapter> =>
    pipe(
      this.adapter,
      TE.fromOption<PlayerRuntimeError>(() => ({
        _tag: "RuntimeError/NoAdapter",
        message: "No adapter available",
      })),
    );

  private loadSource = (url: string): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      this.getAdapter(),
      TE.flatMap((adapter) =>
        TE.tryCatch(
          () => adapter.load(url)(),
          (cause) => this.adapterFailure("load", "Adapter load failed", cause),
        ),
      ),
    );

  private playAdapter = (): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      this.getAdapter(),
      TE.flatMap((adapter) =>
        TE.tryCatch(
          () => adapter.play(),
          (cause) => this.adapterFailure("play", "Adapter play failed", cause),
        ),
      ),
    );

  private pauseAdapter = (): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      this.getAdapter(),
      TE.flatMap((adapter) =>
        TE.tryCatch(
          () => adapter.pause(),
          (cause) => this.adapterFailure("pause", "Adapter pause failed", cause),
        ),
      ),
    );

  private seekAdapter = (time: number): TE.TaskEither<PlayerRuntimeError, void> =>
    pipe(
      this.getAdapter(),
      TE.flatMap((adapter) =>
        TE.tryCatch(
          () => adapter.seek(time)(),
          (cause) => this.adapterFailure("seek", "Adapter seek failed", cause),
        ),
      ),
    );
}
