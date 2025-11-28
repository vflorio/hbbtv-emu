import {
  type App,
  type ClassType,
  compose,
  createLogger,
  DEFAULT_HBBTV_CONFIG,
  type ExtensionConfig,
  initApp,
  type MessageAdapter,
  type MessageBus,
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

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        this.state = payload;
        this.sendConfigToTab();
        this.store.save(this.state);
      });
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

      try {
        await this.sendMessage(
          this.createEnvelope({ type: "UPDATE_CONFIG", payload: this.state }, "CONTENT_SCRIPT"),
        );
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
