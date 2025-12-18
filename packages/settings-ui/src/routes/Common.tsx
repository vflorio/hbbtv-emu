import { buildDefaultUserAgent } from "@hbb-emu/oipf";
import { Download, Upload } from "@mui/icons-material";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import Panel from "../components/Panel";
import { useAppState, useDispatch, useSideEffects } from "../context/state";
import { useCommonActions } from "../hooks/useCommonActions";

export default function Settings() {
  const { config, isLoading } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();
  const { save } = useCommonActions();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hbbtv-config-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedConfig = JSON.parse(text);
      dispatch({ type: "SET_CONFIG", payload: importedConfig });
      await sideEffects.save(importedConfig);
    } catch (error) {
      console.error("Failed to import config:", error);
      alert("Failed to import configuration. Please check the file format.");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

        <Stack spacing={2} sx={{ mt: 2 }}>
          <Typography variant="h6">Configuration</Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>
              Export Config
            </Button>
            <Button variant="outlined" startIcon={<Upload />} onClick={handleImport}>
              Import Config
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Export your configuration to a JSON file or import a previously saved configuration.
          </Typography>
        </Stack>
      </Stack>
    </Panel>
  );
}
