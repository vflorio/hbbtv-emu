import { Box, Container, CssBaseline, createTheme, ThemeProvider } from "@mui/material";
import ChannelList from "./components/ChannelList";
import { type Config, ConfigProvider } from "./context/config";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

export default function App({ config }: { config: Config }) {
  return (
    <ConfigProvider value={config}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container maxWidth="xl">
          <Box sx={{ py: 4 }}>
            <ChannelList />
          </Box>
        </Container>
      </ThemeProvider>
    </ConfigProvider>
  );
}
