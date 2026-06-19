import { createPlayer, type Player, type SDK } from "@functional-player/freewheel";
import { useCallback, useEffect, useRef, useState } from "react";
import { match } from "ts-pattern";
import { config } from "./main";
import { type ButtonPhase, PlayerUI } from "./PlayerUI";

export function FwPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [phase, setPhase] = useState<ButtonPhase>("init");

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const SDK = (window as any).tv.freewheel.SDK as SDK;

    const adManager = new SDK.AdManager();
    adManager.setNetwork(config.networkId);
    adManager.setServer(config.serverURL);

    const adContext = adManager.newContext();
    adContext.setProfile(config.profileId);
    adContext.setVideoAsset(config.videoAssetId, config.videoDuration);
    adContext.setSiteSection(config.siteSectionId);

    playerRef.current = createPlayer({ adContext, videoEl, SDK });
  }, []);

  const handleClick = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    match(phase)
      .with("init", () => {
        setPhase("playing");
        player.requestAds();
      })
      .with("playing", () => {
        setPhase("paused");
        player.pause();
      })
      .with("paused", () => {
        setPhase("playing");
        player.resume();
      })
      .exhaustive();
  }, [phase]);

  return <PlayerUI phase={phase} onButtonClick={handleClick} videoRef={videoRef} />;
}
