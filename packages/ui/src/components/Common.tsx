import type { ExtensionConfig } from "@hbb-emu/lib";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useConfig } from "../context/config";

export default function Settings() {
  const { common } = useConfig();

  const [config, setConfig] = useState<Omit<ExtensionConfig.State, "channels"> | null>(null);

  const [version, setVersion] = useState(config?.version || "1.5.0");
  const [countryCode, setCountryCode] = useState(config?.countryCode || "ITA");
  const [userAgent, setUserAgent] = useState(
    config?.userAgent ||
      "Mozilla/5.0 (SmartTV; HbbTV/1.5.1 (+DL;Vendor/ModelName;0.0.1;0.0.1;) CE-HTML/1.0 NETRANGEMMH",
  );
  const [capabilities, setCapabilities] = useState(config?.capabilities || "");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    common.load().then(setConfig);
  }, [common.load]);

  const handleSave = async () => {
    const newConfig = {
      currentChannel: config?.currentChannel || null,
      version,
      countryCode,
      userAgent,
      capabilities,
    };

    await common.save(newConfig);
    setConfig(newConfig);
    console.log("Settings saved:", newConfig);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setVersion(config?.version || "1.5.0");
    setCountryCode(config?.countryCode || "ITA");
    setUserAgent(
      config?.userAgent ||
        "Mozilla/5.0 (SmartTV; HbbTV/1.5.1 (+DL;Vendor/ModelName;0.0.1;0.0.1;) CE-HTML/1.0 NETRANGEMMH",
    );
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
          label="User Agent"
          value={userAgent}
          onChange={(e) => {
            setUserAgent(e.target.value);
            setIsEditing(true);
          }}
          placeholder="Mozilla/5.0 (SmartTV; HbbTV/1.5.1...)"
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
