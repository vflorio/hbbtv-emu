import {
  type ClassType,
  compose,
  DEFAULT_HBBTV_CONFIG,
  type ExtensionConfig,
  type MessageBus,
  Storage,
  WithChromeActionHandler,
  WithChromeScriptInject,
  WithChromeWebRequestManager,
  WithMessageBus,
} from "@hbb-emu/lib";

const WithApp = <T extends ClassType<MessageBus>>(Base: T) =>
  class extends Base {
    state: Storage<ExtensionConfig.State>;

    constructor(...args: any[]) {
      super(...args);

      this.state = new Storage<ExtensionConfig.State>("state");
    }

    init = async () => {
      const candidate = await this.state.load();
      if (!candidate) this.state.save(DEFAULT_HBBTV_CONFIG);

      const data = candidate || DEFAULT_HBBTV_CONFIG;

      await this.bus.sendMessage(this.bus.createEnvelope({ type: "UPDATE_CHANNELS", payload: data.channels }));
      await this.bus.sendMessage(this.bus.createEnvelope({ type: "UPDATE_VERSION", payload: data.version }));
      await this.bus.sendMessage(this.bus.createEnvelope({ type: "UPDATE_COUNTRY_CODE", payload: data.countryCode }));
      await this.bus.sendMessage(this.bus.createEnvelope({ type: "UPDATE_CAPABILITIES", payload: data.capabilities }));
    };
  };

const WithServiceWorkerMessageBus = WithMessageBus("SERVICE_WORKER");

const ServiceWorker = compose(
  class {},
  WithChromeScriptInject,
  WithChromeActionHandler,
  WithChromeWebRequestManager,
  WithServiceWorkerMessageBus,
  WithApp,
);

new ServiceWorker();
