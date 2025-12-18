import { Stack, TextField, Typography } from "@mui/material";
import type { ChangeEvent } from "react";

interface StreamEventIdentificationProps {
  label?: string;
  eventName: string;
  mode: "display" | "edit";
  onChange: (field: "label" | "eventName", value: string) => void;
}

export function StreamEventIdentification({ label, eventName, mode, onChange }: StreamEventIdentificationProps) {
  return (
    <>
      <Typography variant="caption" color="primary" sx={{ fontWeight: 600, mb: 1, display: "block" }}>
        Event Identification
      </Typography>
      <Stack gap={1.5}>
        {mode === "edit" ? (
          <>
            <TextField
              label="Label"
              value={label ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onChange("label", e.target.value)}
              fullWidth
              size="small"
              helperText="Display name (optional)"
            />
            <TextField
              label="DSM-CC Event Name"
              value={eventName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onChange("eventName", e.target.value)}
              fullWidth
              required
              size="small"
              helperText="e.g., 'now', 'next', 'PREP', 'GO', 'END'"
            />
          </>
        ) : (
          <>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Label
              </Typography>
              <Typography variant="body2">{label || "—"}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Event Name
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                {eventName}
              </Typography>
            </Stack>
          </>
        )}
      </Stack>
    </>
  );
}
