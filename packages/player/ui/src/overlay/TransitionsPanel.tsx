import { Box, Paper, Typography } from "@mui/material";
import { useMemo } from "react";
import { List, type RowComponentProps } from "react-window";
import { formatTime } from "../format";
import type { RuntimeDebugEntry } from "../hooks/usePlayerDebug";

type LineItem = {
  readonly id: number;
  readonly time: number;
  readonly kind: RuntimeDebugEntry["kind"];
  readonly primary: string;
  readonly secondary?: string;
};

type RowProps = {
  readonly items: readonly LineItem[];
};

const kindColor = (kind: RuntimeDebugEntry["kind"]) => {
  switch (kind) {
    case "intent":
      return "info.light";
    case "engine":
      return "success.light";
    case "state":
      return "warning.light";
    case "core-error":
    case "error":
      return "error.light";
  }
};

export function TransitionsPanel({
  entries,
  entriesVersion,
}: {
  entries: readonly RuntimeDebugEntry[];
  entriesVersion: number;
}) {
  const items = useMemo(() => {
    const out: LineItem[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      if (entry.kind === "state") {
        out.push({
          id: entry.id,
          time: entry.time,
          kind: "state",
          primary: `${entry.from} -> ${entry.to}`,
        });
        continue;
      }

      const tag = entry.event._tag;
      const msg = "message" in entry.event ? String((entry.event as any).message ?? "") : "";
      out.push({
        id: entry.id,
        time: entry.time,
        kind: entry.kind,
        primary: tag,
        secondary: msg || undefined,
      });
    }
    return out;
  }, [entries, entriesVersion]);

  const Row = ({ index, style, ariaAttributes, items }: RowComponentProps<RowProps>) => {
    const item = items[index]!;
    const color = kindColor(item.kind);
    const kindLabel =
      item.kind === "core-error"
        ? "Core"
        : item.kind === "state"
          ? "State"
          : item.kind === "engine"
            ? "Engine"
            : item.kind === "intent"
              ? "Intent"
              : "Error";

    return (
      <Box
        style={style}
        {...ariaAttributes}
        sx={{
          display: "flex",
          gap: 1,
          fontFamily: "monospace",
          fontSize: "0.78rem",
          alignItems: "center",
          px: 0.25,
        }}
      >
        <Box sx={{ width: 64, color: "text.secondary" }}>{formatTime(item.time)}</Box>
        <Box sx={{ width: 64, color, fontWeight: 700 }}>{kindLabel}</Box>
        <Box
          sx={{
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.secondary ? `${item.primary} — ${item.secondary}` : item.primary}
        </Box>
      </Box>
    );
  };

  return (
    <Paper
      sx={{
        p: 1.25,
        bgcolor: "rgba(0,0,0,0.60)",
        color: "common.white",
        height: "100%",
        overflow: "auto",
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        Runtime Transitions
      </Typography>

      {items.length === 0 ? (
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          —
        </Typography>
      ) : (
        <List<RowProps>
          rowComponent={Row}
          rowCount={items.length}
          rowHeight={20}
          rowProps={{ items }}
          defaultHeight={320}
          style={{ height: "100%", width: "100%" }}
        />
      )}
    </Paper>
  );
}
