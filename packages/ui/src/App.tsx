import { CssBaseline, createTheme, ThemeProvider } from "@mui/material";
import { HashRouter, Route, Routes } from "react-router-dom";
import ChannelEdit from "./components/ChannelEdit";
import ChannelList from "./components/ChannelList";
import StreamEventsEdit from "./components/StreamEventsEdit";
import { ConfigProvider, type UIConfig } from "./context/config";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

export default function App({ config }: { config: UIConfig }) {
  return (
    <ConfigProvider value={config}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <HashRouter>
          <Routes>
            <Route path="/" element={<ChannelList />} />
            <Route path="/channel/new" element={<ChannelEdit />} />
            <Route path="/channel/:id" element={<ChannelEdit />} />
            <Route path="/channel/:id/events" element={<StreamEventsEdit />} />
          </Routes>
        </HashRouter>
      </ThemeProvider>
    </ConfigProvider>
  );
}
