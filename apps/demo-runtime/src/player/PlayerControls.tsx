import { Button, Stack } from "@mui/material";
import { usePlayback } from "./PlaybackProvider";

export function PlayerControls() {
  const { dispatch, matcherResults } = usePlayback();

  const handlePlay = () => dispatch({ _tag: "Intent/PlayRequested" });
  const handlePause = () => dispatch({ _tag: "Intent/PauseRequested" });
  const handleSeek = (time: number) => dispatch({ _tag: "Intent/SeekRequested", time });

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
      <Button
        variant="contained"
        onClick={handlePlay}
        disabled={!matcherResults.canControl || matcherResults.isPlaying}
      >
        Play
      </Button>
      <Button variant="contained" onClick={handlePause} disabled={!matcherResults.isPlaying}>
        Pause
      </Button>
      <Button variant="outlined" onClick={() => handleSeek(0)} disabled={!matcherResults.canSeek}>
        Restart
      </Button>
    </Stack>
  );
}
