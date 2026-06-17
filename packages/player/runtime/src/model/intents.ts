export type PlayerIntentEvent =
  | { readonly _tag: "Intent/LoadRequested"; readonly url: string }
  | { readonly _tag: "Intent/PlayRequested" }
  | { readonly _tag: "Intent/PauseRequested" }
  | { readonly _tag: "Intent/SeekRequested"; readonly time: number }
  | { readonly _tag: "Intent/SetVolumeRequested"; readonly volume: number }
  | { readonly _tag: "Intent/SetMutedRequested"; readonly muted: boolean };
