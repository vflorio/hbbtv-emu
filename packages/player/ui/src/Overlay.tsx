import type { PlayerCore, PlayerEvent, PlayerState } from "@hbb-emu/player-core";
import * as Matchers from "@hbb-emu/player-core";
import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, Typography } from "@mui/material";
import * as O from "fp-ts/Option";
import type React from "react";
import { useMemo } from "react";
import { formatTime } from "./format";
import { type RuntimeDebugEntry, usePlayerDebug } from "./hooks/usePlayerDebug";

export type PlayerUiOverlayProps = {
  readonly core: PlayerCore;
  /**
   * Optional: pass a ref to your <video>. Used only for small bits of display/debug.
   * Overlay positioning is achieved by rendering this component inside the same relative container.
   */
  readonly videoRef?: React.RefObject<HTMLVideoElement | null>;
};

type MatcherResults = {
  isPlayable: boolean;
  isError: boolean;
  isRecoverable: boolean;
  isFatal: boolean;
  isControlState: boolean;
  isSourceState: boolean;
  isHLSState: boolean;
  isDASHState: boolean;
  isMP4State: boolean;

  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;

  canSeek: boolean;
  canControl: boolean;

  currentTime: number | null;
  duration: number | null;
  bufferedRanges: readonly any[];
  error: Error | null;
  retryCount: number | null;

  description: string;

  _tag: PlayerState.Any["_tag"] | null;
  _tagGroup: PlayerState.Any["_tagGroup"] | null;
};

const getMatcherResults = (playerState: PlayerState.Any | null): MatcherResults => {
  if (playerState === null) {
    return {
      isPlayable: false,
      isError: false,
      isRecoverable: false,
      isFatal: false,
      isControlState: false,
      isSourceState: false,
      isHLSState: false,
      isDASHState: false,
      isMP4State: false,

      isPlaying: false,
      isPaused: false,
      isLoading: false,

      canSeek: false,
      canControl: false,

      currentTime: null,
      duration: null,
      bufferedRanges: [],
      error: null,
      retryCount: null,

      description: "",

      _tag: null,
      _tagGroup: null,
    };
  }

  return {
    isPlayable: Matchers.isPlayable(playerState),
    isError: Matchers.isError(playerState),
    isRecoverable: Matchers.isRecoverable(playerState),
    isFatal: Matchers.isFatal(playerState),
    isControlState: Matchers.isControlState(playerState),
    isSourceState: Matchers.isSourceState(playerState),
    isHLSState: Matchers.isHLSState(playerState),
    isDASHState: Matchers.isDASHState(playerState),
    isMP4State: Matchers.isMP4State(playerState),

    isPlaying: Matchers.isPlaying(playerState),
    isPaused: Matchers.isPaused(playerState),
    isLoading: Matchers.isLoading(playerState),

    canSeek: Matchers.canSeek(playerState),
    canControl: Matchers.canControl(playerState),

    currentTime: Matchers.getCurrentTime(playerState),
    duration: Matchers.getDuration(playerState),
    bufferedRanges: Matchers.getBufferedRanges(playerState),
    error: Matchers.getError(playerState),
    retryCount: Matchers.getRetryCount(playerState),

    description: Matchers.getStateDescription(playerState),

    _tag: playerState._tag,
    _tagGroup: playerState._tagGroup,
  };
};

function EventLine({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Box sx={{ width: 90, color: "text.secondary" }}>{label}</Box>
      <Box sx={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</Box>
    </Box>
  );
}

function TransitionsPanel({ entries }: { entries: readonly RuntimeDebugEntry[] }) {
  const groups = useMemo(() => {
    const state: { id: number; value: string }[] = [];
    const intents: { id: number; value: string }[] = [];
    const engine: { id: number; value: string }[] = [];
    const errors: { id: number; value: string }[] = [];

    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]!;
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
      } else if (entry.kind === "engine") {
        if (engine.length < 25) engine.push({ id: entry.id, value: line });
      } else {
        const msg = "message" in entry.event ? (entry.event as any).message : "";
        if (errors.length < 25) errors.push({ id: entry.id, value: msg ? `${line} — ${String(msg)}` : line });
      }
    }

    return {
      state: state.reverse(),
      intents: intents.reverse(),
      engine: engine.reverse(),
      errors: errors.reverse(),
    };
  }, [entries]);

  return (
    <Paper sx={{ p: 1.25, bgcolor: "rgba(0,0,0,0.60)", color: "common.white" }}>
      <Typography variant="subtitle2" gutterBottom>
        Runtime Transitions
      </Typography>

      <Stack gap={1.0} sx={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Intents
          </Typography>
          {groups.intents.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              —
            </Typography>
          ) : (
            groups.intents.map((l) => <EventLine key={l.id} label="Intent" value={l.value} />)
          )}
        </Box>

        <Box>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Engine Events
          </Typography>
          {groups.engine.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              —
            </Typography>
          ) : (
            groups.engine.map((l) => <EventLine key={l.id} label="Engine" value={l.value} />)
          )}
        </Box>

        <Box>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Errors
          </Typography>
          {groups.errors.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              —
            </Typography>
          ) : (
            groups.errors.map((l) => (
              <Box key={l.id} sx={{ color: "error.light" }}>
                <EventLine label="Error" value={l.value} />
              </Box>
            ))
          )}
        </Box>

        <Box>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            State Changes
          </Typography>
          {groups.state.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
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

function MatchersPanel({ playerState }: { playerState: PlayerState.Any | null }) {
  const matcherResults = useMemo(() => getMatcherResults(playerState), [playerState]);

  const MatcherItem = ({ label, value }: { label: string; value: unknown }) => {
    const color = value === true ? "success.light" : value === false ? "text.disabled" : "info.light";
    return (
      <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.25 }}>
        <Typography variant="caption">{label}:</Typography>
        <Typography variant="caption" sx={{ fontWeight: "bold", color }}>
          {JSON.stringify(value)}
        </Typography>
      </Box>
    );
  };

  return (
    <Paper sx={{ p: 1.25, bgcolor: "rgba(0,0,0,0.60)", color: "common.white" }}>
      <Typography variant="subtitle2" gutterBottom>
        Matchers
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} gap={1.25}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            State Types
          </Typography>
          <MatcherItem label="isPlayable" value={matcherResults.isPlayable} />
          <MatcherItem label="isError" value={matcherResults.isError} />
          <MatcherItem label="isRecoverable" value={matcherResults.isRecoverable} />
          <MatcherItem label="isFatal" value={matcherResults.isFatal} />
          <MatcherItem label="isControlState" value={matcherResults.isControlState} />
          <MatcherItem label="isSourceState" value={matcherResults.isSourceState} />
          <MatcherItem label="isHLSState" value={matcherResults.isHLSState} />
          <MatcherItem label="isDASHState" value={matcherResults.isDASHState} />
          <MatcherItem label="isMP4State" value={matcherResults.isMP4State} />
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Status
          </Typography>
          <MatcherItem label="isPlaying" value={matcherResults.isPlaying} />
          <MatcherItem label="isPaused" value={matcherResults.isPaused} />
          <MatcherItem label="isLoading" value={matcherResults.isLoading} />
          <Divider sx={{ my: 0.75, borderColor: "rgba(255,255,255,0.20)" }} />
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Capabilities
          </Typography>
          <MatcherItem label="canSeek" value={matcherResults.canSeek} />
          <MatcherItem label="canControl" value={matcherResults.canControl} />
        </Box>
      </Stack>

      <Divider sx={{ my: 0.75, borderColor: "rgba(255,255,255,0.20)" }} />

      <Box sx={{ fontFamily: "monospace" }}>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          Extracted Data
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1} flexWrap="wrap">
          <Box sx={{ flex: "1 1 45%" }}>
            <Typography variant="caption">
              <strong>getCurrentTime():</strong> {JSON.stringify(matcherResults.currentTime)}
            </Typography>
          </Box>
          <Box sx={{ flex: "1 1 45%" }}>
            <Typography variant="caption">
              <strong>getDuration():</strong> {JSON.stringify(matcherResults.duration)}
            </Typography>
          </Box>
          <Box sx={{ flex: "1 1 45%" }}>
            <Typography variant="caption">
              <strong>getError():</strong> {JSON.stringify(matcherResults.error?.message ?? null)}
            </Typography>
          </Box>
          <Box sx={{ flex: "1 1 45%" }}>
            <Typography variant="caption">
              <strong>getRetryCount():</strong> {JSON.stringify(matcherResults.retryCount)}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}

function StateInfo({ core, playerState }: { core: PlayerCore; playerState: PlayerState.Any | null }) {
  const matcherResults = useMemo(() => getMatcherResults(playerState), [playerState]);

  const playbackType: string | null = useMemo(() => {
    const opt = core.getPlaybackType();
    return O.isSome(opt) ? opt.value : null;
  }, [core, playerState]);

  return (
    <Paper sx={{ p: 1.25, bgcolor: "rgba(0,0,0,0.60)", color: "common.white" }}>
      <Typography variant="subtitle2" gutterBottom>
        Current State
      </Typography>
      <Box
        sx={{
          p: 1.0,
          bgcolor: "rgba(255,255,255,0.08)",
          borderRadius: 1,
          fontFamily: "monospace",
          fontSize: "0.80rem",
          mb: 1.0,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: "bold", color: "primary.light", display: "block" }}>
          {playerState?._tag || "No state"}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          {matcherResults.description || "Waiting..."}
        </Typography>
      </Box>

      <Stack direction="row" gap={1} flexWrap="wrap">
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="caption">
            <strong>Playback Type:</strong> {playbackType || "None"}
          </Typography>
        </Box>
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="caption">
            <strong>Tag Group:</strong> {playerState?._tagGroup || "None"}
          </Typography>
        </Box>
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="caption">
            <strong>Time:</strong> {matcherResults.currentTime?.toFixed(1) ?? "0.0"}s /{" "}
            {matcherResults.duration?.toFixed(1) ?? "0.0"}s
          </Typography>
        </Box>
        <Box sx={{ flex: "1 1 45%" }}>
          <Typography variant="caption">
            <strong>Buffered:</strong> {matcherResults.bufferedRanges?.length ?? 0} ranges
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function PlayerControls({ core, playerState }: { core: PlayerCore; playerState: PlayerState.Any | null }) {
  const matcherResults = useMemo(() => getMatcherResults(playerState), [playerState]);

  const dispatch = (event: PlayerEvent) => core.dispatch(event)();

  const handlePlay = () => dispatch({ _tag: "Intent/PlayRequested" });
  const handlePause = () => dispatch({ _tag: "Intent/PauseRequested" });
  const handleSeek = (time: number) => dispatch({ _tag: "Intent/SeekRequested", time });

  return (
    <Stack direction="row" gap={1}>
      <Button
        variant="contained"
        onClick={handlePlay}
        disabled={!matcherResults.canControl || matcherResults.isPlaying}
      >
        Play
      </Button>
      <Button variant="contained" onClick={handlePause} disabled={!matcherResults.isPlaying}>
        Pause
      </Button>
      <Button variant="outlined" onClick={() => handleSeek(0)} disabled={!matcherResults.canSeek}>
        Restart
      </Button>
    </Stack>
  );
}

export function Overlay({ core, videoRef }: PlayerUiOverlayProps) {
  const { playerState, entries } = usePlayerDebug(core);

  const error = useMemo(() => (playerState ? (Matchers.getError(playerState)?.message ?? null) : null), [playerState]);
  const loading = useMemo(() => (playerState ? Matchers.isLoading(playerState) : false), [playerState]);

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        p: 1,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        pointerEvents: "none",
      }}
    >
      {/* Top row */}
      <Stack direction="row" gap={1} sx={{ flex: "0 0 auto" }}>
        <Stack gap={1} sx={{ width: 420, pointerEvents: "auto" }}>
          <Paper sx={{ p: 1.25, bgcolor: "rgba(0,0,0,0.60)", color: "common.white" }}>
            <Typography variant="subtitle2" gutterBottom>
              Controls
            </Typography>
            <PlayerControls core={core} playerState={playerState} />
            <Box sx={{ mt: 1.0, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              {videoRef?.current?.src ? (
                <Chip size="small" label={`src: ${videoRef.current.src}`} sx={{ maxWidth: 380 }} />
              ) : null}
            </Box>
          </Paper>
          <StateInfo core={core} playerState={playerState} />
        </Stack>

        <Box sx={{ flex: 1, minWidth: 360, pointerEvents: "auto" }}>
          <MatchersPanel playerState={playerState} />
        </Box>
      </Stack>

      {/* Bottom row */}
      <Box sx={{ flex: 1, minHeight: 0, pointerEvents: "auto" }}>
        <TransitionsPanel entries={entries} />
      </Box>

      {/* Error / Loading overlays */}
      {error ? (
        <Box sx={{ position: "absolute", left: 8, right: 8, bottom: 8, pointerEvents: "auto" }}>
          <Alert severity="error" sx={{ fontFamily: "monospace" }}>
            {error}
          </Alert>
        </Box>
      ) : null}

      {loading ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(0,0,0,0.25)",
          }}
        >
          <CircularProgress />
        </Box>
      ) : null}
    </Box>
  );
}
