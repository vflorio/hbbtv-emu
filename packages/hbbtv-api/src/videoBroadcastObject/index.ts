import { type ClassType, compose, type MessageBus } from "@hbb-emu/lib";
import { WithAudio } from "./audio";
import { WithChannel } from "./channel";
import { WithChannelList } from "./channelList";
import { WithChannelStreamAdapter } from "./channelStreamAdapter";
import { WithComponents } from "./components";
import { WithDisplay } from "./display";
import { WithEventTarget } from "./eventTarget";
import { WithParentalControl } from "./parentalControl";
import { WithPlayback } from "./playback";
import { WithProgrammes } from "./programmes";
import { WithStreamEvents } from "./streamEvents";
import { WithVideoElement } from "./videoElement";

export const WithVideoBroadcastObject = <T extends ClassType<MessageBus.Type>>(Base: T) =>
  compose(
    Base,
    WithChannelStreamAdapter,
    WithVideoElement,
    WithEventTarget,
    WithPlayback,
    WithChannelList,
    WithChannel,
    WithStreamEvents,
    WithComponents,
    WithAudio,
    WithDisplay,
    WithProgrammes,
    WithParentalControl,
  );

export type VideoBroadcastObject = InstanceType<ReturnType<typeof WithVideoBroadcastObject>>;
