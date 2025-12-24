import { createLogger } from "@hbb-emu/core";
import { isLoading, type PlayerState } from "@hbb-emu/player-core";
import { Overlay } from "@hbb-emu/player-ui";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { useEffect, useRef, useState } from "react";
import { SourceControl } from "./SourceControl";
import { usePlayerCore } from "./usePlayerCore";

const logger = createLogger("DemoRuntime:Player");

export function PlayerDemo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState.Any | null>(null);

  const core = usePlayerCore();

  useEffect(() => {
    if (!videoRef.current) return;
    core.mount(videoRef.current)();
  }, [core]);

  useEffect(() => {
    const unsubscribe = core.subscribeToState((state) => setPlayerState(state))();
    return () => unsubscribe();
  }, [core]);

  useEffect(() => {
    const unsubscribe = core.subscribeToEvents((event) => {
      logger.info("Dispatched event:", event)();
    })();
    return () => unsubscribe();
  }, [core]);

  return (
    <Stack p={2} gap={2} direction={"row"} width={"100%"} height={"100%"}>
      <Box
        sx={{
          position: "relative",
          height: "100%",
          width: "100%",
          bgcolor: "black",
          aspectRatio: "16 / 9",
          overflow: "hidden",
        }}
      >
        <Box component="video" ref={videoRef} controls sx={{ width: "100%", height: "100%" }} />
        <Overlay core={core} videoRef={videoRef} />
      </Box>
      <SourceControl core={core} isLoading={playerState ? isLoading(playerState) : true} />
    </Stack>
  );
}
