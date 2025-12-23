import { Box, Paper, Stack, Typography } from "@mui/material";
import { usePlayback } from "./PlaybackProvider";

function MatcherItem({ label, value }: { label: string; value: any }) {
  const color = value === true ? "success.main" : value === false ? "text.disabled" : "info.main";
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.25 }}>
      <Typography variant="body2">{label}:</Typography>
      <Typography variant="body2" sx={{ fontWeight: "bold", color }}>
        {JSON.stringify(value)}
      </Typography>
    </Box>
  );
}

export function MatchersPanel() {
  const { matcherResults } = usePlayback();

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Matchers
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
        <Paper sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            State Types
          </Typography>
          <MatcherItem label="isPlayable" value={matcherResults.isPlayable} />
          <MatcherItem label="isError" value={matcherResults.isError} />
          <MatcherItem label="isRecoverable" value={matcherResults.isRecoverable} />
          <MatcherItem label="isFatal" value={matcherResults.isFatal} />
          <MatcherItem label="isControlState" value={matcherResults.isControlState} />
          <MatcherItem label="isSourceState" value={matcherResults.isSourceState} />
          <MatcherItem label="isHLSState" value={matcherResults.isHLSState} />
          <MatcherItem label="isDASHState" value={matcherResults.isDASHState} />
          <MatcherItem label="isMP4State" value={matcherResults.isMP4State} />
        </Paper>

        <Paper sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Status
          </Typography>
          <MatcherItem label="isPlaying" value={matcherResults.isPlaying} />
          <MatcherItem label="isPaused" value={matcherResults.isPaused} />
          <MatcherItem label="isLoading" value={matcherResults.isLoading} />
        </Paper>

        <Paper sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Capabilities
          </Typography>
          <MatcherItem label="canSeek" value={matcherResults.canSeek} />
          <MatcherItem label="canControl" value={matcherResults.canControl} />
        </Paper>
      </Stack>

      <Paper sx={{ p: 1.5, mt: 1.5, fontFamily: "monospace" }}>
        <Typography variant="subtitle2" gutterBottom>
          Extracted Data
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap">
          <Box sx={{ flex: "1 1 45%" }}>
            <Typography variant="body2">
              <strong>getCurrentTime():</strong> {JSON.stringify(matcherResults.currentTime)}
            </Typography>
          </Box>
          <Box sx={{ flex: "1 1 45%" }}>
            <Typography variant="body2">
              <strong>getDuration():</strong> {JSON.stringify(matcherResults.duration)}
            </Typography>
          </Box>
          <Box sx={{ flex: "1 1 45%" }}>
            <Typography variant="body2">
              <strong>getError():</strong> {JSON.stringify(matcherResults.error?.message ?? null)}
            </Typography>
          </Box>
          <Box sx={{ flex: "1 1 45%" }}>
            <Typography variant="body2">
              <strong>getRetryCount():</strong> {JSON.stringify(matcherResults.retryCount)}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
