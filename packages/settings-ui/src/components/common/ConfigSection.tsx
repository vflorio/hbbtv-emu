import type { ExtensionState } from "@hbb-emu/extension-common";
import { Download, Upload } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import { useRef } from "react";

interface ConfigSectionProps {
  config: ExtensionState;
  onImport: (config: ExtensionState) => Promise<void>;
}

export function ConfigSection({ config, onImport }: ConfigSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      await onImport(importedConfig);
    } catch (error) {
      console.error("Failed to import config:", error);
      alert("Failed to import configuration. Please check the file format.");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Stack gap={2}>
      <Typography variant="h6">Configuration</Typography>
      <Stack direction="row" gap={2}>
        <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>
          Export Config
        </Button>
        <Button variant="outlined" startIcon={<Upload />} onClick={handleImport}>
          Import Config
        </Button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleFileChange} />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Export your configuration to a JSON file or import a previously saved configuration.
      </Typography>
    </Stack>
  );
}
