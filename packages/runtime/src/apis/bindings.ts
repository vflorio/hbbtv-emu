/**
 * OIPF Binding Definitions
 *
 * This module defines all OIPF bindings using a declarative pattern.
 * Each binding describes:
 * - How to detect the element in DOM (connector)
 * - How to create the instance (factory)
 * - How to manage state (stateful)
 *
 * The `Stateful<S>` constraint ensures instances automatically provide
 * applyState/getState/subscribe methods.
 */

import {
  type ApplicationManagerState,
  DEFAULT_APPLICATION_MANAGER,
  DEFAULT_OIPF_CAPABILITIES,
  DEFAULT_OIPF_CONFIGURATION,
  DEFAULT_VIDEO_BROADCAST,
  OIPF,
  type OipfCapabilitiesState,
  type OipfConfigurationState,
  type VideoBroadcastState,
} from "@hbb-emu/oipf";
import type { BindingsEnv } from "../runtime.new";
import type { AnyOipfBinding, OipfBinding } from "../subsystems/provider";
import { OipfApplicationManager } from "./dae/applicationManager";
import { OipfCapabilities } from "./dae/capabilities";
import { OipfConfiguration } from "./dae/configuration";
import { VideoBroadcast } from "./dae/videoBroadcast";
import { createChannelVideoStreamEnv } from "./dae/videoBroadcast/channel";

// ─────────────────────────────────────────────────────────────────────────────
// Static Bindings (no runtime dependencies)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ApplicationManager binding.
 * Non-visual object for application lifecycle management.
 */
export const applicationManagerBinding: OipfBinding<
  OipfApplicationManager,
  ApplicationManagerState,
  "applicationManager"
> = {
  name: "ApplicationManager",
  connector: {
    selector: `object[type="${OIPF.DAE.ApplicationManager.MIME_TYPE}"]`,
    predicate: OIPF.DAE.ApplicationManager.isValidElement,
    attachStrategy: "non-visual",
  },
  factory: () => new OipfApplicationManager(),
  stateful: {
    stateKey: "applicationManager",
    defaults: DEFAULT_APPLICATION_MANAGER,
  },
};

/**
 * Capabilities binding.
 * Non-visual object exposing device/platform capabilities.
 */
export const capabilitiesBinding: OipfBinding<OipfCapabilities, OipfCapabilitiesState, "oipfCapabilities"> = {
  name: "Capabilities",
  connector: {
    selector: `object[type="${OIPF.DAE.Capabilities.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Capabilities.isValidElement,
    attachStrategy: "non-visual",
  },
  factory: () => new OipfCapabilities(),
  stateful: {
    stateKey: "oipfCapabilities",
    defaults: DEFAULT_OIPF_CAPABILITIES,
  },
};

/**
 * Configuration binding.
 * Non-visual object for device configuration.
 */
export const configurationBinding: OipfBinding<OipfConfiguration, OipfConfigurationState, "oipfConfiguration"> = {
  name: "Configuration",
  connector: {
    selector: `object[type="${OIPF.DAE.Configuration.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Configuration.isValidElement,
    attachStrategy: "non-visual",
  },
  factory: () => new OipfConfiguration(),
  stateful: {
    stateKey: "oipfConfiguration",
    defaults: DEFAULT_OIPF_CONFIGURATION,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Bindings (require runtime environment)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the VideoBroadcast binding.
 * Visual object for live TV broadcast.
 *
 * @param env - Environment with channel registry and video stream factory
 */
export const createVideoBroadcastBinding = (
  env: BindingsEnv,
): OipfBinding<VideoBroadcast, VideoBroadcastState, "videoBroadcast"> => ({
  name: "VideoBroadcast",
  connector: {
    selector: `object[type="${OIPF.DAE.Broadcast.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Broadcast.isValidElement,
    attachStrategy: "visual",
  },
  factory: () =>
    new VideoBroadcast({
      channelRegistry: env.channelRegistry,
      videoStream: createChannelVideoStreamEnv(env.createVideoStream()),
    }),
  stateful: {
    stateKey: "videoBroadcast",
    defaults: DEFAULT_VIDEO_BROADCAST,
  },
});

// TODO: AVControl binding
// export const createAvControlBinding = (env: BindingsEnv): OipfBinding<...> => ({ ... });

// ─────────────────────────────────────────────────────────────────────────────
// Binding Collection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates all OIPF bindings with the given environment.
 *
 * This is the main entry point for the runtime to obtain all binding definitions.
 * Static bindings are included as-is, dynamic bindings are created with the env.
 *
 * @param env - Environment for dynamic bindings
 * @returns Complete list of all OIPF bindings
 */
export const createBindings = (env: BindingsEnv): ReadonlyArray<AnyOipfBinding> => [
  applicationManagerBinding as AnyOipfBinding,
  capabilitiesBinding as AnyOipfBinding,
  configurationBinding as AnyOipfBinding,
  createVideoBroadcastBinding(env) as AnyOipfBinding,
  // TODO: createAvControlBinding(env) as AnyOipfBinding,
];
