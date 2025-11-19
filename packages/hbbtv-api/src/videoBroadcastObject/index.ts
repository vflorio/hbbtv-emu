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
