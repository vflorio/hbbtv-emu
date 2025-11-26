import { compose, WithMessageBus } from "@hbb-emu/lib";
import { WithAudio } from "./audio";
import { WithChannel } from "./channel";
import { WithComponents } from "./components";
import { WithDisplay } from "./display";
import { WithEventTarget } from "./eventTarget";
import { WithParentalControl } from "./parentalControl";
import { WithPlayback } from "./playback";
import { WithProgrammes } from "./programmes";
import { WithStreamEvents } from "./streamEvents";
import { WithVideoElement } from "./videoElement";

export const VideoBroadcastObject = compose(
  class {},
  WithMessageBus("CONTENT_SCRIPT"),
  WithVideoElement,
  WithEventTarget,
  WithPlayback,
  WithChannel,
  WithStreamEvents,
  WithComponents,
  WithAudio,
  WithDisplay,
  WithProgrammes,
  WithParentalControl,
);
