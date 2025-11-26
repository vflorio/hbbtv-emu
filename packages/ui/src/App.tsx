import type { ExtensionConfig } from "@hbb-emu/lib";
import { Box, CssBaseline, createTheme, Tab, Tabs, ThemeProvider } from "@mui/material";
import { useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import ChannelEdit from "./components/ChannelEdit";
import ChannelList from "./components/ChannelList";
import Settings from "./components/Settings";
import StreamEventsEdit from "./components/StreamEventsEdit";
import { ConfigProvider, type UIConfig } from "./context/config";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

function MainLayout() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSaveSettings = (config: Omit<ExtensionConfig.State, "channels">) => {
    // TODO: implementare il salvataggio delle impostazioni
    console.log("Save settings:", config);
  };

  return (
    <Box sx={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Channels" />
          <Tab label="Settings" />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {activeTab === 0 && <ChannelList />}
        {activeTab === 1 && <Settings config={null} onSave={handleSaveSettings} />}
      </Box>
    </Box>
  );
}

export default function App({ config }: { config: UIConfig }) {
  return (
    <ConfigProvider value={config}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <HashRouter>
          <Routes>
            <Route path="/" element={<MainLayout />} />
            <Route path="/channel/new" element={<ChannelEdit />} />
            <Route path="/channel/:id" element={<ChannelEdit />} />
            <Route path="/channel/:id/events" element={<StreamEventsEdit />} />
          </Routes>
        </HashRouter>
      </ThemeProvider>
    </ConfigProvider>
  );
}
