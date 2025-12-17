import { createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";

const logger = createLogger("OipfApplicationManager/ApplicationPrivateData");

/**
 * Environment for ApplicationPrivateData.
 * Provides access to the current broadcast channel.
 */
export type ApplicationPrivateDataEnv = Readonly<{
  /** Returns the current channel from the active VideoBroadcast */
  getCurrentChannel: () => OIPF.DAE.Broadcast.Channel | null;

  /** Creates a Keyset instance (allows injecting defaults) */
  createKeyset: () => OIPF.DAE.ApplicationManager.Keyset;
}>;

/**
 * ApplicationPrivateData implementation.
 *
 * Used to access the keyset used by the application and the current broadcast
 * channel of a broadcast-related application.
 */
export class ApplicationPrivateData implements OIPF.DAE.ApplicationManager.ApplicationPrivateData {
  readonly #env: ApplicationPrivateDataEnv;
  readonly #keyset: OIPF.DAE.ApplicationManager.Keyset;

  constructor(env: ApplicationPrivateDataEnv) {
    this.#env = env;
    this.#keyset = env.createKeyset();
  }

  /**
   * The object of class Keyset, representing the user input events
   * sent to the HbbTV application.
   */
  get keyset(): OIPF.DAE.ApplicationManager.Keyset {
    return this.#keyset;
  }

  /**
   * For a broadcast-related application, the value of the property contains
   * the channel whose AIT is currently controlling the lifecycle of this
   * application. If no channel is being presented, or if the application
   * is not broadcast-related, the value of this property will be null.
   */
  get currentChannel(): OIPF.DAE.Broadcast.Channel | null {
    const channel = this.#env.getCurrentChannel();
    logger.debug("currentChannel:", channel)();
    return channel;
  }

  /**
   * Lets the application developer query information about the current memory
   * available to the application.
   *
   * @returns The available memory to the application or -1 if the information is not available.
   */
  getFreeMem = (): number => {
    // Try to use performance.memory if available (Chrome only)
    const performance = globalThis.performance as Performance & {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    };

    if (performance?.memory) {
      const freeMem = performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize;
      logger.debug("getFreeMem:", freeMem)();
      return freeMem;
    }

    logger.debug("getFreeMem: not available, returning -1")();
    return -1;
  };
}

/**
 * Creates an ApplicationPrivateData instance.
 */
export const createApplicationPrivateData = (
  env: ApplicationPrivateDataEnv,
): OIPF.DAE.ApplicationManager.ApplicationPrivateData => new ApplicationPrivateData(env);
