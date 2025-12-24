import { NativeAdapter } from "@hbb-emu/player-adapter-web";
import * as Matchers from "@hbb-emu/player-core";
import { PlayerCore, type PlayerEvent, type PlayerState } from "@hbb-emu/player-core";
import { Overlay } from "@hbb-emu/player-ui";
import { Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import * as O from "fp-ts/Option";
import { useEffect, useMemo, useRef, useState } from "react";

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

const usePlayerCore = (options: { readonly onDispatch?: (event: PlayerEvent) => void }): PlayerCore => {
  const playerCore = useMemo(
    () =>
      new PlayerCore({
        onDispatch: options.onDispatch,
        adapters: {
          native: new NativeAdapter(),
          hls: new NativeAdapter(),
          dash: new NativeAdapter(),
        },
      }),
    [],
  );

  return playerCore;
};

export function PlayerDemo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState.Any | null>(null);

  const core = usePlayerCore({
    onDispatch: (event) => {
      console.log("[PlayerDemo] Dispatched event:", event);
    },
  });

  useEffect(() => {
    if (!videoRef.current) return;
    core.mount(videoRef.current)();
  }, [core]);

  useEffect(() => {
    const unsubscribe = core.subscribe((state) => setPlayerState(state))();
    return () => unsubscribe();
  }, [core]);

  const isLoading = useMemo(() => (playerState ? Matchers.isLoading(playerState) : false), [playerState]);

  return (
    <Stack p={2} gap={2} direction={"row"} width={"100%"} height={"100%"}>
      <Box
        sx={{
          position: "relative",
          height: "100%",
          width: "100%",
          bgcolor: "black",
          aspectRatio: "16 / 9",
          overflow: "hidden",
        }}
      >
        <Box component="video" ref={videoRef} controls sx={{ width: "100%", height: "100%" }} />
        <Overlay core={core} videoRef={videoRef} />
      </Box>
      <SourceControl core={core} isLoading={isLoading} />
    </Stack>
  );
}

function SourceControl({ core, isLoading }: { core: PlayerCore; isLoading: boolean }) {
  const [inputSource, setInputSource] = useState<string>(sampleSources[0].url);

  const playbackType = useMemo(() => {
    const opt = core.getPlaybackType();
    return O.isSome(opt) ? opt.value : null;
  }, [core, isLoading]);

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
