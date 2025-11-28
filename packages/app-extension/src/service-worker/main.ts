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
  Storage,
  type WebRequestHandler,
  WithChromeMessageAdapter,
  WithChromeScriptInject,
  WithChromeWebRequestManager,
  WithMessageBus,
} from "@hbb-emu/lib";

const logger = createLogger("ServiceWorker");

const WithServiceWorker = <T extends ClassType<MessageAdapter & MessageBus & WebRequestHandler>>(Base: T) =>
  class extends Base implements App {
    store = new Storage<ExtensionConfig.State>("state");
    state: ExtensionConfig.State = DEFAULT_HBBTV_CONFIG;

    init = async () => {
      const candidate = await this.store.load();
      if (!candidate) this.store.save(DEFAULT_HBBTV_CONFIG);

      this.bus.on("CONTENT_SCRIPT_READY", () => {
        logger.log("Content script ready, sending config");
        this.broadcastConfig();
      });

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        logger.log("Updating config", payload);

        this.state = payload;
        this.store.save(this.state);

        this.broadcastConfig();
      });
    };

    broadcastConfig = () => {
      this.tabs.forEach((tabId) => {
        this.sendMessage(
          createEnvelope(
            this.messageOrigin,
            "CONTENT_SCRIPT",
            { type: "UPDATE_CONFIG", payload: this.state },
            { tabId },
          ),
        );

        logger.log(`Config sent to tab ${tabId}`);
      });
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
