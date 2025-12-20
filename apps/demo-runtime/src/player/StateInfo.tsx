import { Box, Paper, Stack, Typography } from "@mui/material";
import { usePlayback } from "./PlaybackProvider";

export function StateInfo() {
  const { playerState, playback, matcherResults } = usePlayback();

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Current State
      </Typography>
      <Box
        sx={{
          p: 1.5,
          bgcolor: "background.default",
          borderRadius: 1,
          fontFamily: "monospace",
          fontSize: "0.875rem",
          mb: 1.5,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold", color: "primary.main", mb: 0.5 }}>
          {playerState?._tag || "No state"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {matcherResults.description || "Waiting..."}
        </Typography>
      </Box>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="body2">
            <strong>Playback Type:</strong> {playback?._tag || "None"}
          </Typography>
        </Box>
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="body2">
            <strong>Tag Group:</strong> {playerState?._tagGroup || "None"}
          </Typography>
        </Box>
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="body2">
            <strong>Time:</strong> {matcherResults.currentTime?.toFixed(1) ?? "0.0"}s /{" "}
            {matcherResults.duration?.toFixed(1) ?? "0.0"}s
          </Typography>
        </Box>
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="body2">
            <strong>Buffered:</strong> {matcherResults.bufferedRanges?.length ?? 0} ranges
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
