import { Box, Stack, Typography } from "@mui/material";
import { ConfigSection } from "../components/common/ConfigSection";
import { PlayerDebugSection } from "../components/common/PlayerDebugSection";
import { UserAgentSection } from "../components/common/UserAgentSection";
import Panel from "../components/Panel";
import { useAppState } from "../context/AppState";

export default function Common() {
  const { isLoading } = useAppState();

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  return (
    <Panel title="Common">
      <Stack gap={3} sx={{ mt: 3 }}>
        <UserAgentSection />
        <PlayerDebugSection />
        <ConfigSection />
      </Stack>
    </Panel>
  );
}
