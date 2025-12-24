import type { PlayerState } from "@hbb-emu/player-core";
import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { getMatcherSnapshot } from "./matchersSnapshot";

export function MatchersPanel({ playerState }: { playerState: PlayerState.Any | null }) {
  const snapshot = useMemo(() => getMatcherSnapshot(playerState), [playerState]);

  const MatcherItem = ({ label, value }: { label: string; value: unknown }) => {
    const color = value === true ? "success.light" : value === false ? "text.disabled" : "info.light";
    return (
      <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.25 }}>
        <Typography variant="caption">{label}:</Typography>
        <Typography variant="caption" sx={{ fontWeight: "bold", color }}>
          {JSON.stringify(value)}
        </Typography>
      </Box>
    );
  };

  return (
    <Paper sx={{ p: 1.25, bgcolor: "rgba(0,0,0,0.60)", color: "common.white" }}>
      <Typography variant="subtitle2" gutterBottom>
        Matchers
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} gap={1.25}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            State Types
          </Typography>
          {snapshot.stateTypes.map((i) => (
            <MatcherItem key={i.key} label={i.label} value={i.value} />
          ))}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Status
          </Typography>
          {snapshot.status.map((i) => (
            <MatcherItem key={i.key} label={i.label} value={i.value} />
          ))}

          <Divider sx={{ my: 0.75, borderColor: "rgba(255,255,255,0.20)" }} />

          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Capabilities
          </Typography>
          {snapshot.capabilities.map((i) => (
            <MatcherItem key={i.key} label={i.label} value={i.value} />
          ))}
        </Box>
      </Stack>

      <Divider sx={{ my: 0.75, borderColor: "rgba(255,255,255,0.20)" }} />

      <Box sx={{ fontFamily: "monospace" }}>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          Extracted Data
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1} flexWrap="wrap">
          {snapshot.extracted.map((i) => (
            <Box key={i.key} sx={{ flex: "1 1 45%" }}>
              <Typography variant="caption">
                <strong>{i.label}:</strong> {JSON.stringify(i.value)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Paper>
  );
}
