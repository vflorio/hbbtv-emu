import { Box, Paper, Typography } from "@mui/material";
import { pipe } from "fp-ts/function";
import * as RA from "fp-ts/ReadonlyArray";
import { useMemo } from "react";
import { List } from "react-window";
import { match } from "ts-pattern";
import type { RuntimeDebugEntry } from "../hooks/usePlayerDebug";

type LineItem = {
  readonly id: number;
  readonly time: number;
  readonly kind: RuntimeDebugEntry["kind"];
  readonly primary: string;
  readonly secondary?: string;
};

type TransitionRowProps = {
  readonly items: readonly LineItem[];
};

export function TransitionsPanel({ entries }: { entries: readonly RuntimeDebugEntry[] }) {
  const entryToLineItem = (entry: RuntimeDebugEntry): LineItem =>
    match(entry)
      .with({ kind: "state" }, (e) => ({
        id: e.id,
        time: e.time,
        kind: "state" as const,
        primary: `${e.from} -> ${e.to}`,
      }))
      .otherwise((e) => {
        const tag = e.event._tag;
        const msg = "message" in e.event ? String((e.event as any).message ?? "") : "";
        return {
          id: e.id,
          time: e.time,
          kind: e.kind,
          primary: tag,
          secondary: msg || undefined,
        };
      });

  const items = useMemo(() => pipe(entries, RA.map(entryToLineItem), RA.reverse), [entries]);

  return (
    <Paper
      sx={{
        p: 1.25,
        bgcolor: "rgba(0,0,0,0.8)",
        color: "common.white",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
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
        <Box sx={{ flex: "1 1 auto", minHeight: 0 }}>
          <List<TransitionRowProps>
            rowComponent={TransitionRow}
            rowCount={items.length}
            rowHeight={20}
            rowProps={{ items }}
            defaultHeight={320}
            style={{ width: "100%" }}
          />
        </Box>
      )}
    </Paper>
  );
}

const TransitionRow = ({
  index,
  style,
  ariaAttributes,
  items,
}: {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
  items: readonly LineItem[];
}) => {
  const item = items[index];
  if (!item) return <Box style={style} />;

  const kindColor = (kind: RuntimeDebugEntry["kind"]): string =>
    match(kind)
      .with("intent", () => "info.light")
      .with("engine", () => "success.light")
      .with("state", () => "warning.light")
      .with("core-error", "error", () => "error.light")
      .exhaustive();

  const kindLabel = (kind: RuntimeDebugEntry["kind"]): string =>
    match(kind)
      .with("core-error", () => "Core")
      .with("state", () => "State")
      .with("engine", () => "Engine")
      .with("intent", () => "Intent")
      .with("error", () => "Error")
      .exhaustive();

  const color = kindColor(item.kind);
  const label = kindLabel(item.kind);

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
      <Box sx={{ width: 100, opacity: 0.8 }}>{formatTime(item.time)}</Box>
      <Box sx={{ width: 60, color, fontWeight: 700 }}>{label}</Box>
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

const formatTime = (ms: number) => {
  const d = new Date(ms);
  const iso = d.toISOString();
  return iso.split("T")[1]?.split("Z")[0] ?? iso;
};
