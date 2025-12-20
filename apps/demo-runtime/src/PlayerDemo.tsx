import { Alert, Container, Typography } from "@mui/material";
import { useEffect } from "react";
import { MatchersPanel } from "./player/MatchersPanel";
import { PlaybackProvider, usePlayback } from "./player/PlaybackProvider";
import { PlayerControls } from "./player/PlayerControls";
import { SourceControl } from "./player/SourceControl";
import { StateInfo } from "./player/StateInfo";

function App() {
  const { error, loadSource } = usePlayback();

  useEffect(() => {
    loadSource("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h3" gutterBottom>
        Player
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: "monospace" }}>
          {error}
        </Alert>
      )}
      <SourceControl />
      <PlayerControls />
      <StateInfo />
      <MatchersPanel />
    </Container>
  );
}

export function PlayerDemo() {
  return (
    <PlaybackProvider>
      <App />
    </PlaybackProvider>
  );
}
