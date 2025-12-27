import { AppBar, Box, Button, CssBaseline, createTheme, Stack, ThemeProvider, Toolbar } from "@mui/material";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PlayerDemo } from "./Player";
import { RuntimeDemo } from "./RuntimeDemo";

function App() {
  const [demo, setDemo] = useState<"player" | "runtime">("player");

  return (
    <ThemeProvider theme={createTheme({ palette: { mode: "dark" } })}>
      <CssBaseline />
      <Box>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <Stack direction="row" gap={1}>
              <Button variant={demo === "player" ? "contained" : "outlined"} onClick={() => setDemo("player")}>
                Player
              </Button>
              <Button variant={demo === "runtime" ? "contained" : "outlined"} onClick={() => setDemo("runtime")}>
                Runtime
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>
        <Box component="main">{demo === "player" ? <PlayerDemo /> : <RuntimeDemo />}</Box>
      </Box>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
