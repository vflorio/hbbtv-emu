import {
  Apps as AppsIcon,
  LiveTv as BroadcastIcon,
  Memory as CapabilitiesIcon,
  Tv as ChannelsIcon,
  Tune as CommonIcon,
  Settings as ConfigIcon,
} from "@mui/icons-material";
import {
  Box,
  CssBaseline,
  createTheme,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ThemeProvider,
} from "@mui/material";
import { useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import ApplicationTab from "./components/ApplicationTab";
import CapabilitiesTab from "./components/CapabilitiesTab";
import ChannelEdit from "./components/ChannelEdit";
import ChannelList from "./components/ChannelList";
import Common from "./components/Common";
import ConfigurationTab from "./components/ConfigurationTab";
import StreamEventsEdit from "./components/StreamEventsEdit";
import VideoBroadcastTab from "./components/VideoBroadcastTab";
import { type SideEffects, StateProvider } from "./context/state";

const DRAWER_WIDTH = 56;

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

const menuItems = [
  { id: 0, icon: <ChannelsIcon /> },
  { id: 1, icon: <CapabilitiesIcon /> },
  { id: 2, icon: <ConfigIcon /> },
  { id: 3, icon: <BroadcastIcon /> },
  { id: 4, icon: <AppsIcon /> },
  { id: 5, icon: <CommonIcon /> },
];

function MainLayout() {
  const [activeSection, setActiveSection] = useState(0);

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
          },
        }}
      >
        <List dense>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.id}
              selected={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
              sx={{ py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, overflow: "auto" }}>
        {activeSection === 0 && <ChannelList />}
        {activeSection === 1 && <CapabilitiesTab />}
        {activeSection === 2 && <ConfigurationTab />}
        {activeSection === 3 && <VideoBroadcastTab />}
        {activeSection === 4 && <ApplicationTab />}
        {activeSection === 5 && <Common />}
      </Box>
    </Box>
  );
}

export function Settings({ sideEffects }: { sideEffects: SideEffects }) {
  return (
    <StateProvider sideEffects={sideEffects}>
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
    </StateProvider>
  );
}
