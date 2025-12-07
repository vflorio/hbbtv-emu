import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useAppState } from "../context/state";
import { useCommonActions } from "../hooks/useCommonActions";

export default function Settings() {
  const { config, isLoading } = useAppState();
  const { save } = useCommonActions();

  const [version, setVersion] = useState(config.version);
  const [countryCode, setCountryCode] = useState(config.countryCode);
  const [userAgent, setUserAgent] = useState(config.userAgent);
  const [capabilities, setCapabilities] = useState(config.capabilities);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setVersion(config.version);
    setCountryCode(config.countryCode);
    setUserAgent(config.userAgent);
    setCapabilities(config.capabilities);
    setIsEditing(false);
  }, [config.version, config.countryCode, config.userAgent, config.capabilities]);

  const handleSave = async () => {
    await save({
      currentChannel: config.currentChannel,
      version,
      countryCode,
      userAgent,
      capabilities,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setVersion(config.version);
    setCountryCode(config.countryCode);
    setUserAgent(config.userAgent);
    setCapabilities(config.capabilities);
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
        Settings
      </Typography>

      <Stack spacing={3} sx={{ mt: 3 }}>
        <TextField
          label="Version"
          value={version}
          onChange={(e) => {
            setVersion(e.target.value);
            setIsEditing(true);
          }}
          placeholder="1.5.0"
          fullWidth
        />

        <TextField
          label="Country Code"
          value={countryCode}
          onChange={(e) => {
            setCountryCode(e.target.value.toUpperCase());
            setIsEditing(true);
          }}
          placeholder="ITA"
          inputProps={{ maxLength: 3 }}
          fullWidth
        />

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

        <TextField
          label="Capabilities XML"
          value={capabilities}
          onChange={(e) => {
            setCapabilities(e.target.value);
            setIsEditing(true);
          }}
          placeholder="<profilelist>...</profilelist>"
          multiline
          rows={10}
          fullWidth
          sx={{
            "& textarea": {
              fontFamily: "monospace",
              fontSize: "12px",
            },
          }}
        />

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
