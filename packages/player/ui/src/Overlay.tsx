import type { PlayerCore } from "@hbb-emu/player-core";
import * as Matchers from "@hbb-emu/player-core";
import { Alert, Box, CircularProgress, Stack } from "@mui/material";
import type React from "react";
import { useMemo } from "react";
import { usePlayerDebug } from "./hooks/usePlayerDebug";
import { ControlsPanel } from "./overlay/ControlsPanel";
import { MatchersPanel } from "./overlay/MatchersPanel";
import { StateInfoPanel } from "./overlay/StateInfoPanel";
import { TransitionsPanel } from "./overlay/TransitionsPanel";

export type PlayerUiOverlayProps = {
  readonly core: PlayerCore;
  readonly videoRef?: React.RefObject<HTMLVideoElement | null>;
};

export function Overlay({ core, videoRef }: PlayerUiOverlayProps) {
  const { playerState, entries, entriesVersion } = usePlayerDebug(core);

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
      }}
    >
      <Stack direction="row" gap={1} sx={{ flex: "0 0 auto" }}>
        <Stack sx={{ flex: 1, minHeight: 0, pointerEvents: "auto" }}>
          <TransitionsPanel entries={entries} entriesVersion={entriesVersion} />
        </Stack>
        <Stack gap={1} sx={{ width: 420, pointerEvents: "auto" }}>
          <ControlsPanel core={core} playerState={playerState} videoRef={videoRef} />
          <StateInfoPanel core={core} playerState={playerState} />
        </Stack>
        <Stack sx={{ flex: 1, minWidth: 360, pointerEvents: "auto" }}>
          <MatchersPanel playerState={playerState} />
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
