import type { PlayerEngineEvent } from "./engine/core";
import type { PlayerIntentEvent } from "./intents";
import type { PlayerRuntimeError } from "./runtime";

export * from "./effects";
export * from "./engine/adapter/dash";
export * from "./engine/adapter/hls";
export * from "./engine/adapter/native";
export * from "./engine/core";
export * from "./intents";
export * from "./playback";
export * from "./runtime";

export type PlayerEvent = PlayerIntentEvent | PlayerEngineEvent | PlayerRuntimeError;

export type PlayerEventListener = (event: PlayerEvent) => void;

export type PlayerStateListener<T> = (state: T) => void;

export type UnsubscribeFn = () => void;
