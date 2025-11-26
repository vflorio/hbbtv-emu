import {
  type App,
  type ClassType,
  compose,
  DEFAULT_HBBTV_CONFIG,
  type ExtensionConfig,
  initApp,
  type MessageBus,
  WithMessageBus,
} from "@hbb-emu/lib";
import { Settings } from "@hbb-emu/ui";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

const WithSidePanel = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base implements App {
    root: Root | null = null;
    state: ExtensionConfig.State = DEFAULT_HBBTV_CONFIG;

    constructor(...args: any[]) {
      super(...args);

      this.bus.on("UPDATE_VERSION", ({ payload }) => {
        this.state.version = payload;
      });

      this.bus.on("UPDATE_COUNTRY_CODE", ({ payload }) => {
        this.state.countryCode = payload;
      });

      this.bus.on("UPDATE_CAPABILITIES", ({ payload }) => {
        this.state.capabilities = payload;
      });

      this.bus.on("UPDATE_CHANNELS", ({ payload }) => {
        this.state.channels = payload;
      });
    }

    init = () => {
      const root = document.getElementById("root");
      if (!root) return;
      this.root = createRoot(root);

      this.render();
    };

    render = () =>
      this.root?.render(
        <StrictMode>
          <Settings
            config={{
              api: {
                channel: {
                  load: async () => this.state.channels,
                  save: async (channel: ExtensionConfig.Channel) => {
                    const index = this.state.channels.findIndex((c) => c.id === channel.id);
                    if (index >= 0) {
                      this.state.channels[index] = channel;
                    } else {
                      this.state.channels.push(channel);
                    }
                    await this.bus.sendMessage(
                      this.bus.createEnvelope({ type: "UPDATE_CHANNELS", payload: this.state.channels }),
                    );
                  },
                  remove: async (id: string) => {
                    this.state.channels = this.state.channels.filter((channel) => channel.id !== id);
                    await this.bus.sendMessage(
                      this.bus.createEnvelope({ type: "UPDATE_CHANNELS", payload: this.state.channels }),
                    );
                  },
                  streamEvent: {
                    load: async () => this.state.channels.flatMap((c) => c.streamEvents || []),

                    save: async (event: ExtensionConfig.StreamEvent) => {
                      for (const channel of this.state.channels) {
                        if (!channel.streamEvents) channel.streamEvents = [];

                        const index = channel.streamEvents.findIndex((e) => e.id === event.id);
                        if (index >= 0) {
                          channel.streamEvents[index] = event;
                          await this.bus.sendMessage(
                            this.bus.createEnvelope({ type: "UPDATE_CHANNELS", payload: this.state.channels }),
                          );
                        }
                      }
                    },

                    remove: async (id: string) => {
                      for (const channel of this.state.channels) {
                        if (channel.streamEvents) {
                          channel.streamEvents = channel.streamEvents.filter((e) => e.id !== id);
                        }
                      }
                      return this.bus.sendMessage(
                        this.bus.createEnvelope({ type: "UPDATE_CHANNELS", payload: this.state.channels }),
                      );
                    },
                  },
                },
              },
            }}
          />
        </StrictMode>,
      );
  };

const SidePanel = compose(class {}, WithMessageBus("SIDE_PANEL"), WithSidePanel);
initApp(new SidePanel());
