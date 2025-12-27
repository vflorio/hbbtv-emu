import { Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";

interface PlayerDebugSectionProps {
  playerUiVisible: boolean;
  onChange: (visible: boolean) => Promise<void>;
}

export function PlayerDebugSection({ playerUiVisible, onChange }: PlayerDebugSectionProps) {
  return (
    <Stack gap={2}>
      <Typography variant="h6">Player</Typography>
      <FormControlLabel
        control={<Checkbox checked={playerUiVisible} onChange={(e) => onChange(e.target.checked)} />}
        label="Debug Overlay"
      />
      <Typography variant="caption" color="text.secondary">
        Enable debug overlay with state and controls (requires app integration).
      </Typography>
    </Stack>
  );
}
