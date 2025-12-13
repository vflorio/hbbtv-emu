import { compose, createStatefulMethods, deriveSchema, type OnStateChangeCallback, type Stateful } from "@hbb-emu/core";
import { type OIPF, type VideoBroadcastState, VideoBroadcastStateCodec } from "@hbb-emu/oipf";
import type * as IO from "fp-ts/IO";
import { ObjectVideoStream } from "../../providers/videoStream/objectVideoStream";
import { WithChannelAPI } from "./channel";
import { WithComponentAPI } from "./component";
import { WithControllerAPI } from "./controller";
import { WithDisplayAPI } from "./display";
import { WithMiscAPI } from "./misc";
import { WithStreamEventAPI } from "./streamEvent";
import { WithVolumeAPI } from "./volume";

class VideoBroadcastWithVideoStream
  extends compose(
    ObjectVideoStream,
    WithChannelAPI,
    WithComponentAPI,
    WithDisplayAPI,
    WithVolumeAPI,
    WithStreamEventAPI,
    WithMiscAPI,
    WithControllerAPI,
  )
  implements OIPF.DAE.Broadcast.VideoBroadcast {}

export class VideoBroadcast extends VideoBroadcastWithVideoStream implements Stateful<VideoBroadcastState> {
  readonly stateful = createStatefulMethods(
    deriveSchema<VideoBroadcastState, VideoBroadcastWithVideoStream>(VideoBroadcastStateCodec, {
      mappings: {
        playState: "_playState",
        fullScreen: "_fullScreen",
        width: "_width",
        height: "_height",
        currentChannel: "_currentChannel",
        programmes: "_programmes",
        volume: "_volume",
        muted: "_muted",
        components: "_components",
        selectedComponents: "_selectedComponents",
        streamEventListeners: "_streamEventListeners",
      },
    }),
    this,
  );

  applyState = (state: Partial<VideoBroadcastState>): IO.IO<void> => this.stateful.applyState(state);

  getState = (): IO.IO<Partial<VideoBroadcastState>> => this.stateful.getState();

  subscribe = (callback: OnStateChangeCallback<VideoBroadcastState>): IO.IO<() => void> =>
    this.stateful.subscribe(callback);

  notifyStateChange = (changedKeys: ReadonlyArray<keyof VideoBroadcastState>): IO.IO<void> =>
    this.stateful.notifyStateChange(changedKeys);
}
