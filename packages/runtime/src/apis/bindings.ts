/**
 * OIPF Binding Definitions
 *
 * This module defines all OIPF bindings using a declarative pattern.
 * Each binding describes:
 * - How to detect the element in DOM (connector)
 * - How to create the instance (factory)
 *
 * The `Stateful<S>` constraint ensures instances automatically provide
 * applyState/getState/subscribe methods.
 */

import {
  type ApplicationManagerState,
  AV_CONTROL_DASH_MIME_TYPE,
  AV_CONTROL_HLS_MIME_TYPE,
  AV_CONTROL_VIDEO_MP4_MIME_TYPE,
  type AVControlState,
  isValidAvControlDash,
  isValidAvControlHls,
  isValidAvControlVideoMp4,
  OIPF,
  type OipfCapabilitiesState,
  type OipfConfigurationState,
  type VideoBroadcastState,
} from "@hbb-emu/oipf";
import type { BindingsEnv } from "../runtime";
import type { AnyOipfBinding, OipfBinding } from "../subsystems/provider";
import { AVControlVideo, type AVControlVideoEventHandlers } from "./av/controlVideo";
import { OipfApplicationManager } from "./dae/applicationManager";
import { createKeyset } from "./dae/applicationManager/keyset";
import { OipfCapabilities } from "./dae/capabilities";
import { OipfConfiguration } from "./dae/configuration";
import { VideoBroadcast, type VideoBroadcastEventHandlers } from "./dae/videoBroadcast";
import { createChannelVideoStreamEnv } from "./dae/videoBroadcast/channel";

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
  createApplicationManagerBinding(env) as AnyOipfBinding,
  createCapabilitiesBinding(env) as AnyOipfBinding,
  createConfigurationBinding(env) as AnyOipfBinding,
  createVideoBroadcastBinding(env) as AnyOipfBinding,
  createAvControlsBinding(env) as AnyOipfBinding,
];

/**
 * Creates the Capabilities binding.
 * Non-visual object exposing device/platform capabilities.
 */
export const createCapabilitiesBinding = (
  env: BindingsEnv,
): OipfBinding<OipfCapabilities, OipfCapabilitiesState, "oipfCapabilities"> => ({
  name: "oipfCapabilities",
  connector: {
    selector: `object[type="${OIPF.DAE.Capabilities.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Capabilities.isValidElement,
    attachStrategy: "non-visual",
  },
  factory: (_element) => new OipfCapabilities({ defaults: env.defaultOipfCapabilities }),
});

/**
 * Creates the Configuration binding.
 * Non-visual object for device configuration.
 */
export const createConfigurationBinding = (
  env: BindingsEnv,
): OipfBinding<OipfConfiguration, OipfConfigurationState, "oipfConfiguration"> => ({
  name: "oipfConfiguration",
  connector: {
    selector: `object[type="${OIPF.DAE.Configuration.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Configuration.isValidElement,
    attachStrategy: "non-visual",
  },
  factory: (_element) => new OipfConfiguration({ defaults: env.defaultOipfConfiguration }),
});

/**
 * Creates the VideoBroadcast binding.
 * Visual object for live TV broadcast.
 *
 * @param env - Environment with channel registry and video stream factory
 */
export const createVideoBroadcastBinding = (
  env: BindingsEnv,
): OipfBinding<VideoBroadcast, VideoBroadcastState, "videoBroadcast"> => ({
  name: "videoBroadcast",
  connector: {
    selector: `object[type="${OIPF.DAE.Broadcast.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Broadcast.isValidElement,
    attachStrategy: "visual",
  },
  factory: (element) =>
    new VideoBroadcast({
      channelRegistry: env.channelRegistry,
      videoStream: createChannelVideoStreamEnv(env.createVideoStream()),
      onCurrentChannelChange: env.setCurrentChannel,
      streamEventScheduler: env.streamEventScheduler,
      defaults: env.defaultVideoBroadcast,
      eventHandlers: extractVideoBroadcastEventHandlers(element),
    }),
});

/**
 * Creates the ApplicationManager binding.
 * Non-visual object for application lifecycle management.
 *
 * @param env - Environment with current channel provider
 */
export const createApplicationManagerBinding = (
  env: BindingsEnv,
): OipfBinding<OipfApplicationManager, ApplicationManagerState, "applicationManager"> => ({
  name: "applicationManager",
  connector: {
    selector: `object[type="${OIPF.DAE.ApplicationManager.MIME_TYPE}"]`,
    predicate: OIPF.DAE.ApplicationManager.isValidElement,
    attachStrategy: "non-visual",
  },
  factory: (_element) =>
    new OipfApplicationManager({
      getCurrentChannel: env.getCurrentChannel,
      createKeyset: () => createKeyset(env.defaultKeysetValue),
    }),
});

/**
 * Creates the A/V Control binding.
 * Visual object for on-demand media playback (MP4/DASH/HLS).
 */
export const createAvControlsBinding = (
  env: BindingsEnv,
): OipfBinding<AVControlVideo, AVControlState, "avControls"> => ({
  name: "avControls",
  connector: {
    selector: [
      `object[type="${AV_CONTROL_VIDEO_MP4_MIME_TYPE}"]`,
      `object[type="${AV_CONTROL_DASH_MIME_TYPE}"]`,
      `object[type="${AV_CONTROL_HLS_MIME_TYPE}"]`,
    ].join(", "),
    predicate: (element): element is HTMLObjectElement =>
      isValidAvControlVideoMp4(element) || isValidAvControlDash(element) || isValidAvControlHls(element),
    attachStrategy: "visual",
  },
  factory: (element) =>
    new AVControlVideo({
      videoStream: env.createVideoStream(),
      defaults: env.defaultAvControlVideo,
      eventHandlers: extractAvControlEventHandlers(element),
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Event Handler Extraction Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts event handlers from the HTMLObjectElement.
 * These handlers are set by the user (e.g., object.onPlayStateChange = ...).
 * Returns an object with functions that invoke the user's handlers if present.
 */
const extractAvControlEventHandlers = (element: HTMLObjectElement): AVControlVideoEventHandlers => {
  // Type assertion to access OIPF properties not in standard HTMLObjectElement
  const oipfElement = element as HTMLObjectElement & Partial<AVControlVideoEventHandlers>;

  return {
    onPlayStateChange: (state) => {
      oipfElement.onPlayStateChange?.(state);
    },
    onPlayPositionChanged: (position) => {
      oipfElement.onPlayPositionChanged?.(position);
    },
    onPlaySpeedChanged: (speed) => {
      oipfElement.onPlaySpeedChanged?.(speed);
    },
    onFullScreenChange: (fullscreen) => {
      oipfElement.onFullScreenChange?.(fullscreen);
    },
    onfocus: () => {
      oipfElement.onfocus?.();
    },
    onblur: () => {
      oipfElement.onblur?.();
    },
  };
};

/**
 * Extracts event handlers from the VideoBroadcast HTMLObjectElement.
 * These handlers are set by the user (e.g., object.onChannelChangeSucceeded = ...).
 * Returns an object with functions that invoke the user's handlers if present.
 */
const extractVideoBroadcastEventHandlers = (element: HTMLObjectElement): VideoBroadcastEventHandlers => {
  // Type assertion to access OIPF properties not in standard HTMLObjectElement
  const oipfElement = element as HTMLObjectElement & Partial<VideoBroadcastEventHandlers>;

  return {
    onPlayStateChange: (state) => {
      oipfElement.onPlayStateChange?.(state);
    },
    onFullScreenChange: (fullscreen) => {
      oipfElement.onFullScreenChange?.(fullscreen);
    },
    onfocus: () => {
      oipfElement.onfocus?.();
    },
    onblur: () => {
      oipfElement.onblur?.();
    },
    onChannelChangeSucceeded: (channel) => {
      oipfElement.onChannelChangeSucceeded?.(channel);
    },
    onChannelChangeError: (channel, error) => {
      oipfElement.onChannelChangeError?.(channel, error);
    },
    onProgrammesChanged: () => {
      oipfElement.onProgrammesChanged?.();
    },
    onParentalRatingChange: (contentId, ratings, blocked) => {
      oipfElement.onParentalRatingChange?.(contentId, ratings, blocked);
    },
    onParentalRatingError: (contentId, ratings, drmSystemId) => {
      oipfElement.onParentalRatingError?.(contentId, ratings, drmSystemId);
    },
    onDRMRightsError: (errorState, contentId, drmSystemId, rightsIssuerUrl) => {
      oipfElement.onDRMRightsError?.(errorState, contentId, drmSystemId, rightsIssuerUrl);
    },
    onSelectedComponentChanged: (componentType) => {
      oipfElement.onSelectedComponentChanged?.(componentType);
    },
    onComponentChanged: (componentType, added) => {
      oipfElement.onComponentChanged?.(componentType, added);
    },
  };
};
