import type { ApplicationManagerState, ApplicationState } from "@hbb-emu/oipf";
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { useAppState, useDispatch, useSideEffects } from "../context/state";

// Visibility options
const VISIBILITY_OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
];

// Lifecycle options
const LIFECYCLE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "destroyed", label: "Destroyed" },
];

// Keyset mask presets
const KEYSET_PRESETS = [
  { value: 0x00, label: "NONE (0x00)" },
  { value: 0x01, label: "NAVIGATION (0x01)" },
  { value: 0x02, label: "NAVIGATION_AND_COLOR (0x02)" },
  { value: 0x04, label: "PLAYBACK (0x04)" },
  { value: 0x07, label: "NAV + COLOR + PLAYBACK (0x07)" },
  { value: 0xff, label: "ALL (0xFF)" },
];

export default function ApplicationTab() {
  const { config, isLoading } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const appManager = config.hbbtv?.applicationManager ?? {};
  const ownerApp = appManager.ownerApplication ?? {};

  const [visibility, setVisibility] = useState<"visible" | "hidden">(ownerApp.visibility ?? "visible");
  const [lifecycle, setLifecycle] = useState<"active" | "inactive" | "destroyed">(ownerApp.lifecycle ?? "active");
  const [keysetValue, setKeysetValue] = useState(ownerApp.keyset?.value ?? 0);
  const [appId, setAppId] = useState(ownerApp.id ?? "");
  const [appName, setAppName] = useState(ownerApp.name ?? "");
  const [appUrl, setAppUrl] = useState(ownerApp.url ?? "");
  const [videoTransparency, setVideoTransparency] = useState(appManager.videoTransparency ?? false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const am = config.hbbtv?.applicationManager ?? {};
    const app = am.ownerApplication ?? {};
    setVisibility(app.visibility ?? "visible");
    setLifecycle(app.lifecycle ?? "active");
    setKeysetValue(app.keyset?.value ?? 0);
    setAppId(app.id ?? "");
    setAppName(app.name ?? "");
    setAppUrl(app.url ?? "");
    setVideoTransparency(am.videoTransparency ?? false);
    setIsEditing(false);
  }, [config.hbbtv?.applicationManager]);

  const handleSave = async () => {
    const newOwnerApp: ApplicationState = {
      ...ownerApp,
      id: appId || undefined,
      name: appName || undefined,
      url: appUrl || undefined,
      visibility,
      lifecycle,
      keyset: { value: keysetValue },
    };

    const newAppManager: ApplicationManagerState = {
      ...appManager,
      ownerApplication: newOwnerApp,
      videoTransparency,
    };

    const newConfig = {
      ...config,
      hbbtv: {
        ...config.hbbtv,
        applicationManager: newAppManager,
      },
    };

    dispatch({ type: "SET_CONFIG", payload: newConfig });
    await sideEffects.save(newConfig);
    setIsEditing(false);
  };

  const handleCancel = () => {
    const am = config.hbbtv?.applicationManager ?? {};
    const app = am.ownerApplication ?? {};
    setVisibility(app.visibility ?? "visible");
    setLifecycle(app.lifecycle ?? "active");
    setKeysetValue(app.keyset?.value ?? 0);
    setAppId(app.id ?? "");
    setAppName(app.name ?? "");
    setAppUrl(app.url ?? "");
    setVideoTransparency(am.videoTransparency ?? false);
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
      title="Application Manager"
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
      {/* Application Info */}
      <Typography variant="h6">Owner Application</Typography>

      <TextField
        label="Application ID"
        value={appId}
        onChange={(e) => {
          setAppId(e.target.value);
          setIsEditing(true);
        }}
        placeholder="app-123"
        fullWidth
      />

      <TextField
        label="Application Name"
        value={appName}
        onChange={(e) => {
          setAppName(e.target.value);
          setIsEditing(true);
        }}
        placeholder="My HbbTV App"
        fullWidth
      />

      <TextField
        label="Application URL"
        value={appUrl}
        onChange={(e) => {
          setAppUrl(e.target.value);
          setIsEditing(true);
        }}
        placeholder="https://example.com/app"
        fullWidth
      />

      {/* Visibility */}
      <FormControl fullWidth>
        <InputLabel>Visibility</InputLabel>
        <Select
          value={visibility}
          label="Visibility"
          onChange={(e) => {
            setVisibility(e.target.value as "visible" | "hidden");
            setIsEditing(true);
          }}
        >
          {VISIBILITY_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Lifecycle */}
      <FormControl fullWidth>
        <InputLabel>Lifecycle</InputLabel>
        <Select
          value={lifecycle}
          label="Lifecycle"
          onChange={(e) => {
            setLifecycle(e.target.value as "active" | "inactive" | "destroyed");
            setIsEditing(true);
          }}
        >
          {LIFECYCLE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Keyset */}
      <FormControl fullWidth>
        <InputLabel>Keyset Mask</InputLabel>
        <Select
          value={keysetValue}
          label="Keyset Mask"
          onChange={(e) => {
            setKeysetValue(e.target.value as number);
            setIsEditing(true);
          }}
        >
          {KEYSET_PRESETS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Custom Keyset Input */}
      <TextField
        type="number"
        label="Custom Keyset Value"
        value={keysetValue}
        onChange={(e) => {
          setKeysetValue(parseInt(e.target.value, 10) || 0);
          setIsEditing(true);
        }}
        inputProps={{ min: 0, max: 255 }}
        helperText="Enter a custom keyset mask value (0-255)"
      />

      {/* Manager Settings */}
      <Typography variant="h6" sx={{ mt: 2 }}>
        Manager Settings
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={videoTransparency}
            onChange={(e) => {
              setVideoTransparency(e.target.checked);
              setIsEditing(true);
            }}
          />
        }
        label="Video Transparency"
      />
    </Panel>
  );
}
