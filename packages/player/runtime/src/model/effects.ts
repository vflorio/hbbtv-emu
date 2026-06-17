import type { PlaybackType } from "./playback";

export type PlayerEffect =
  | { readonly _tag: "Effect/CreateAdapter"; readonly playbackType: PlaybackType; readonly url: string }
  | { readonly _tag: "Effect/DestroyAdapter" }
  | { readonly _tag: "Effect/AttachVideoElement" }
  | { readonly _tag: "Effect/LoadSource"; readonly url: string }
  | { readonly _tag: "Effect/Play" }
  | { readonly _tag: "Effect/Pause" }
  | { readonly _tag: "Effect/Seek"; readonly time: number }
  | { readonly _tag: "Effect/SetVolume"; readonly volume: number }
  | { readonly _tag: "Effect/SetMuted"; readonly muted: boolean };
