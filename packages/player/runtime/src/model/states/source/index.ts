import type { DASH } from "./dash";
import type { HLS } from "./hls";
import type { Native } from "./native";

export * from "./dash";
export * from "./hls";
export * from "./native";

export type Any = Native.Any | HLS.Any | DASH.Any;
