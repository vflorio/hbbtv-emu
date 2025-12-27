import type { ExtensionState } from "@hbb-emu/extension-common";
import { Box, Stack, Typography } from "@mui/material";
import { ConfigSection } from "../components/common/ConfigSection";
import { PlayerDebugSection } from "../components/common/PlayerDebugSection";
import { UserAgentSection } from "../components/common/UserAgentSection";
import Panel from "../components/Panel";
import { useAppState, useDispatch, useSideEffects } from "../context/state";
import { useCommonActions } from "../hooks/useCommonActions";

export default function Settings() {
  const { config, isLoading } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();
  const { save } = useCommonActions();

  const hbbtvVersion = config.hbbtv?.oipfCapabilities?.hbbtvVersion ?? "2.0.1";

  const handleUserAgentSave = async (userAgent: string) => {
    await save({
      currentChannel: config.currentChannel,
      hbbtv: config.hbbtv,
      userAgent,
      playerUiVisible: config.playerUiVisible,
    });
  };

  const handlePlayerUiChange = async (visible: boolean) => {
    const updated = {
      ...config,
      playerUiVisible: visible,
    };
    dispatch({ type: "SET_CONFIG", payload: updated });
    await sideEffects.save(updated);
  };

  const handleConfigImport = async (importedConfig: ExtensionState) => {
    dispatch({ type: "SET_CONFIG", payload: importedConfig });
    await sideEffects.save(importedConfig);
  };

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
        <UserAgentSection
          currentUserAgent={config.userAgent}
          hbbtvVersion={hbbtvVersion}
          onSave={handleUserAgentSave}
          onEditingChange={() => {}}
        />

        <PlayerDebugSection playerUiVisible={config.playerUiVisible ?? false} onChange={handlePlayerUiChange} />

        <ConfigSection config={config} onImport={handleConfigImport} />
      </Stack>
    </Panel>
  );
}
