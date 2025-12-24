import { AppBar, Box, Button, CssBaseline, Stack, Toolbar } from "@mui/material";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { PlayerDemo } from "./PlayerDemo";
import { RuntimeDemo } from "./RuntimeDemo";

function App() {
  const [demo, setDemo] = useState<"player" | "runtime">("player");

  return (
    <Box>
      <CssBaseline />
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
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
