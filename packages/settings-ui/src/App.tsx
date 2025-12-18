import {
  Apps as AppsIcon,
  LiveTv as BroadcastIcon,
  Memory as CapabilitiesIcon,
  Tv as ChannelsIcon,
  Tune as CommonIcon,
  Settings as ConfigIcon,
} from "@mui/icons-material";
import { CssBaseline, createTheme, Divider, List, ListItemButton, Stack, ThemeProvider } from "@mui/material";
import { createContext, useContext, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { match } from "ts-pattern";
import ChannelEdit from "./components/ChannelEdit";
import { Acrylic } from "./components/materials";
import StreamEventsEdit from "./components/StreamEventsEdit";
import { type SideEffects, StateProvider } from "./context/state";
import ApplicationTab from "./routes/ApplicationManager";
import CapabilitiesTab from "./routes/Capabilities";
import ChannelList from "./routes/Channels";
import Common from "./routes/Common";
import ConfigurationTab from "./routes/Configuration";
import VideoBroadcastTab from "./routes/VideoBroadcast";

export const BASE_SIZE = 56;

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

interface SidebarState {
  activeSection: number;
  setActiveSection: (id: number) => void;
}

const SidebarContext = createContext<SidebarState>({
  activeSection: 0,
  setActiveSection: () => {},
});

enum Section {
  Channels,
  Capabilities,
  Configuration,
  VideoBroadcast,
  Application,
  Common,
}

function MainLayout() {
  const [activeSection, setActiveSection] = useState<Section>(Section.Channels);
  return (
    <SidebarContext.Provider value={{ activeSection, setActiveSection }}>
      <Stack width={"100%"} direction={"row"}>
        <Sidebar />
        <Divider orientation="vertical" flexItem />
        <Stack width={`calc(100% - ${BASE_SIZE + 2}px)`} height={"100vh"}>
          {activeSection === Section.Channels && <ChannelList />}
          {activeSection === Section.Capabilities && <CapabilitiesTab />}
          {activeSection === Section.Configuration && <ConfigurationTab />}
          {activeSection === Section.VideoBroadcast && <VideoBroadcastTab />}
          {activeSection === Section.Application && <ApplicationTab />}
          {activeSection === Section.Common && <Common />}
        </Stack>
      </Stack>
    </SidebarContext.Provider>
  );
}

function Sidebar() {
  const { activeSection, setActiveSection } = useContext(SidebarContext);

  const menuItems = [
    { id: Section.Channels, Icon: <ChannelsIcon /> },
    { id: Section.Capabilities, Icon: <CapabilitiesIcon /> },
    { id: Section.Configuration, Icon: <ConfigIcon /> },
    { id: Section.VideoBroadcast, Icon: <BroadcastIcon /> },
    { id: Section.Application, Icon: <AppsIcon /> },
    { id: Section.Common, Icon: <CommonIcon /> },
  ];

  return (
    <Acrylic direction={"row"} width={BASE_SIZE}>
      <List disablePadding>
        {menuItems.map((item) => (
          <ListItemButton
            divider
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            selected={activeSection === item.id}
            sx={{ width: BASE_SIZE, height: BASE_SIZE }}
          >
            {item.Icon}
          </ListItemButton>
        ))}
      </List>
    </Acrylic>
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
