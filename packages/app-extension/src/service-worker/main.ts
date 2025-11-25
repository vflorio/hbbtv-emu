import {
  type ClassType,
  type Config,
  compose,
  Storage,
  WithChromeActionHandler,
  WithChromeScriptInject,
  WithChromeWebRequestManager,
} from "@hbb-emu/lib";
import { MessageClient } from "@hbb-emu/message-bus";

const WithApp = <T extends ClassType>(Base: T) =>
  class extends Base {
    messageClient: MessageClient;
    channelStorage: Storage<Config.Channel>;

    constructor(...args: any[]) {
      super(...args);

      this.messageClient = new MessageClient("SERVICE_WORKER");
      this.channelStorage = new Storage<Config.Channel>("channelConfig");
    }

    init = async () => {
      const channelConfig = await this.channelStorage.loadAll();

      const hydrateMessage = this.messageClient.bus.createEnvelope({
        type: "INIT",
        payload: {
          channelConfig,
        },
      });

      await this.messageClient.sendMessage(hydrateMessage);
    };
  };

const ServiceWorker = compose(
  class {},
  WithChromeScriptInject,
  WithChromeActionHandler,
  WithChromeWebRequestManager,
  WithApp,
);

new ServiceWorker();
