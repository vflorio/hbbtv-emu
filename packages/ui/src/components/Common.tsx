import type { ExtensionConfig } from "@hbb-emu/lib";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";

interface SettingsProps {
  config: ExtensionConfig.State | null;
  onSave: (config: Omit<ExtensionConfig.State, "channels">) => void;
}

export default function Settings({ config, onSave }: SettingsProps) {
  const [version, setVersion] = useState(config?.version || "1.5.0");
  const [countryCode, setCountryCode] = useState(config?.countryCode || "ITA");
  const [capabilities, setCapabilities] = useState(config?.capabilities || "");
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onSave({
      currentChannel: config?.currentChannel || null,
      version,
      countryCode,
      capabilities,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setVersion(config?.version || "1.5.0");
    setCountryCode(config?.countryCode || "ITA");
    setCapabilities(config?.capabilities || "");
    setIsEditing(false);
  };

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
