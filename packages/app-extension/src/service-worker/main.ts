import {
  type App,
  type ClassType,
  compose,
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

const WithServiceWorker = <T extends ClassType<MessageBus & MessageAdapter>>(Base: T) =>
  class extends Base implements App {
    state: Storage<ExtensionConfig.State>;

    constructor(...args: any[]) {
      super(...args);

      this.state = new Storage<ExtensionConfig.State>("state");
    }

    init = async () => {
      const candidate = await this.state.load();
      if (!candidate) this.state.save(DEFAULT_HBBTV_CONFIG);

      const data = candidate || DEFAULT_HBBTV_CONFIG;

      await this.sendMessage(this.bus.createEnvelope({ type: "UPDATE_CHANNELS", payload: data.channels }));
      await this.sendMessage(this.bus.createEnvelope({ type: "UPDATE_VERSION", payload: data.version }));
      await this.sendMessage(this.bus.createEnvelope({ type: "UPDATE_COUNTRY_CODE", payload: data.countryCode }));
      await this.sendMessage(this.bus.createEnvelope({ type: "UPDATE_CAPABILITIES", payload: data.capabilities }));
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
