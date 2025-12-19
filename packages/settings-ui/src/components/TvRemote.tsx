import {
  ArrowBack,
  ArrowDownward,
  ArrowForward,
  ArrowUpward,
  Check,
  ExpandLess,
  ExpandMore,
  FastForward,
  FastRewind,
  Pause,
  PlayArrow,
  Stop,
  VolumeDown,
  VolumeUp,
} from "@mui/icons-material";
import { Button, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

// HbbTV key codes reference
const KEY_CODES = {
  // Navigation
  VK_UP: 38,
  VK_DOWN: 40,
  VK_LEFT: 37,
  VK_RIGHT: 39,
  VK_ENTER: 13,
  VK_BACK: 461,

  // Color keys
  VK_RED: 403,
  VK_GREEN: 404,
  VK_YELLOW: 405,
  VK_BLUE: 406,

  // Numeric keys
  VK_0: 48,
  VK_1: 49,
  VK_2: 50,
  VK_3: 51,
  VK_4: 52,
  VK_5: 53,
  VK_6: 54,
  VK_7: 55,
  VK_8: 56,
  VK_9: 57,

  // Media control
  VK_PLAY: 415,
  VK_PAUSE: 19,
  VK_STOP: 413,
  VK_FAST_FWD: 417,
  VK_REWIND: 412,

  // Volume
  VK_VOLUME_UP: 447,
  VK_VOLUME_DOWN: 448,

  // Channel
  VK_CHANNEL_UP: 427,
  VK_CHANNEL_DOWN: 428,
} as const;

const spacing = {
  xs: 0.5,
  sm: 1,
  md: 2,
};

export function TvRemote({ handleKeyPress }: { handleKeyPress: (keyCode: number) => void }) {
  const numpadSection = (
    <Section>
      <Stack direction="row" gap={spacing}>
        <TvRemoteButton label="1" keyCode={KEY_CODES.VK_1} onClick={handleKeyPress} fullWidth />
        <TvRemoteButton label="2" keyCode={KEY_CODES.VK_2} onClick={handleKeyPress} fullWidth />
        <TvRemoteButton label="3" keyCode={KEY_CODES.VK_3} onClick={handleKeyPress} fullWidth />
      </Stack>
      <Stack direction="row" gap={spacing}>
        <TvRemoteButton label="4" keyCode={KEY_CODES.VK_4} onClick={handleKeyPress} fullWidth />
        <TvRemoteButton label="5" keyCode={KEY_CODES.VK_5} onClick={handleKeyPress} fullWidth />
        <TvRemoteButton label="6" keyCode={KEY_CODES.VK_6} onClick={handleKeyPress} fullWidth />
      </Stack>
      <Stack direction="row" gap={spacing}>
        <TvRemoteButton label="7" keyCode={KEY_CODES.VK_7} onClick={handleKeyPress} fullWidth />
        <TvRemoteButton label="8" keyCode={KEY_CODES.VK_8} onClick={handleKeyPress} fullWidth />
        <TvRemoteButton label="9" keyCode={KEY_CODES.VK_9} onClick={handleKeyPress} fullWidth />
      </Stack>
      <Stack direction="row" gap={spacing} justifyContent="center" sx={{ "& button": { maxWidth: 96 } }}>
        <TvRemoteButton isEmpty fullWidth />
        <TvRemoteButton label="0" keyCode={KEY_CODES.VK_0} onClick={handleKeyPress} fullWidth />
        <TvRemoteButton isEmpty fullWidth />
      </Stack>
    </Section>
  );

  const navigationSection = (
    <Section>
      <Stack direction="row" gap={spacing} justifyContent="center" sx={{ "& button": { maxWidth: 96 } }}>
        <TvRemoteButton isEmpty fullWidth />
        <TvRemoteButton
          label="UP"
          keyCode={KEY_CODES.VK_UP}
          icon={<ArrowUpward />}
          onClick={handleKeyPress}
          fullWidth
        />
        <TvRemoteButton isEmpty fullWidth />
      </Stack>
      <Stack direction="row" gap={spacing} justifyContent="center" sx={{ "& button": { maxWidth: 96 } }}>
        <TvRemoteButton
          label="LEFT"
          keyCode={KEY_CODES.VK_LEFT}
          icon={<ArrowBack />}
          onClick={handleKeyPress}
          fullWidth
        />
        <TvRemoteButton
          label="OK"
          keyCode={KEY_CODES.VK_ENTER}
          icon={<Check />}
          onClick={handleKeyPress}
          color="secondary"
          fullWidth
        />
        <TvRemoteButton
          label="RIGHT"
          keyCode={KEY_CODES.VK_RIGHT}
          icon={<ArrowForward />}
          onClick={handleKeyPress}
          fullWidth
        />
      </Stack>
      <Stack direction="row" gap={spacing} justifyContent="center" sx={{ "& button": { maxWidth: 96 } }}>
        <TvRemoteButton
          label="BACK"
          keyCode={KEY_CODES.VK_BACK}
          icon={<ArrowBack />}
          variant="contained"
          color="info"
          onClick={handleKeyPress}
          fullWidth
        />
        <TvRemoteButton
          label="DOWN"
          keyCode={KEY_CODES.VK_DOWN}
          icon={<ArrowDownward />}
          onClick={handleKeyPress}
          fullWidth
        />
        <TvRemoteButton isEmpty fullWidth />
      </Stack>
    </Section>
  );

  const smartSection = (
    <Section row>
      <TvRemoteButton
        label="RED"
        color="error"
        keyCode={KEY_CODES.VK_RED}
        onClick={handleKeyPress}
        buttonSize="small"
        fullWidth
      />
      <TvRemoteButton
        label="GREEN"
        color="success"
        keyCode={KEY_CODES.VK_GREEN}
        onClick={handleKeyPress}
        buttonSize="small"
        fullWidth
      />
      <TvRemoteButton
        label="YELLOW"
        color="warning"
        keyCode={KEY_CODES.VK_YELLOW}
        onClick={handleKeyPress}
        buttonSize="small"
        fullWidth
      />
      <TvRemoteButton
        label="BLUE"
        color="info"
        keyCode={KEY_CODES.VK_BLUE}
        onClick={handleKeyPress}
        buttonSize="small"
        fullWidth
      />
    </Section>
  );

  const volumeSection = (
    <Section>
      <TvRemoteButton
        label="VOL+"
        keyCode={KEY_CODES.VK_VOLUME_UP}
        icon={<VolumeUp />}
        onClick={handleKeyPress}
        fullWidth
      />
      <TvRemoteButton
        label="VOL-"
        keyCode={KEY_CODES.VK_VOLUME_DOWN}
        icon={<VolumeDown />}
        onClick={handleKeyPress}
        fullWidth
      />
    </Section>
  );

  const channelSection = (
    <Section>
      <TvRemoteButton
        label="CH+"
        keyCode={KEY_CODES.VK_CHANNEL_UP}
        icon={<ExpandLess />}
        onClick={handleKeyPress}
        fullWidth
      />
      <TvRemoteButton
        label="CH-"
        keyCode={KEY_CODES.VK_CHANNEL_DOWN}
        icon={<ExpandMore />}
        onClick={handleKeyPress}
        fullWidth
      />
    </Section>
  );

  const mediaSection = (
    <Section row>
      <TvRemoteButton
        label="REW"
        keyCode={KEY_CODES.VK_REWIND}
        icon={<FastRewind />}
        onClick={handleKeyPress}
        buttonSize="small"
      />
      <TvRemoteButton
        label="PLAY"
        keyCode={KEY_CODES.VK_PLAY}
        icon={<PlayArrow />}
        color="success"
        onClick={handleKeyPress}
        buttonSize="small"
      />
      <TvRemoteButton
        label="PAUSE"
        keyCode={KEY_CODES.VK_PAUSE}
        icon={<Pause />}
        color="warning"
        onClick={handleKeyPress}
        buttonSize="small"
      />
      <TvRemoteButton
        label="STOP"
        keyCode={KEY_CODES.VK_STOP}
        icon={<Stop />}
        color="error"
        onClick={handleKeyPress}
        buttonSize="small"
      />
      <TvRemoteButton
        label="FFW"
        keyCode={KEY_CODES.VK_FAST_FWD}
        icon={<FastForward />}
        onClick={handleKeyPress}
        buttonSize="small"
      />
    </Section>
  );

  return (
    <Stack gap={spacing}>
      {numpadSection}
      {navigationSection}
      <Stack direction="row" gap={spacing} width="100%">
        {channelSection}
        {volumeSection}
      </Stack>
      {smartSection}
      {mediaSection}
    </Stack>
  );
}

const getButtonStyles = (buttonSize: "small" | "medium" = "medium", fullWidth?: boolean) => {
  const sizes = {
    small: {
      minWidth: 56,
      minHeight: 38,
      maxHeight: 38,
      fontSize: 11,
    },
    medium: {
      minWidth: 70,
      minHeight: 48,
      maxHeight: 48,
      fontSize: 13,
    },
  };

  const size = sizes[buttonSize];

  return {
    ...size,
    flexDirection: "column" as const,
    flexGrow: fullWidth ? 1 : undefined,
    gap: buttonSize === "small" ? 0 : 0.25,
    fontWeight: "bold",
    padding: buttonSize === "small" ? "4px 8px" : "6px 12px",
  };
};

function Section({ children, row }: { children: ReactNode; row?: boolean }) {
  return (
    <Paper elevation={3} sx={{ p: spacing, width: "100%" }}>
      <Stack gap={spacing} direction={row ? "row" : "column"} flexWrap={"wrap"}>
        {children}
      </Stack>
    </Paper>
  );
}

interface TvRemoteButtonProps {
  label?: string;
  keyCode?: number;
  color?: "primary" | "secondary" | "error" | "info" | "success" | "warning";
  icon?: React.ReactNode;
  buttonSize?: "small" | "medium";
  variant?: "contained" | "outlined" | "text";
  fullWidth?: boolean;
  onClick?: (keyCode: number) => void;
  isEmpty?: boolean;
}

function TvRemoteButton({
  label,
  keyCode,
  color = "primary",
  icon,
  buttonSize = "medium",
  variant = "contained",
  fullWidth = false,
  onClick,
  isEmpty = false,
}: TvRemoteButtonProps) {
  const styles = getButtonStyles(buttonSize, fullWidth);

  if (isEmpty) {
    return <button type="button" style={{ ...styles, opacity: 0 }} />;
  }

  const handleClick = () => {
    if (onClick && keyCode !== undefined) {
      onClick(keyCode);
    }
  };

  return (
    <Button variant={variant} color={color} onClick={handleClick} sx={styles}>
      {icon}
      {label && <Typography variant="caption">{label}</Typography>}
    </Button>
  );
}
