import { Box, Paper, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { usePlayback } from "./PlaybackProvider";

const formatTime = (ms: number) => {
  const d = new Date(ms);
  const iso = d.toISOString();
  return iso.split("T")[1]?.split("Z")[0] ?? iso;
};

function EventLine({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Box sx={{ width: 90, color: "text.secondary" }}>{label}</Box>
      <Box sx={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</Box>
    </Box>
  );
}

export function TransitionsPanel() {
  const { transitions } = usePlayback();

  const groups = useMemo(() => {
    const state: { id: number; value: string }[] = [];
    const intents: { id: number; value: string }[] = [];
    const engine: { id: number; value: string }[] = [];
    const errors: { id: number; value: string }[] = [];

    for (let i = transitions.length - 1; i >= 0; i--) {
      const entry = transitions[i]!;
      if (entry.kind === "state") {
        if (state.length < 25) {
          state.push({ id: entry.id, value: `${formatTime(entry.time)} ${entry.from} -> ${entry.to}` });
        }
        continue;
      }

      const tag = entry.event._tag;
      const line = `${formatTime(entry.time)} ${tag}`;

      if (entry.kind === "intent") {
        if (intents.length < 25) intents.push({ id: entry.id, value: line });
      } else if (entry.kind === "error") {
        const msg = "message" in entry.event ? entry.event.message : "";
        if (errors.length < 25) errors.push({ id: entry.id, value: msg ? `${line} — ${String(msg)}` : line });
      } else {
        if (engine.length < 25) engine.push({ id: entry.id, value: line });
      }
    }

    return {
      state: state.reverse(),
      intents: intents.reverse(),
      engine: engine.reverse(),
      errors: errors.reverse(),
    };
  }, [transitions]);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Runtime Transitions
      </Typography>

      <Stack spacing={1.25} sx={{ fontFamily: "monospace", fontSize: "0.825rem" }}>
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Intents
          </Typography>
          {groups.intents.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              —
            </Typography>
          ) : (
            groups.intents.map((l) => <EventLine key={l.id} label="Intent" value={l.value} />)
          )}
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Engine Events
          </Typography>
          {groups.engine.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              —
            </Typography>
          ) : (
            groups.engine.map((l) => <EventLine key={l.id} label="Engine" value={l.value} />)
          )}
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Errors
          </Typography>
          {groups.errors.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              —
            </Typography>
          ) : (
            groups.errors.map((l) => (
              <Box key={l.id} sx={{ color: "error.main" }}>
                <EventLine label="Error" value={l.value} />
              </Box>
            ))
          )}
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            State Changes
          </Typography>
          {groups.state.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              —
            </Typography>
          ) : (
            groups.state.map((l) => <EventLine key={l.id} label="State" value={l.value} />)
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
