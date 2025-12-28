import { Download, Upload } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useRef } from "react";
import { useAppState } from "../../context/AppState";
import { useConfigImport } from "../../hooks";

export function ConfigSection() {
  const { config } = useAppState();
  const { importConfig } = useConfigImport();
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    pipe(
      TE.tryCatch(
        () => file.text(),
        (error) => error,
      ),
      TE.flatMap((text) =>
        pipe(
          E.tryCatch(
            () => JSON.parse(text),
            (error) => error,
          ),
          TE.fromEither,
        ),
      ),
      TE.flatMap((importedConfig) => importConfig(importedConfig)),
      TE.tapIO(() => () => {
        if (!fileInputRef.current) return;
        fileInputRef.current.value = "";
      }),
      TE.match(
        (error) => {
          console.error("Failed to import config:", error);
          alert("Failed to import configuration. Please check the file format.");
        },
        () => {
          console.log("Configuration imported successfully");
        },
      ),
    )();
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
