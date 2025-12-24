import type { PlayerCore, PlayerState } from "@hbb-emu/player-core";
import { Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import * as O from "fp-ts/Option";
import { useEffect, useMemo, useState } from "react";

const sampleSources = [
  {
    label: "MP4 (Big Buck Bunny)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  { label: "HLS (Mux)", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
  {
    label: "DASH (Tears of Steel)",
    url: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
  },
] as const;

export function SourceControl({ core, isLoading }: { core: PlayerCore; isLoading: boolean }) {
  const [inputSource, setInputSource] = useState<string>(sampleSources[0].url);
  const [playerState, setPlayerState] = useState<PlayerState.Any | null>(null);

  useEffect(() => {
    const unsubscribe = core.subscribeToState(setPlayerState)();
    return () => unsubscribe();
  }, [core]);

  const playbackType = useMemo(() => {
    const opt = core.getPlaybackType();
    return O.isSome(opt) ? opt.value : null;
  }, [core, playerState]);

  const loadSource = (url: string) => core.dispatch({ _tag: "Intent/LoadRequested", url })();

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Source Control
      </Typography>

      <Stack gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
        {sampleSources.map((sample) => (
          <Button
            key={sample.label}
            variant="outlined"
            size="small"
            onClick={() => {
              setInputSource(sample.url);
              loadSource(sample.url);
            }}
            disabled={isLoading}
          >
            {sample.label}
          </Button>
        ))}
      </Stack>

      <Stack direction="row" gap={1} alignItems="center">
        <TextField
          fullWidth
          size="small"
          value={inputSource}
          onChange={(e) => setInputSource(e.target.value)}
          placeholder="Enter video URL (HLS .m3u8, DASH .mpd, MP4)"
          disabled={isLoading}
        />
        <Button
          variant="contained"
          onClick={() => loadSource(inputSource.trim())}
          disabled={isLoading || !inputSource.trim()}
        >
          {isLoading ? "Loading..." : "Load"}
        </Button>
      </Stack>

      {playbackType ? (
        <Box sx={{ mt: 1.5 }}>
          <Chip
            label={`Active: ${playbackType}`}
            color={playbackType === "hls" ? "success" : playbackType === "dash" ? "info" : "warning"}
            size="small"
          />
        </Box>
      ) : null}
    </Paper>
  );
}
