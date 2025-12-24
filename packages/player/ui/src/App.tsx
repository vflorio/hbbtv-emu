import type { PlayerCore } from "@hbb-emu/player-core";
import type React from "react";
import { Overlay } from "./Overlay";

export default function App({
  core,
  videoRef,
}: {
  core: PlayerCore;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}) {
  return <Overlay core={core} videoRef={videoRef} />;
}
