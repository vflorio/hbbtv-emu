import { buildDefaultUserAgent } from "@hbb-emu/oipf";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { useAppState } from "../context/state";
import { useCommonActions } from "../hooks/useCommonActions";

export default function Settings() {
  const { config, isLoading } = useAppState();
  const { save } = useCommonActions();

  const hbbtvVersion = config.hbbtv?.oipfCapabilities?.hbbtvVersion ?? "2.0.1";
  const defaultUserAgent = buildDefaultUserAgent({ hbbtvVersion });

  const [userAgent, setUserAgent] = useState(config.userAgent ?? defaultUserAgent);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setUserAgent(config.userAgent ?? defaultUserAgent);
    setIsEditing(false);
  }, [config.userAgent, defaultUserAgent]);

  const handleSave = async () => {
    await save({
      currentChannel: config.currentChannel,
      hbbtv: config.hbbtv,
      userAgent,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setUserAgent(config.userAgent ?? defaultUserAgent);
    setIsEditing(false);
  };

  const handleResetDefault = () => {
    setUserAgent(defaultUserAgent);
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
      title="Common"
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
        <Stack spacing={1} alignItems="flex-start">
          <TextField
            label="User Agent"
            value={userAgent}
            onChange={(e) => {
              setUserAgent(e.target.value);
              setIsEditing(true);
            }}
            placeholder="Mozilla/5.0 (SmartTV; HbbTV/1.5.1...)"
            fullWidth
            multiline
            minRows={4}
            helperText={`Default for HbbTV ${hbbtvVersion}`}
          />
          <Button onClick={handleResetDefault} sx={{ mt: 1 }}>
            Reset to default
          </Button>
        </Stack>
        <Alert severity="warning" sx={{ mt: -2 }}>
          Changing the User-Agent may require a page reload to take effect.
        </Alert>
      </Stack>
    </Panel>
  );
}
