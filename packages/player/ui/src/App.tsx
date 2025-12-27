import type { PlayerRuntime } from "@hbb-emu/player-runtime";
import type React from "react";
import { Overlay } from "./Overlay";

export default function App({
  core,
  videoRef,
}: {
  core: PlayerRuntime;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}) {
  return <Overlay core={core} videoRef={videoRef} />;
}
