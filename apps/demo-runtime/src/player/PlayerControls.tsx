import { Button, Stack } from "@mui/material";
import { usePlayback } from "./PlaybackProvider";

export function PlayerControls() {
  const { videoElement, matcherResults } = usePlayback();

  const handlePlay = () => videoElement?.play().catch(console.error);
  const handlePause = () => videoElement?.pause();
  const handleSeek = (time: number) => {
    if (videoElement) videoElement.currentTime = time;
  };

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
