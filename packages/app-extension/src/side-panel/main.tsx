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
import type * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

const logger = createLogger("SidePanel");

const WithSidePanel = <T extends ClassType<MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    root: Root | null = null;
    stateRef = IORef.newIORef(DEFAULT_HBBTV_CONFIG)();

    init: IO.IO<void> = () => {
      pipe(
        O.fromNullable(document.getElementById("root")),
        O.map(
          (rootElement): IO.IO<void> =>
            () => {
              this.root = createRoot(rootElement);
              this.render();
            },
        ),
        O.getOrElse(() => logger.error("Root element not found")),
      )();

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        this.stateRef.write(payload)();
      });
    };

    updateState = (updater: (state: ExtensionConfig.State) => ExtensionConfig.State): void => {
      pipe(this.stateRef.read(), updater, this.stateRef.write)();
      this.notify();
    };

    notify: IO.IO<void> = () => {
      this.sendMessage(
        createEnvelope(this.messageOrigin, "BACKGROUND_SCRIPT", {
          type: "UPDATE_CONFIG",
          payload: this.stateRef.read(),
        }),
      );
    };

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

    saveCommonConfig = async (config: Omit<ExtensionConfig.State, "channels">) => {
      this.updateState((state) => ({
        ...state,
        version: config.version,
        countryCode: config.countryCode,
        userAgent: config.userAgent,
        capabilities: config.capabilities,
        currentChannel: config.currentChannel,
      }));
    };

    upsertChannel = async (channel: ExtensionConfig.Channel) => {
      this.updateState((state) => ({
        ...state,
        channels: this.upsertInArray(state.channels, channel),
      }));
    };

    removeChannel = async (id: string) => {
      this.updateState((state) => ({
        ...state,
        channels: pipe(
          state.channels,
          A.filter((c) => c.id !== id),
        ),
      }));
    };

    playChannel = async (channel: ExtensionConfig.Channel) => {
      this.updateState((state) => ({ ...state, currentChannel: channel }));
    };

    loadStreamEvents = async () =>
      pipe(
        this.stateRef.read().channels,
        A.flatMap((c) => c.streamEvents || []),
      );

    upsertStreamEvent = async (streamEvent: ExtensionConfig.StreamEvent) => {
      this.updateState((state) => ({
        ...state,
        channels: pipe(
          state.channels,
          A.map((channel) => ({
            ...channel,
            streamEvents: this.upsertInArray(channel.streamEvents || [], streamEvent),
          })),
        ),
      }));
    };

    removeStreamEvent = async (id: string) => {
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
      }));
    };

    render: IO.IO<void> = () => {
      this.root?.render(
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
      );
    };
  };

// biome-ignore format: ack
const SidePanel = compose(
  class { },
  WithChromeMessageAdapter,
  WithMessageBus("SIDE_PANEL"),
  WithSidePanel
);

initApp(new SidePanel())();
