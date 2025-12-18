import type { StreamEventScheduleMode } from "@hbb-emu/extension-common";
import { InfoOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
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

const getModeDescription = (mode: StreamEventScheduleMode): { title: string; description: string; example: string } => {
  switch (mode) {
    case "interval":
      return {
        title: "Fixed Interval",
        description:
          "Event repeats at regular intervals. Perfect for creating coordinated sequences (e.g., PREP→GO→END) by using the same interval with different offsets.",
        example: "Interval: 30s, Offset: 0s → fires at 0s, 30s, 60s, 90s...",
      };
    case "delay":
      return {
        title: "Delay from Start",
        description:
          "Event fires once at the specified delay, then repeats with its own cycle (delay + 1s). Each event has an independent cycle - not suitable for coordinated sequences.",
        example: "Delay: 10s → fires at 10s, 21s, 32s, 43s... (cycle: 11s)",
      };
    case "timestamps":
      return {
        title: "Manual Timestamp",
        description:
          "Event fires at a specific timestamp, then repeats with its own cycle (timestamp + 1s). Each event has an independent cycle - not suitable for coordinated sequences.",
        example: "At: 15s → fires at 15s, 31s, 47s, 63s... (cycle: 16s)",
      };
  }
};

export function StreamEventScheduling({
  scheduleMode,
  delaySeconds,
  intervalSeconds,
  offsetSeconds,
  atSeconds,
  mode,
  onChange,
}: StreamEventSchedulingProps) {
  const modeInfo = getModeDescription(scheduleMode);

  return (
    <Stack gap={2}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography variant="caption" color="primary">
          Scheduling
        </Typography>
        <Tooltip title="Choose how and when this event should fire during playback" arrow>
          <InfoOutlined sx={{ fontSize: 16, color: "text.secondary" }} />
        </Tooltip>
      </Stack>
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
                <MenuItem value="interval">
                  <Stack>
                    <Typography>Fixed Interval</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Regular repeating pattern - best for sequences
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="delay">
                  <Stack>
                    <Typography>Delay from Start</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Fire once, then auto-repeat (independent cycle)
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="timestamps">
                  <Stack>
                    <Typography>Manual Timestamp</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Specific time point, then auto-repeat (independent cycle)
                    </Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>

            <Alert severity="info" icon={<InfoOutlined />}>
              <Typography variant="caption" fontWeight="bold">
                {modeInfo.title}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                {modeInfo.description}
              </Typography>
              <Box
                sx={{
                  mt: 1,
                  p: 1,
                  bgcolor: "background.paper",
                  borderRadius: 1,
                  fontFamily: "monospace",
                  fontSize: "0.7rem",
                }}
              >
                {modeInfo.example}
              </Box>
            </Alert>

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
                helperText="Time from channel start before first occurrence"
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
                  helperText="Repeat period - event fires every N seconds"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Tooltip title="Use the same interval value across multiple events with different offsets to create coordinated sequences">
                          <InfoOutlined sx={{ fontSize: 18, color: "action.active", ml: 1 }} />
                        </Tooltip>
                      ),
                    },
                  }}
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
                  helperText="Initial delay before first occurrence (within the interval)"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <Tooltip title="Example: Interval 30s + Offset 0s, 10s, 20s = sequence at 0s→10s→20s→30s→40s→50s...">
                          <InfoOutlined sx={{ fontSize: 18, color: "action.active", ml: 1 }} />
                        </Tooltip>
                      ),
                    },
                  }}
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
                helperText="Absolute time from channel start (auto-repeats with independent cycle)"
                slotProps={{
                  input: {
                    endAdornment: (
                      <Tooltip title="Auto-repeat cycle = timestamp + 1s. Not recommended for sequences.">
                        <InfoOutlined sx={{ fontSize: 18, color: "action.active", ml: 1 }} />
                      </Tooltip>
                    ),
                  },
                }}
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
