import { match } from "ts-pattern";

/**
 * Match on runtime events (not PlayerState)
 *
 * @example
 * matchPlayerEvent(event)
 *   .with({ _tag: 'Engine/VolumeChanged' }, (e) => console.log('Volume:', e.volume))
 *   .with({ _tag: 'Adapter/Created' }, () => console.log('Adapter ready'))
 *   .otherwise(() => {});
 */
export const matchPlayerEvent = <T>(event: any): ReturnType<typeof match<any, T>> => match<any, T>(event);

/**
 * Type guard: Check if event is volume change
 */
export const isVolumeChangeEvent = (
  event: any,
): event is { _tag: "Engine/VolumeChanged"; volume: number; muted: boolean } => event?._tag === "Engine/VolumeChanged";

/**
 * Type guard: Check if event is adapter created
 */
export const isAdapterCreatedEvent = (event: any): event is { _tag: "Adapter/Created" } =>
  event?._tag === "Adapter/Created";

/**
 * Type guard: Check if event is adapter destroyed
 */
export const isAdapterDestroyedEvent = (event: any): event is { _tag: "Adapter/Destroyed" } =>
  event?._tag === "Adapter/Destroyed";

/**
 * Type guard: Check if event is metadata loaded
 */
export const isMetadataLoadedEvent = (event: any): event is { _tag: "Adapter/MetadataLoaded" } =>
  event?._tag === "Adapter/MetadataLoaded";
