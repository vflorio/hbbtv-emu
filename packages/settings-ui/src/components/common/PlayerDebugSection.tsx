import { Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import type { ChangeEvent } from "react";
import { usePlayerUi } from "../../hooks";

export function PlayerDebugSection() {
  const { playerUiVisible, setVisible } = usePlayerUi();
  const isVisible = playerUiVisible ?? false;

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) =>
    pipe(
      setVisible(event.target.checked),
      TE.match(
        (error) => console.error("Failed to save player UI:", error),
        () => console.log("Player UI saved successfully"),
      ),
    )();

  return (
    <Stack gap={2}>
      <Typography variant="h6">Player</Typography>
      <FormControlLabel control={<Checkbox checked={isVisible} onChange={handleToggle} />} label="Debug Overlay" />
      <Typography variant="caption" color="text.secondary">
        Enable debug overlay with state and controls (requires app integration).
      </Typography>
    </Stack>
  );
}
