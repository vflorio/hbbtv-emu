import { type DeviceCapabilities, HBBTV_VERSION_MAP } from "@hbb-emu/oipf-api";
import { Add } from "@mui/icons-material";
import { Box, Button, Chip, IconButton, Stack, TextField, Typography } from "@mui/material";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { useAppState, useCapabilities, useDevice } from "../hooks";

export default function CapabilitiesTab() {
  const { isLoading } = useAppState();
  const { capabilities, update } = useCapabilities();
  const { device } = useDevice();
  const { hbbtvVersion } = device.terminal;
  const specVersion = HBBTV_VERSION_MAP.find((entry) => entry.hbbtv === hbbtvVersion)?.spec;
  const [uiProfiles, setUiProfiles] = useState<ReadonlyArray<string>>(capabilities.uiProfiles);
  const [drmSystems, setDrmSystems] = useState<ReadonlyArray<string>>(capabilities.drmSystems);
  const [newProfile, setNewProfile] = useState("");
  const [newDrm, setNewDrm] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setUiProfiles(capabilities.uiProfiles);
    setDrmSystems(capabilities.drmSystems);
    setIsEditing(false);
  }, [capabilities]);

  const handleSave = pipe(
    TE.of<unknown, DeviceCapabilities>({
      ...capabilities,
      uiProfiles,
      drmSystems,
    }),
    TE.tap((newCapabilities) => update(newCapabilities)),
    TE.tapIO(() => () => {
      setIsEditing(false);
    }),
  );

  const handleCancel = () => {
    setUiProfiles(capabilities.uiProfiles);
    setDrmSystems(capabilities.drmSystems);
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
    <Panel
      title="Capabilities"
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
      {/* HbbTV Version: the device's */}
      <Box>
        <Typography variant="subtitle1">Version</Typography>
        <Typography>
          HbbTV {hbbtvVersion} (TS 102 796 V{specVersion})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The device's: change it in Common → Device.
        </Typography>
      </Box>
      {/* UI Profiles */}
      <Box>
        <Typography variant="subtitle1">UI Profile</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          A base profile (OITF_HD_UIPROF, OITF_FULL_HD_UIPROF, …) and name fragments (OIPF DAE §9.2): hasCapability()
          answers them, and the device's option strings ({device.terminal.options.join(" ") || "none"}).
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
          {uiProfiles.map((profile) => (
            <Chip key={profile} label={profile} onDelete={() => removeProfile(profile)} sx={{ mb: 1 }} />
          ))}
        </Stack>
        <Stack direction="row" gap={1}>
          <TextField
            size="small"
            value={newProfile}
            onChange={(e) => setNewProfile(e.target.value)}
            placeholder="OITF_HD_UIPROF, +TRICKMODE, +DVB_T, etc."
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
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
          {drmSystems.map((drm) => (
            <Chip key={drm} label={drm} onDelete={() => removeDrm(drm)} sx={{ mb: 1 }} />
          ))}
        </Stack>
        <Stack direction="row" gap={1}>
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
    </Panel>
  );
}
