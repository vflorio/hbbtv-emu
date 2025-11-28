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

    init = () => {
      pipe(
        O.fromNullable(document.getElementById("root")),
        O.map(
          (rootElement): IO.IO<void> =>
            () => {
              this.root = createRoot(rootElement);
              this.render();
            },
        ),
        O.getOrElse(() => () => {
          logger.error("Root element not found");
        }),
      )();

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        this.stateRef.write(payload)();
      });
    };

    update: IO.IO<void> = () => {
      const state = this.stateRef.read();

      this.sendMessage(
        createEnvelope(this.messageOrigin, "SERVICE_WORKER", {
          type: "UPDATE_CONFIG",
          payload: state,
        }),
      );
    };

    loadChannels = async () => {
      const state = this.stateRef.read();
      return state.channels;
    };

    saveChannel = async (channel: ExtensionConfig.Channel) => {
      const state = this.stateRef.read();

      this.stateRef.write({
        ...state,
        channels: pipe(
          state.channels,
          A.findIndex((c) => c.id === channel.id),
          O.match(
            () => [...state.channels, channel],
            (index) =>
              pipe(
                state.channels,
                A.updateAt(index, channel),
                O.getOrElse(() => state.channels),
              ),
          ),
        ),
      })();

      this.update();
    };

    removeChannel = async (id: string) => {
      const state = this.stateRef.read();

      this.stateRef.write({
        ...state,
        channels: pipe(
          state.channels,
          A.filter((c) => c.id !== id),
        ),
      })();

      this.update();
    };

    playChannel = async (channel: ExtensionConfig.Channel) => {
      const state = this.stateRef.read();

      this.stateRef.write({ ...state, currentChannel: channel })();

      this.update();
    };

    loadStreamEvents = async () => {
      const state = this.stateRef.read();

      return pipe(
        state.channels,
        A.flatMap((c) => c.streamEvents || []),
      );
    };

    saveStreamEvent = async (streamEvent: ExtensionConfig.StreamEvent) => {
      const state = this.stateRef.read();

      this.stateRef.write({
        ...state,
        channels: pipe(
          state.channels,
          A.map((channel) => {
            if (!channel.streamEvents) channel.streamEvents = [];
            return pipe(
              channel.streamEvents,
              A.findIndex((e) => e.id === streamEvent.id),
              O.match(
                () => channel,
                (index) => ({
                  ...channel,
                  streamEvents: pipe(
                    channel.streamEvents || [],
                    A.updateAt(index, streamEvent),
                    O.getOrElse(() => channel.streamEvents || []),
                  ),
                }),
              ),
            );
          }),
        ),
      })();

      this.update();
    };

    removeStreamEvent = async (id: string) => {
      const state = this.stateRef.read();

      this.stateRef.write({
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
      })();

      this.update();
    };

    render: IO.IO<void> = () => {
      this.root?.render(
        <StrictMode>
          <Settings
            config={{
              channel: {
                load: this.loadChannels,
                save: this.saveChannel,
                remove: this.removeChannel,
                play: this.playChannel,
                streamEvent: {
                  load: this.loadStreamEvents,
                  save: this.saveStreamEvent,
                  remove: this.removeStreamEvent,
                },
              },
            }}
          />
        </StrictMode>,
      );
    };
  };

// biome-ignore format: ack
const SidePanel = compose(
  class {}, 
  WithChromeMessageAdapter, 
  WithMessageBus("SIDE_PANEL"), 
  WithSidePanel
);

initApp(new SidePanel());
