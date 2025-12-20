import { Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { usePlayback } from "./PlaybackProvider";

export function SourceControl() {
  const { loadSource, isLoading, playback } = usePlayback();
  const [inputSource, setInputSource] = useState("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");

  const handleLoad = () => loadSource(inputSource.trim());

  const sampleSources = [
    { label: "HLS (Mux)", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
    {
      label: "MP4 (Big Buck Bunny)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    },
    {
      label: "DASH (Tears of Steel)",
      url: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
    },
  ];

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Source Control
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
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

      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          fullWidth
          size="small"
          value={inputSource}
          onChange={(e) => setInputSource(e.target.value)}
          placeholder="Enter video URL (HLS .m3u8, DASH .mpd, MP4)"
          disabled={isLoading}
        />
        <Button variant="contained" onClick={handleLoad} disabled={isLoading || !inputSource.trim()}>
          {isLoading ? "Loading..." : "Load"}
        </Button>
      </Stack>
      {playback && (
        <Box sx={{ mt: 1.5 }}>
          <Chip
            label={`Active: ${playback._tag}`}
            color={playback._tag === "hls" ? "success" : playback._tag === "dash" ? "info" : "warning"}
            size="small"
          />
        </Box>
      )}
    </Paper>
  );
}
