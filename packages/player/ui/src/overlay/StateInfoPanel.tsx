import type { PlayerRuntime, PlayerState } from "@hbb-emu/player-runtime";
import * as Matchers from "@hbb-emu/player-runtime";
import { Box, Paper, Stack, Typography } from "@mui/material";
import * as O from "fp-ts/Option";
import { useMemo } from "react";
import { getMatcherSnapshot } from "./matchersSnapshot";

export function StateInfoPanel({
  playerRuntime,
  playerState,
}: {
  playerRuntime: PlayerRuntime;
  playerState: PlayerState.Any | null;
}) {
  const snapshot = useMemo(() => getMatcherSnapshot(playerState), [playerState]);

  const playbackType: string | null = useMemo(() => {
    const opt = playerRuntime.getPlaybackType();
    return O.isSome(opt) ? opt.value : null;
  }, [playerRuntime, playerState]);

  const currentTime = playerState
    ? (snapshot.extracted.find((i) => i.key === "getCurrentTime")?.value as number | null)
    : null;
  const duration = playerState
    ? (snapshot.extracted.find((i) => i.key === "getDuration")?.value as number | null)
    : null;

  return (
    <Paper sx={{ p: 1.25, bgcolor: "rgba(0,0,0,0.8)", color: "common.white" }}>
      <Typography variant="subtitle2" gutterBottom>
        Current State
      </Typography>

      <Box
        sx={{
          p: 1.0,
          bgcolor: "rgba(255,255,255,0.08)",
          borderRadius: 1,
          fontFamily: "monospace",
          fontSize: "0.80rem",
          mb: 1.0,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: "bold", color: "primary.light", display: "block" }}>
          {playerState?._tag || "No state"}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          {snapshot.description || "Waiting..."}
        </Typography>
      </Box>

      <Stack direction="row" gap={1} flexWrap="wrap">
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="caption">
            <strong>Playback Type:</strong> {playbackType || "None"}
          </Typography>
        </Box>
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="caption">
            <strong>Tag Group:</strong> {playerState?._tagGroup || "None"}
          </Typography>
        </Box>
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="caption">
            <strong>Time:</strong> {typeof currentTime === "number" ? currentTime.toFixed(1) : "0.0"}s /{" "}
            {typeof duration === "number" ? duration.toFixed(1) : "0.0"}s
          </Typography>
        </Box>
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="caption">
            <strong>Buffered:</strong> {playerState ? (Matchers.getBufferedRanges(playerState)?.length ?? 0) : 0} ranges
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
