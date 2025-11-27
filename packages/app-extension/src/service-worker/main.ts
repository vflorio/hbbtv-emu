import {
  type App,
  type ClassType,
  compose,
  createLogger,
  DEFAULT_HBBTV_CONFIG,
  type ExtensionConfig,
  initApp,
  type Message,
  type MessageAdapter,
  type MessageBus,
  type MessageOrigin,
  Storage,
  WithChromeMessageAdapter,
  WithChromeScriptInject,
  WithChromeWebRequestManager,
  WithMessageBus,
} from "@hbb-emu/lib";

const logger = createLogger("ServiceWorker");

const WithServiceWorker = <T extends ClassType<MessageAdapter & MessageBus>>(Base: T) =>
  class extends Base implements App {
    store = new Storage<ExtensionConfig.State>("state");
    state: ExtensionConfig.State = DEFAULT_HBBTV_CONFIG;

    init = async () => {
      const candidate = await this.store.load();
      if (!candidate) this.store.save(DEFAULT_HBBTV_CONFIG);

      this.bus.on("CONTENT_SCRIPT_READY", async () => {
        if (!this.tabId) {
          logger.warn("Received CONTENT_SCRIPT_READY but tabId is not set");
          return;
        }
        logger.log(`Content script ready in tab ${this.tabId}`);
        await this.sendConfigToTab();
      });

      this.bus.on("UPDATE_CHANNELS", ({ message: { payload } }) =>
        update(() => {
          this.state.channels = payload;
        }),
      );
      this.bus.on("UPDATE_VERSION", ({ message: { payload } }) =>
        update(() => {
          this.state.version = payload;
        }),
      );
      this.bus.on("UPDATE_COUNTRY_CODE", ({ message: { payload } }) =>
        update(() => {
          this.state.countryCode = payload;
        }),
      );
      this.bus.on("UPDATE_CAPABILITIES", ({ message: { payload } }) =>
        update(() => {
          this.state.capabilities = payload;
        }),
      );

      const update = (callback: () => void) => {
        callback();
        this.sendConfigToTab();
        this.store.save(this.state);
      };
    };

    sendConfigToTab = async () => {
      if (!this.tabId) {
        logger.log("Cannot send config: no active tab with content script");
        return;
      }

      // Verify tab still exists
      try {
        await chrome.tabs.get(this.tabId);
      } catch {
        logger.warn(`Tab ${this.tabId} no longer exists, cannot send config`);
        return;
      }

      const envelopes: [Message, MessageOrigin][] = [
        [{ type: "UPDATE_CHANNELS", payload: this.state.channels }, "CONTENT_SCRIPT"],
        [{ type: "UPDATE_VERSION", payload: this.state.version }, "CONTENT_SCRIPT"],
        [{ type: "UPDATE_COUNTRY_CODE", payload: this.state.countryCode }, "CONTENT_SCRIPT"],
        [{ type: "UPDATE_CAPABILITIES", payload: this.state.capabilities }, "CONTENT_SCRIPT"],
      ];

      try {
        await Promise.all(envelopes.map(([message, target]) => this.sendMessage(this.createEnvelope(message, target))));
        logger.log(`Config sent to tab ${this.tabId}`);
      } catch (error) {
        logger.error(`Failed to send config to tab ${this.tabId}:`, error);
      }
    };
  };

// biome-ignore format: ack
const ServiceWorker = compose(
  class {}, 
  WithChromeScriptInject,
  WithChromeWebRequestManager,
  WithChromeMessageAdapter, 
  WithMessageBus("SERVICE_WORKER"),
  WithServiceWorker
);

initApp(new ServiceWorker());
