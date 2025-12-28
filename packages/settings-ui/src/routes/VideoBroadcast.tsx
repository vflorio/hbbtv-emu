import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { useAppState, useVideoBroadcast } from "../hooks";

// Broadcast PlayState enum values
const PLAY_STATE_OPTIONS = [
  { value: 0, label: "UNREALIZED" },
  { value: 1, label: "CONNECTING" },
  { value: 2, label: "PRESENTING" },
  { value: 3, label: "STOPPED" },
];

export default function VideoBroadcastTab() {
  const { isLoading } = useAppState();
  const { videoBroadcast, update } = useVideoBroadcast();

  const [playState, setPlayState] = useState<number>(videoBroadcast.playState ?? 0);
  const [volume, setVolume] = useState(videoBroadcast.volume ?? 100);
  const [muted, setMuted] = useState(videoBroadcast.muted ?? false);
  const [fullScreen, setFullScreen] = useState(videoBroadcast.fullScreen ?? false);
  const [width, setWidth] = useState(videoBroadcast.width ?? 1280);
  const [height, setHeight] = useState(videoBroadcast.height ?? 720);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setPlayState(videoBroadcast.playState ?? 0);
    setVolume(videoBroadcast.volume ?? 100);
    setMuted(videoBroadcast.muted ?? false);
    setFullScreen(videoBroadcast.fullScreen ?? false);
    setWidth(videoBroadcast.width ?? 1280);
    setHeight(videoBroadcast.height ?? 720);
    setIsEditing(false);
  }, [videoBroadcast]);

  const handleSave = pipe(
    TE.of({
      ...videoBroadcast,
      playState: playState as 0 | 1 | 2 | 3,
      volume,
      muted,
      fullScreen,
      width,
      height,
    }),
    TE.tap((newVideoBroadcast) => update(newVideoBroadcast)),
    TE.tapIO(() => () => {
      setIsEditing(false);
    }),
  );

  const handleCancel = () => {
    setPlayState(videoBroadcast.playState ?? 0);
    setVolume(videoBroadcast.volume ?? 100);
    setMuted(videoBroadcast.muted ?? false);
    setFullScreen(videoBroadcast.fullScreen ?? false);
    setWidth(videoBroadcast.width ?? 1280);
    setHeight(videoBroadcast.height ?? 720);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  return (
    <Panel
      title="Broadcast"
      actions={
        isEditing && (
          <Stack direction="row" gap={2}>
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
            <Button variant="outlined" onClick={handleCancel}>
              Cancel
            </Button>
          </Stack>
        )
      }
    >
      <Stack gap={3} sx={{ mt: 3 }}>
        {/* Play State */}
        <FormControl fullWidth>
          <InputLabel>Play State</InputLabel>
          <Select
            readOnly
            value={playState}
            label="Play State"
            onChange={(e) => {
              setPlayState(e.target.value as number);
              setIsEditing(true);
            }}
          >
            {PLAY_STATE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label} ({opt.value})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Volume */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Volume: {volume}%
          </Typography>
          <Slider
            value={volume}
            onChange={(_, value) => {
              setVolume(value as number);
              setIsEditing(true);
            }}
            min={0}
            max={100}
            valueLabelDisplay="auto"
          />
        </Box>

        {/* Muted */}
        <FormControlLabel
          control={
            <Switch
              checked={muted}
              onChange={(e) => {
                setMuted(e.target.checked);
                setIsEditing(true);
              }}
            />
          }
          label="Muted"
        />

        {/* Full Screen */}
        <FormControlLabel
          control={
            <Switch
              checked={fullScreen}
              onChange={(e) => {
                setFullScreen(e.target.checked);
                setIsEditing(true);
              }}
            />
          }
          label="Full Screen"
        />

        {/* Dimensions */}
        <Stack direction="row" gap={2}>
          <TextField
            type="number"
            label="Width"
            value={width}
            onChange={(e) => {
              setWidth(parseInt(e.target.value, 10) || 0);
              setIsEditing(true);
            }}
            inputProps={{ min: 0 }}
            sx={{ flex: 1 }}
          />
          <TextField
            type="number"
            label="Height"
            value={height}
            onChange={(e) => {
              setHeight(parseInt(e.target.value, 10) || 0);
              setIsEditing(true);
            }}
            inputProps={{ min: 0 }}
            sx={{ flex: 1 }}
          />
        </Stack>

        {/* Current Channel (read-only info) */}
        {videoBroadcast.currentChannel && (
          <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              Current Channel
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Name: {videoBroadcast.currentChannel.name ?? "Unknown"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              CCID: {videoBroadcast.currentChannel.ccid ?? "N/A"}
            </Typography>
          </Box>
        )}
      </Stack>
    </Panel>
  );
}
