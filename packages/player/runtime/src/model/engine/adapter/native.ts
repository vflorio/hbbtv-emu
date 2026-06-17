export type PlayerEngineNativeEvent = {
  readonly _tag: "Engine/Adapter/Native/ProgressiveLoading";
  readonly url: string;
  readonly bytesLoaded: number;
  readonly bytesTotal: number;
  readonly canPlayThrough: boolean;
};

// TODO: Implement browser-native HLS playback (chrome 148+)
