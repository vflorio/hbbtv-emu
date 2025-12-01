import {
  type App,
  type ClassType,
  compose,
  createEnvelope,
  createLogger,
  DEFAULT_HBBTV_CONFIG,
  type ExtensionConfig,
  initApp,
  type MessageAdapter,
  type MessageBus,
  WithChromeMessageAdapter,
  WithMessageBus,
} from "@hbb-emu/lib";
import { Settings } from "@hbb-emu/ui";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { querySelector } from "fp-ts-std/DOM";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = createLogger("SidePanel");

const WithSidePanel = <T extends ClassType<MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    stateRef = IORef.newIORef(DEFAULT_HBBTV_CONFIG)();
    rootRef = IORef.newIORef<Root | null>(null)();
    configLoaded = false;

    init: IO.IO<void> = pipe(
      logger.info("Initializing"),
      IO.tap(() => this.subscribe),
      IO.tap(() => this.initializeRoot),
      IO.tap(() => this.requestConfig),
      IO.tap(() => logger.info("Initialized")),
    );

    requestConfig: IO.IO<void> = pipe(
      this.messageOrigin.read,
      IO.map((origin) => createEnvelope(origin, "BACKGROUND_SCRIPT", { type: "GET_CONFIG", payload: null })),
      IO.flatMap((envelope) => () => this.sendMessage(envelope)()),
    );

    initializeRoot: IO.IO<void> = pipe(
      document,
      querySelector("#root"),
      IOO.matchE(
        () => logger.error("Root element not found"),
        (rootElement) =>
          pipe(
            logger.info("Creating React root"),
            IO.flatMap(() =>
              pipe(
                IO.of(createRoot(rootElement)),
                IO.tap((root) => this.rootRef.write(root)),
                IO.flatMap((root) => this.render(root)),
              ),
            ),
          ),
      ),
    );

    subscribe: IO.IO<void> = () =>
      this.bus.on("UPDATE_CONFIG", (envelope) =>
        pipe(
          logger.info("Received config update", envelope.message.payload),
          IO.tap(() => this.stateRef.write(envelope.message.payload)),
          IO.tap(() => () => {
            const root = this.rootRef.read();
            if (root) {
              this.render(root)();
            }
          }),
        ),
      );

    updateState = (updater: (state: ExtensionConfig.State) => ExtensionConfig.State): T.Task<void> =>
      pipe(
        T.fromIO(this.stateRef.read),
        T.map(updater),
        T.tap((newState) => T.fromIO(this.stateRef.write(newState))),
        T.flatMap(() => this.notify),
      );

    notify: T.Task<void> = pipe(
      T.Do,
      T.bind("state", () => T.fromIO(this.stateRef.read)),
      T.bind("origin", () => T.fromIO(this.messageOrigin.read)),
      T.map(({ state, origin }) =>
        createEnvelope(origin, "BACKGROUND_SCRIPT", {
          type: "UPDATE_CONFIG",
          payload: state,
        }),
      ),
      T.flatMap((envelope) =>
        pipe(
          this.sendMessage(envelope),
          TE.match(
            () => undefined,
            () => undefined,
          ),
        ),
      ),
    );

    upsertInArray = <T extends { id: string }>(items: T[], item: T): T[] =>
      pipe(
        items,
        A.findIndex((i) => i.id === item.id),
        O.match(
          () => [...items, item],
          (index) =>
            pipe(
              items,
              A.updateAt(index, item),
              O.getOrElse(() => items),
            ),
        ),
      );

    loadChannels = async () => this.stateRef.read().channels;

    loadCommonConfig = async () => {
      const state = this.stateRef.read();
      return {
        version: state.version,
        countryCode: state.countryCode,
        userAgent: state.userAgent,
        capabilities: state.capabilities,
        currentChannel: state.currentChannel,
      };
    };

    saveCommonConfig = async (config: Omit<ExtensionConfig.State, "channels">) =>
      this.updateState((state) => ({
        ...state,
        version: config.version,
        countryCode: config.countryCode,
        userAgent: config.userAgent,
        capabilities: config.capabilities,
        currentChannel: config.currentChannel,
      }))();

    upsertChannel = async (channel: ExtensionConfig.Channel) =>
      this.updateState((state) => ({
        ...state,
        channels: this.upsertInArray(state.channels, channel),
      }))();

    removeChannel = async (id: string) =>
      this.updateState((state) => ({
        ...state,
        channels: pipe(
          state.channels,
          A.filter((c) => c.id !== id),
        ),
      }))();

    playChannel = async (channel: ExtensionConfig.Channel) =>
      this.updateState((state) => ({ ...state, currentChannel: channel }))();

    loadStreamEvents = async () =>
      pipe(
        this.stateRef.read().channels,
        A.flatMap((c) => c.streamEvents || []),
      );

    upsertStreamEvent = async (streamEvent: ExtensionConfig.StreamEvent) =>
      this.updateState((state) => ({
        ...state,
        channels: pipe(
          state.channels,
          A.map((channel) => ({
            ...channel,
            streamEvents: this.upsertInArray(channel.streamEvents || [], streamEvent),
          })),
        ),
      }))();

    removeStreamEvent = async (id: string) =>
      this.updateState((state) => ({
        ...state,
        channels: pipe(
          state.channels,
          A.map((channel) => ({
            ...channel,
            streamEvents: pipe(
              channel.streamEvents || [],
              A.filter((e) => e.id !== id),
            ),
          })),
        ),
      }))();

    render = (root: Root): IO.IO<void> =>
      pipe(
        logger.info("Rendering SidePanel"),
        IO.map(() =>
          root.render(
            <StrictMode>
              <Settings
                config={{
                  channel: {
                    load: this.loadChannels,
                    upsert: this.upsertChannel,
                    remove: this.removeChannel,
                    play: this.playChannel,
                    streamEvent: {
                      load: this.loadStreamEvents,
                      upsert: this.upsertStreamEvent,
                      remove: this.removeStreamEvent,
                    },
                  },
                  common: {
                    load: this.loadCommonConfig,
                    save: this.saveCommonConfig,
                  },
                }}
              />
            </StrictMode>,
          ),
        ),
      );
  };

// biome-ignore format: ack
const SidePanel = compose(
  class { },
  WithChromeMessageAdapter,
  WithMessageBus("SIDE_PANEL"),
  WithSidePanel
);

initApp(new SidePanel())();
