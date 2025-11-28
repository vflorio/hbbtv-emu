import {
  type App,
  type ClassType,
  compose,
  DEFAULT_HBBTV_CONFIG,
  type ExtensionConfig,
  initApp,
  type MessageAdapter,
  type MessageBus,
  WithChromeMessageAdapter,
  WithMessageBus,
} from "@hbb-emu/lib";
import { Settings } from "@hbb-emu/ui";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

const WithSidePanel = <T extends ClassType<MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    root: Root | null = null;
    state: ExtensionConfig.State = DEFAULT_HBBTV_CONFIG;

    init = () => {
      const root = document.getElementById("root");
      if (!root) return;
      this.root = createRoot(root);

      this.render();

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        this.state = payload;
      });
    };

    update = () =>
      this.sendMessage(this.createEnvelope({ type: "UPDATE_CONFIG", payload: this.state }, "SERVICE_WORKER"));

    render = () =>
      this.root?.render(
        <StrictMode>
          <Settings
            config={{
              channel: {
                load: async () => this.state.channels,
                save: async (channel: ExtensionConfig.Channel) => {
                  const index = this.state.channels.findIndex((c) => c.id === channel.id);
                  if (index >= 0) {
                    this.state.channels[index] = channel;
                  } else {
                    this.state.channels.push(channel);
                  }
                  await this.update();
                },
                remove: async (id: string) => {
                  this.state.channels = this.state.channels.filter((channel) => channel.id !== id);
                  await this.update();
                },
                streamEvent: {
                  load: async () => this.state.channels.flatMap((c) => c.streamEvents || []),

                  save: async (event: ExtensionConfig.StreamEvent) => {
                    for (const channel of this.state.channels) {
                      if (!channel.streamEvents) channel.streamEvents = [];

                      const index = channel.streamEvents.findIndex((e) => e.id === event.id);
                      if (index >= 0) {
                        channel.streamEvents[index] = event;
                        await this.update();
                      }
                    }
                  },

                  remove: async (id: string) => {
                    for (const channel of this.state.channels) {
                      if (channel.streamEvents) {
                        channel.streamEvents = channel.streamEvents.filter((e) => e.id !== id);
                      }
                    }
                    await this.update();
                  },
                },
              },
            }}
          />
        </StrictMode>,
      );
  };

// biome-ignore format: ack
const SidePanel = compose(
  class {}, 
  WithChromeMessageAdapter, 
  WithMessageBus("SIDE_PANEL"), 
  WithSidePanel
);

initApp(new SidePanel());
