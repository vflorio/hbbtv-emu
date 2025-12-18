import type { StreamEventScheduleMode } from "@hbb-emu/extension-common";
import { FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import type { ChangeEvent } from "react";

interface StreamEventSchedulingProps {
  scheduleMode: StreamEventScheduleMode;
  delaySeconds?: number;
  intervalSeconds?: number;
  offsetSeconds?: number;
  atSeconds?: number;
  mode: "display" | "edit";
  onChange: (field: string, value: string | number) => void;
}

export function StreamEventScheduling({
  scheduleMode,
  delaySeconds,
  intervalSeconds,
  offsetSeconds,
  atSeconds,
  mode,
  onChange,
}: StreamEventSchedulingProps) {
  return (
    <Stack gap={2}>
      <Typography variant="caption" color="primary">
        Scheduling
      </Typography>
      <Stack gap={2}>
        {mode === "edit" ? (
          <>
            <FormControl fullWidth>
              <InputLabel>Schedule Mode</InputLabel>
              <Select
                label="Schedule Mode"
                value={scheduleMode}
                onChange={(e) => onChange("scheduleMode", e.target.value)}
              >
                <MenuItem value="delay">Delay from start</MenuItem>
                <MenuItem value="interval">Fixed interval</MenuItem>
                <MenuItem value="timestamps">Manual timestamps</MenuItem>
              </Select>
            </FormControl>

            {scheduleMode === "delay" && (
              <TextField
                label="Delay (seconds)"
                type="number"
                value={delaySeconds ?? 0}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChange("delaySeconds", Number.parseInt(e.target.value, 10) || 0)
                }
                fullWidth
                inputProps={{ min: 0 }}
                helperText="Delay before event fires (relative)"
              />
            )}

            {scheduleMode === "interval" && (
              <>
                <TextField
                  label="Interval (seconds)"
                  type="number"
                  value={intervalSeconds ?? 10}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onChange("intervalSeconds", Number.parseInt(e.target.value, 10) || 1)
                  }
                  fullWidth
                  inputProps={{ min: 1 }}
                  helperText="Event fires every N seconds"
                />
                <TextField
                  label="Offset (seconds)"
                  type="number"
                  value={offsetSeconds ?? 0}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onChange("offsetSeconds", Number.parseInt(e.target.value, 10) || 0)
                  }
                  fullWidth
                  inputProps={{ min: 0 }}
                  helperText="Delay before interval starts"
                />
              </>
            )}

            {scheduleMode === "timestamps" && (
              <TextField
                label="Timestamp (seconds)"
                type="number"
                value={atSeconds ?? 0}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChange("atSeconds", Number.parseInt(e.target.value, 10) || 0)
                }
                fullWidth
                inputProps={{ min: 0 }}
                helperText="Absolute time from start"
              />
            )}
          </>
        ) : (
          <>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Mode
              </Typography>
              <Typography variant="body2">
                {scheduleMode === "delay" && "Delay"}
                {scheduleMode === "interval" && "Interval"}
                {scheduleMode === "timestamps" && "Timestamps"}
              </Typography>
            </Stack>
            {scheduleMode === "delay" && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Delay
                </Typography>
                <Typography variant="body2">{delaySeconds ?? 0}s</Typography>
              </Stack>
            )}
            {scheduleMode === "interval" && (
              <>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Interval
                  </Typography>
                  <Typography variant="body2">{intervalSeconds ?? 10}s</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Offset
                  </Typography>
                  <Typography variant="body2">{offsetSeconds ?? 0}s</Typography>
                </Stack>
              </>
            )}
            {scheduleMode === "timestamps" && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  At
                </Typography>
                <Typography variant="body2">{atSeconds ?? 0}s</Typography>
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Stack>
  );
}
