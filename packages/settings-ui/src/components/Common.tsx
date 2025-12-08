import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useAppState } from "../context/state";
import { useCommonActions } from "../hooks/useCommonActions";

export default function Settings() {
  const { config, isLoading } = useAppState();
  const { save } = useCommonActions();

  const [userAgent, setUserAgent] = useState(config.userAgent);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setUserAgent(config.userAgent);
    setIsEditing(false);
  }, [config.userAgent]);

  const handleSave = async () => {
    await save({
      currentChannel: config.currentChannel,
      hbbtv: config.hbbtv,
      userAgent,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setUserAgent(config.userAgent);
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
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Common
      </Typography>
      <Stack spacing={3} sx={{ mt: 3 }}>
        <TextField
          label="User Agent"
          value={userAgent}
          onChange={(e) => {
            setUserAgent(e.target.value);
            setIsEditing(true);
          }}
          placeholder="Mozilla/5.0 (SmartTV; HbbTV/1.5.1...)"
          fullWidth
        />
        <Alert severity="warning" sx={{ mt: -2 }}>
          Changing the User-Agent may require a page reload to take effect.
        </Alert>
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
