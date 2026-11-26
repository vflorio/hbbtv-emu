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
  AV_CONTROL_MIME_TYPES,
  type AVControlState,
  isValidAvControl,
  OIPF,
  type OipfCapabilitiesState,
  type OipfConfigurationState,
  type VideoBroadcastState,
} from "@hbb-emu/oipf-api";
import type * as IO from "fp-ts/IO";
import type { BindingsEnv } from "../runtime";
import type { AnyOipfBinding, OipfBinding } from "../subsystems/provider";
import { type AVControlVideo, type AVControlVideoEventHandlers, createAVControlVideo } from "./av/control";
import { createAvStream } from "./av/control/stream";
import { createContainerVideoWindow } from "./av/control/videoWindow";
import { OipfApplicationManager } from "./dae/applicationManager";
import { OipfCapabilities } from "./dae/capabilities";
import { OipfConfiguration } from "./dae/configuration";
import { createVideoBroadcast, type VideoBroadcast, type VideoBroadcastEventHandlers } from "./dae/videoBroadcast";
import { createChannelVideoStreamEnv } from "./dae/videoBroadcast/channel";
import { createObjectVideoWindow } from "./dae/videoBroadcast/videoWindow";
import { type AudioOutput, audioInSeries, broadcastGain, linearGain } from "./dae/videoBroadcast/volume";
import { intrinsicEvent, noContext } from "./intrinsicEvents";

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
/**
 * An object's video, its volume in series with the TV's on the object's scale. The
 * page's `volume` accessor, which puts the application's own media in series with
 * the TV (`installMediaElementVolume`), leaves it alone: it would count the TV twice.
 */
const inSeries = (
  env: BindingsEnv,
  gain: (volume: number) => number,
  element: HTMLMediaElement,
  setMuted: AudioOutput["setMuted"],
  initialVolume?: number,
): AudioOutput => {
  env.emulatorMedia.add(element)();
  return audioInSeries(env.tvVolume, gain, element, setMuted, initialVolume)();
};

export const createVideoBroadcastBinding = (
  env: BindingsEnv,
): OipfBinding<VideoBroadcast, VideoBroadcastState, "videoBroadcast"> => ({
  name: "videoBroadcast",
  connector: {
    selector: `object[type="${OIPF.DAE.Broadcast.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Broadcast.isValidElement,
    attachStrategy: "visual-embedded",
    // OIPF width/height (numbers, bound to style.width/height) replace the native
    // HTMLObjectElement attribute reflection (strings).
    nativeOverrides: ["width", "height"],
  },
  factory: (element) => {
    const videoStream = createChannelVideoStreamEnv(env.getSharedPlayerRuntime() ?? undefined);
    return createVideoBroadcast({
      channelRegistry: env.channelRegistry,
      videoStream,
      audioOutput: inSeries(env, broadcastGain, videoStream.videoElement, videoStream.setMuted),
      videoWindow: createObjectVideoWindow(element, videoStream.videoElement),
      getTunedChannel: env.getCurrentChannel,
      requestChannelChange: env.requestChannelChange,
      onCurrentChannelChange: env.setCurrentChannel,
      streamEventScheduler: env.streamEventScheduler,
      fetchStreamEventDescription: env.fetchStreamEventDescription,
      baseURI: () => element.baseURI,
      defaults: env.defaultVideoBroadcast,
      eventHandlers: extractVideoBroadcastEventHandlers(element),
    });
  },
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
      keyset: env.keyset,
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
    selector: AV_CONTROL_MIME_TYPES.map((type) => `object[type="${type}"]`).join(", "),
    predicate: isValidAvControl,
    attachStrategy: "visual",
    // OIPF `data` (playback starts with `play()`) replaces the native attribute
    // reflection, which would have the browser load the media itself; OIPF `focus()`
    // focuses the object even where the browser would not.
    nativeOverrides: ["data", "focus"],
  },
  factory: (element) => {
    const stream = createAvStream(env.playerRuntimeFactory);
    return createAVControlVideo({
      mimeType: () => element.type,
      stream,
      audioOutput: inSeries(
        env,
        linearGain,
        stream.videoElement,
        stream.setMuted,
        env.defaultAvControlVideo.volume.volume,
      ),
      videoWindow: createContainerVideoWindow(element, stream.videoElement),
      focusObject: focusElement(element),
      defaults: env.defaultAvControlVideo,
      eventHandlers: extractAvControlEventHandlers(element),
    });
  },
});

/**
 * Gives the `<object>` the input focus. An `<object>` the browser does not render is
 * not focusable: it becomes so (`tabIndex = -1`, out of the tab order), as on a TV
 * where the A/V Control object can always take the focus.
 */
const focusElement =
  (element: HTMLObjectElement): IO.IO<void> =>
  () => {
    // The element's own `focus` is the OIPF one, which calls this.
    const focus = () => HTMLElement.prototype.focus.call(element);
    focus();
    if (element.ownerDocument.activeElement === element) return;
    element.tabIndex = -1;
    focus();
  };

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

  // OIPF DAE §7.14.9 and §7.14.3.2: the DOM events of the intrinsic ones.
  return {
    onPlayStateChange: intrinsicEvent(element, "PlayStateChange", noContext, (state: OIPF.AV.Control.PlayState) =>
      oipfElement.onPlayStateChange?.(state),
    ),
    onPlayPositionChanged: intrinsicEvent(
      element,
      "PlayPositionChanged",
      (position) => ({ position }),
      (position: number | undefined) => oipfElement.onPlayPositionChanged?.(position),
    ),
    onPlaySpeedChanged: intrinsicEvent(
      element,
      "PlaySpeedChanged",
      (speed) => ({ speed }),
      (speed: number) => oipfElement.onPlaySpeedChanged?.(speed),
    ),
    onFullScreenChange: intrinsicEvent(element, "FullScreenChange", noContext, (fullScreen: boolean) =>
      oipfElement.onFullScreenChange?.(fullScreen),
    ),
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

  type Channel = OIPF.DAE.Broadcast.Channel;
  // OIPF DAE §7.13.1.4: the DOM events of the intrinsic ones. `error` is undefined: no
  // state change of the emulator's is due to an error yet (§7.13.1.2).
  return {
    onPlayStateChange: intrinsicEvent(
      element,
      "PlayStateChange",
      (state) => ({ state, error: undefined }),
      (state: OIPF.DAE.Broadcast.PlayState) => oipfElement.onPlayStateChange?.(state),
    ),
    onFullScreenChange: intrinsicEvent(element, "FullScreenChange", noContext, (fullScreen: boolean) =>
      oipfElement.onFullScreenChange?.(fullScreen),
    ),
    onChannelChangeSucceeded: intrinsicEvent(
      element,
      "ChannelChangeSucceeded",
      (channel) => ({ channel }),
      (channel: Channel) => oipfElement.onChannelChangeSucceeded?.(channel),
    ),
    onChannelChangeError: intrinsicEvent(
      element,
      "ChannelChangeError",
      (channel, errorState) => ({ channel, errorState }),
      (channel: Channel | null, errorState: number) => oipfElement.onChannelChangeError?.(channel, errorState),
    ),
    // focus and blur are the browser's own events of the element.
    onfocus: () => {
      oipfElement.onfocus?.();
    },
    onblur: () => {
      oipfElement.onblur?.();
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
