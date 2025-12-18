import type { VideoBroadcastState } from "@hbb-emu/oipf";
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
import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { useAppState, useDispatch, useSideEffects } from "../context/state";

// Broadcast PlayState enum values
const PLAY_STATE_OPTIONS = [
  { value: 0, label: "UNREALIZED" },
  { value: 1, label: "CONNECTING" },
  { value: 2, label: "PRESENTING" },
  { value: 3, label: "STOPPED" },
];

export default function VideoBroadcastTab() {
  const { config, isLoading } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const broadcast = config.hbbtv?.videoBroadcast ?? {};

  const [playState, setPlayState] = useState<number>(broadcast.playState ?? 0);
  const [volume, setVolume] = useState(broadcast.volume ?? 100);
  const [muted, setMuted] = useState(broadcast.muted ?? false);
  const [fullScreen, setFullScreen] = useState(broadcast.fullScreen ?? false);
  const [width, setWidth] = useState(broadcast.width ?? 1280);
  const [height, setHeight] = useState(broadcast.height ?? 720);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const bc = config.hbbtv?.videoBroadcast ?? {};
    setPlayState(bc.playState ?? 0);
    setVolume(bc.volume ?? 100);
    setMuted(bc.muted ?? false);
    setFullScreen(bc.fullScreen ?? false);
    setWidth(bc.width ?? 1280);
    setHeight(bc.height ?? 720);
    setIsEditing(false);
  }, [config.hbbtv?.videoBroadcast]);

  const handleSave = async () => {
    const newBroadcast: VideoBroadcastState = {
      ...broadcast,
      playState: playState as 0 | 1 | 2 | 3,
      volume,
      muted,
      fullScreen,
      width,
      height,
    };

    const newConfig = {
      ...config,
      hbbtv: {
        ...config.hbbtv,
        videoBroadcast: newBroadcast,
      },
    };

    dispatch({ type: "SET_CONFIG", payload: newConfig });
    await sideEffects.save(newConfig);
    setIsEditing(false);
  };

  const handleCancel = () => {
    const bc = config.hbbtv?.videoBroadcast ?? {};
    setPlayState(bc.playState ?? 0);
    setVolume(bc.volume ?? 100);
    setMuted(bc.muted ?? false);
    setFullScreen(bc.fullScreen ?? false);
    setWidth(bc.width ?? 1280);
    setHeight(bc.height ?? 720);
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
          <Stack direction="row" spacing={2}>
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
      <Stack spacing={3} sx={{ mt: 3 }}>
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
        <Stack direction="row" spacing={2}>
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
        {broadcast.currentChannel && (
          <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              Current Channel
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Name: {broadcast.currentChannel.name ?? "Unknown"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              CCID: {broadcast.currentChannel.ccid ?? "N/A"}
            </Typography>
          </Box>
        )}
      </Stack>
    </Panel>
  );
}
