import type { PlayerEvent, PlayerRuntime, PlayerState } from "@hbb-emu/player-runtime";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import type React from "react";
import { useMemo } from "react";
import { getMatcherSnapshot } from "./matchersSnapshot";

function PlayerControls({
  playerRuntime,
  playerState,
}: {
  playerRuntime: PlayerRuntime;
  playerState: PlayerState.Any | null;
}) {
  const snapshot = useMemo(() => getMatcherSnapshot(playerState), [playerState]);

  const canControl = snapshot.capabilities.find((i) => i.key === "canControl")?.value === true;
  const canSeek = snapshot.capabilities.find((i) => i.key === "canSeek")?.value === true;
  const isPlaying = snapshot.status.find((i) => i.key === "isPlaying")?.value === true;

  const dispatch = (event: PlayerEvent) => playerRuntime.dispatch(event)();

  const handlePlay = () => dispatch({ _tag: "Intent/PlayRequested" });
  const handlePause = () => dispatch({ _tag: "Intent/PauseRequested" });
  const handleSeek = (time: number) => dispatch({ _tag: "Intent/SeekRequested", time });

  return (
    <Stack direction="row" gap={1}>
      <Button variant="contained" onClick={handlePlay} disabled={!canControl || isPlaying}>
        Play
      </Button>
      <Button variant="contained" onClick={handlePause} disabled={!isPlaying}>
        Pause
      </Button>
      <Button variant="outlined" onClick={() => handleSeek(0)} disabled={!canSeek}>
        Restart
      </Button>
    </Stack>
  );
}

export function ControlsPanel({
  core,
  playerState,
  videoRef,
}: {
  core: PlayerRuntime;
  playerState: PlayerState.Any | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}) {
  return (
    <Paper sx={{ p: 1.25, bgcolor: "rgba(0,0,0,0.60)", color: "common.white" }}>
      <Typography variant="subtitle2" gutterBottom>
        Controls
      </Typography>

      <PlayerControls playerRuntime={core} playerState={playerState} />

      <Box sx={{ mt: 1.0, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {videoRef?.current?.src ? (
          <Chip size="small" label={`src: ${videoRef.current.src}`} sx={{ maxWidth: 380 }} />
        ) : null}
      </Box>
    </Paper>
  );
}
