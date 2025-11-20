import { compose } from "../utils";
import { WithAudio } from "./audio";
import { WithChannel } from "./channel";
import { WithComponents } from "./components";
import { WithDisplay } from "./display";
import { WithParentalControl } from "./parentalControl";
import { WithPlayback } from "./playback";
import { WithProgrammes } from "./programmes";
import { WithStreamEvents } from "./streamEvents";
import { WithVideoElement } from "./videoElement";

// Compose all mixins into a single class
export const VideoBroadcastObject = compose(
  class {},
  WithVideoElement,
  WithPlayback,
  WithChannel,
  WithStreamEvents,
  WithComponents,
  WithAudio,
  WithDisplay,
  WithProgrammes,
  WithParentalControl,
);

// Export the type
export type VideoBroadcastObject = InstanceType<typeof VideoBroadcastObject>;

export { ChannelChangeError } from "./channel";
export { type AVComponent, ComponentType } from "./components";
// Re-export types and enums for convenience
export { PlayState } from "./playback";
export type { StreamEvent, StreamEventDetail, StreamEventListener } from "./streamEvents";
export type { VideoChannelBackendCallbacks as VideoBackendCallbacks } from "./videoChannel";
export { VideoChannelBackend as VideoBackend } from "./videoChannel";
