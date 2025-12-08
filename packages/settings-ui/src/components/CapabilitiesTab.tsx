import { HBBTV_VERSION_MAP, type OipfCapabilitiesState } from "@hbb-emu/core";
import { Add } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/state";

export default function CapabilitiesTab() {
  const { config, isLoading } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const capabilities = config.hbbtv?.oipfCapabilities ?? {};

  const [hbbtvVersion, setHbbtvVersion] = useState(capabilities.hbbtvVersion ?? "2.0.1");
  const [uiProfiles, setUiProfiles] = useState<string[]>(capabilities.uiProfiles ?? []);
  const [drmSystems, setDrmSystems] = useState<string[]>(capabilities.drmSystems ?? []);
  const [newProfile, setNewProfile] = useState("");
  const [newDrm, setNewDrm] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const caps = config.hbbtv?.oipfCapabilities ?? {};
    setHbbtvVersion(caps.hbbtvVersion ?? "2.0.1");
    setUiProfiles(caps.uiProfiles ?? []);
    setDrmSystems(caps.drmSystems ?? []);
    setIsEditing(false);
  }, [config.hbbtv?.oipfCapabilities]);

  const handleSave = async () => {
    const newCapabilities: OipfCapabilitiesState = {
      ...capabilities,
      hbbtvVersion,
      uiProfiles,
      drmSystems,
    };

    const newConfig = {
      ...config,
      hbbtv: {
        ...config.hbbtv,
        oipfCapabilities: newCapabilities,
      },
    };

    dispatch({ type: "SET_CONFIG", payload: newConfig });
    await sideEffects.save(newConfig);
    setIsEditing(false);
  };

  const handleCancel = () => {
    const caps = config.hbbtv?.oipfCapabilities ?? {};
    setHbbtvVersion(caps.hbbtvVersion ?? "2.0.1");
    setUiProfiles(caps.uiProfiles ?? []);
    setDrmSystems(caps.drmSystems ?? []);
    setIsEditing(false);
  };

  const addProfile = () => {
    if (newProfile && !uiProfiles.includes(newProfile)) {
      setUiProfiles([...uiProfiles, newProfile]);
      setNewProfile("");
      setIsEditing(true);
    }
  };

  const removeProfile = (profile: string) => {
    setUiProfiles(uiProfiles.filter((p) => p !== profile));
    setIsEditing(true);
  };

  const addDrm = () => {
    if (newDrm && !drmSystems.includes(newDrm)) {
      setDrmSystems([...drmSystems, newDrm]);
      setNewDrm("");
      setIsEditing(true);
    }
  };

  const removeDrm = (drm: string) => {
    setDrmSystems(drmSystems.filter((d) => d !== drm));
    setIsEditing(true);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        OIPF Capabilities
      </Typography>

      <Stack spacing={3} sx={{ mt: 3 }}>
        {/* HbbTV Version */}
        <FormControl fullWidth>
          <InputLabel id="version-label">Version</InputLabel>
          <Select
            labelId="version-label"
            id="version"
            value={hbbtvVersion}
            label="Version"
            onChange={(e) => {
              setHbbtvVersion(e.target.value);
              setIsEditing(true);
            }}
          >
            {HBBTV_VERSION_MAP.map(({ oipf, hbbtv }) => (
              <MenuItem key={hbbtv} value={hbbtv}>
                V{oipf} - HbbTV {hbbtv}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* UI Profiles */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            UI Profiles
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
            {uiProfiles.map((profile) => (
              <Chip key={profile} label={profile} onDelete={() => removeProfile(profile)} sx={{ mb: 1 }} />
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              value={newProfile}
              onChange={(e) => setNewProfile(e.target.value)}
              placeholder="+TRICKMODE, +DVB_T, etc."
              onKeyDown={(e) => e.key === "Enter" && addProfile()}
            />
            <IconButton onClick={addProfile} color="primary">
              <Add />
            </IconButton>
          </Stack>
        </Box>

        {/* DRM Systems */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            DRM Systems
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
            {drmSystems.map((drm) => (
              <Chip key={drm} label={drm} onDelete={() => removeDrm(drm)} sx={{ mb: 1 }} />
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              value={newDrm}
              onChange={(e) => setNewDrm(e.target.value)}
              placeholder="urn:dvb:casystemid:19219"
              onKeyDown={(e) => e.key === "Enter" && addDrm()}
            />
            <IconButton onClick={addDrm} color="primary">
              <Add />
            </IconButton>
          </Stack>
        </Box>

        {/* Action Buttons */}
        {isEditing && (
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
            <Button variant="outlined" onClick={handleCancel}>
              Cancel
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
