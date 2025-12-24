import { Alert, Stack } from "@mui/material";
import { MatchersPanel } from "./player/MatchersPanel";
import PlaybackProvider, { usePlayback } from "./player/PlaybackProvider";
import { PlayerControls } from "./player/PlayerControls";
import { SourceControl } from "./player/SourceControl";
import { StateInfo } from "./player/StateInfo";

function App() {
  const { error, renderVideoElement } = usePlayback();
  return (
    <Stack gap={2} p={2}>
      <Stack gap={2} direction={"row"}>
        <Stack gap={2}>
          {renderVideoElement()}
          {error && (
            <Alert severity="error" sx={{ mb: 3, fontFamily: "monospace" }}>
              {error}
            </Alert>
          )}
          <PlayerControls />
        </Stack>
        <Stack gap={2}>
          <SourceControl />
          <StateInfo />
        </Stack>
        <MatchersPanel />
      </Stack>
    </Stack>
  );
}

export function PlayerDemo() {
  return (
    <PlaybackProvider>
      <App />
    </PlaybackProvider>
  );
}
