import { cycleDurationMsFor, msFromSeconds, occurrencesBetween, parseVideoDuration } from "@hbb-emu/core";
import type { StreamEventConfig } from "@hbb-emu/extension-common";
import { Box, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";

interface ChannelTimelineProps {
  mp4Source: string;
  streamEvents: ReadonlyArray<StreamEventConfig>;
}

interface TimelineEvent {
  id: string;
  label: string;
  timeSeconds: number;
  position: number; // 0-100%
  scheduleMode: "timestamps" | "interval" | "delay";
}

/**
 * Calcola tutte le occorrenze degli stream events entro una durata specificata.
 * Usa occurrencesBetween dallo scheduler per garantire coerenza totale con il comportamento runtime.
 */
const computeEventOccurrences = (
  streamEvents: ReadonlyArray<StreamEventConfig>,
  durationSeconds: number,
): ReadonlyArray<TimelineEvent> => {
  const occurrences: TimelineEvent[] = [];
  const durationMs = durationSeconds * 1000;
  const baseMs = 0;

  for (const event of streamEvents) {
    if (!event.enabled) continue;

    const scheduleMode = (event.scheduleMode ?? "delay") as "timestamps" | "interval" | "delay";
    const label = event.label || event.eventName;

    // Usa occorrencesBetween con la stessa logica dello scheduler
    let rawOccurrences: ReturnType<typeof occurrencesBetween> = [];

    switch (scheduleMode) {
      case "interval": {
        const intervalMs = Math.max(1000, msFromSeconds(event.intervalSeconds, 10));
        const offsetMs = msFromSeconds(event.offsetSeconds, 0);
        rawOccurrences = occurrencesBetween(0, durationMs, baseMs, intervalMs, offsetMs, `${event.id}::interval`);
        break;
      }
      case "timestamps": {
        const atMs = msFromSeconds(event.atSeconds, 0);
        const cycleMs = cycleDurationMsFor(atMs);
        rawOccurrences = occurrencesBetween(0, durationMs, baseMs, cycleMs, atMs, `${event.id}::timestamps`);
        break;
      }
      case "delay": {
        const delayMs = msFromSeconds(event.delaySeconds, 0);
        const cycleMs = cycleDurationMsFor(delayMs);
        rawOccurrences = occurrencesBetween(0, durationMs, baseMs, cycleMs, delayMs, `${event.id}::delay`);
        break;
      }
    }

    // Mappa al formato timeline
    for (const occ of rawOccurrences) {
      occurrences.push({
        id: occ.instanceId,
        label,
        timeSeconds: occ.scheduledAtMs / 1000,
        position: (occ.scheduledAtMs / durationMs) * 100,
        scheduleMode,
      });
    }
  }

  return occurrences.sort((a, b) => a.timeSeconds - b.timeSeconds);
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getEventColor = (scheduleMode: "timestamps" | "interval" | "delay"): string => {
  switch (scheduleMode) {
    case "interval":
      return "#2196f3";
    case "timestamps":
      return "#4caf50";
    case "delay":
      return "#ff9800";
    default:
      return "#757575";
  }
};

export function ChannelTimeline({ mp4Source, streamEvents }: ChannelTimelineProps) {
  const [duration, setDuration] = useState<number | null>(null);
  const [events, setEvents] = useState<ReadonlyArray<TimelineEvent>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mp4Source) {
      setDuration(null);
      setEvents([]);
      setError("No video source provided");
      return;
    }

    setError(null);
    parseVideoDuration(mp4Source)
      .then((dur) => {
        console.log("Duration received in component:", dur);
        setDuration(dur);
        const computed = computeEventOccurrences(streamEvents, dur);
        console.log("Computed events:", computed);
        setEvents(computed);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to parse video duration:", err);
        setEvents([]);
        setDuration(null);
        setError(err.message || "Unknown error");
      });
  }, [mp4Source, streamEvents]);

  if (!duration || duration <= 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Unable to parse video duration from URL.
          </Typography>
          {error && (
            <Typography variant="caption" color="error.main">
              Error: {error}
            </Typography>
          )}
          {mp4Source && (
            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
              Source: {mp4Source}
            </Typography>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="elevation" elevation={2} sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" fontWeight="bold">
            Timeline
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Duration: {formatTime(duration)}
          </Typography>
        </Stack>

        <Box sx={{ position: "relative", height: 60, mt: 2 }}>
          {/* Barra della timeline */}
          <Box
            sx={{
              position: "absolute",
              top: 28,
              left: 0,
              right: 0,
              height: 4,
              bgcolor: "divider",
              borderRadius: 2,
            }}
          />

          {/* Marcatori degli eventi */}
          {events.map((event) => (
            <Tooltip
              key={event.id}
              title={
                <Stack spacing={0.5}>
                  <Typography variant="caption" fontWeight="bold">
                    {event.label}
                  </Typography>
                  <Typography variant="caption">Time: {formatTime(event.timeSeconds)}</Typography>
                  <Typography variant="caption">Mode: {event.scheduleMode}</Typography>
                </Stack>
              }
              arrow
              placement="top"
            >
              <Box
                sx={{
                  position: "absolute",
                  left: `${event.position}%`,
                  top: 0,
                  transform: "translateX(-50%)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  "&:hover": {
                    transform: "translateX(-50%) scale(1.3)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    bgcolor: getEventColor(event.scheduleMode),
                    border: "2px solid white",
                    boxShadow: 1,
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    top: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 2,
                    height: 16,
                    bgcolor: getEventColor(event.scheduleMode),
                    opacity: 0.5,
                  }}
                />
              </Box>
            </Tooltip>
          ))}

          {/* Marcatori tempo (0, metà, fine) */}
          <Box sx={{ position: "absolute", top: 45, left: 0, right: 0 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                0:00
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatTime(duration / 2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatTime(duration)}
              </Typography>
            </Stack>
          </Box>
        </Box>

        {/* Legenda */}
        {events.length > 0 && (
          <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#2196f3" }} />
              <Typography variant="caption">Interval</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#4caf50" }} />
              <Typography variant="caption">Timestamps</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#ff9800" }} />
              <Typography variant="caption">Delay</Typography>
            </Stack>
          </Stack>
        )}

        {events.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 1 }}>
            No stream events configured
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
