import type { PlayerRuntime } from "@hbb-emu/player-runtime";
import * as Matchers from "@hbb-emu/player-runtime";
import { Alert, Box, CircularProgress, Stack } from "@mui/material";
import type React from "react";
import { useMemo } from "react";
import { usePlayerDebug } from "./hooks/usePlayerDebug";
import { ControlsPanel } from "./overlay/ControlsPanel";
import { MatchersPanel } from "./overlay/MatchersPanel";
import { StateInfoPanel } from "./overlay/StateInfoPanel";
import { TransitionsPanel } from "./overlay/TransitionsPanel";

export type PlayerUiOverlayProps = {
  readonly core: PlayerRuntime;
  readonly videoRef?: React.RefObject<HTMLVideoElement | null>;
};

export function Overlay({ core, videoRef }: PlayerUiOverlayProps) {
  const { playerState, entries } = usePlayerDebug(core);

  const error = useMemo(() => (playerState ? (Matchers.getError(playerState)?.message ?? null) : null), [playerState]);
  const loading = useMemo(() => (playerState ? Matchers.isLoading(playerState) : false), [playerState]);

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        p: 1,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        pointerEvents: "none",
        height: "calc(100% - 84px)",
      }}
    >
      <Stack direction="row" gap={1} sx={{ flex: "1 1 auto", minHeight: 0 }}>
        <Stack gap={1} sx={{ width: 420, flexShrink: 0, minHeight: 0, overflow: "auto", pointerEvents: "auto" }}>
          <StateInfoPanel playerRuntime={core} playerState={playerState} />
          <ControlsPanel core={core} playerState={playerState} videoRef={videoRef} />
          <MatchersPanel playerState={playerState} />
        </Stack>
        <Stack sx={{ flex: 1, minHeight: 0, minWidth: 0, maxWidth: 600, pointerEvents: "auto" }}>
          <TransitionsPanel entries={entries} />
        </Stack>
      </Stack>

      {error ? (
        <Box sx={{ position: "absolute", left: 8, right: 8, bottom: 8, pointerEvents: "auto" }}>
          <Alert severity="error" sx={{ fontFamily: "monospace" }}>
            {error}
          </Alert>
        </Box>
      ) : null}
      {loading ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(0,0,0,0.25)",
          }}
        >
          <CircularProgress />
        </Box>
      ) : null}
    </Box>
  );
}
