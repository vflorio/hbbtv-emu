import { isValidHex } from "@hbb-emu/core";
import { Box, Stack, TextField, Typography } from "@mui/material";
import type { ChangeEvent } from "react";

interface StreamEventDataProps {
  text?: string;
  data: string;
  targetURL?: string;
  mode: "display" | "edit";
  onTextChange: (text: string) => void;
  onDataChange: (data: string) => void;
  onTargetURLChange: (url: string) => void;
}

export function StreamEventData({
  text,
  data,
  targetURL,
  mode,
  onTextChange,
  onDataChange,
  onTargetURLChange,
}: StreamEventDataProps) {
  return (
    <Stack gap={2}>
      <Typography variant="caption" color="primary">
        HbbTV Event Data
      </Typography>
      <Stack gap={2}>
        {mode === "edit" ? (
          <>
            <TextField
              label="Text Payload (UTF-8)"
              value={text ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onTextChange(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              helperText="Human-readable text. Updates hex automatically."
            />
            <TextField
              label="Data Payload (Hex)"
              value={data}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onDataChange(e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
              error={data.length > 0 && !isValidHex(data)}
              helperText={
                data.length > 0 && !isValidHex(data)
                  ? "Invalid hexadecimal format"
                  : "Hex-encoded payload. Updates text automatically."
              }
              sx={{ fontFamily: "monospace" }}
            />
            <TextField
              label="Target URL"
              value={targetURL}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onTargetURLChange(e.target.value)}
              fullWidth
              size="small"
              helperText="e.g., dvb://current.ait or http://..."
            />
          </>
        ) : (
          <>
            <Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Text Payload
              </Typography>
              <Box
                sx={{
                  p: 1,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  maxHeight: 120,
                  overflow: "auto",
                  wordBreak: "break-word",
                }}
              >
                <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {text || "—"}
                </Typography>
              </Box>
            </Stack>
            <Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Data Payload (Hex)
              </Typography>
              <Box
                sx={{
                  p: 1,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  maxHeight: 80,
                  overflow: "auto",
                  wordBreak: "break-all",
                }}
              >
                <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                  {data || "—"}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Target URL
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                {targetURL || "—"}
              </Typography>
            </Stack>
          </>
        )}
      </Stack>
    </Stack>
  );
}
