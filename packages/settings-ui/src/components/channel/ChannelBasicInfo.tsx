import type { ChannelConfig } from "@hbb-emu/extension-common";
import { Edit, Save } from "@mui/icons-material";
import { IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { type ChangeEvent, useState } from "react";

interface ChannelBasicInfoProps {
  name: string;
  mp4Source: string;
  channel: ChannelConfig;
  defaultMode?: "display" | "edit";
  onChange?: (field: "name" | "mp4Source", value: string) => void;
  onSave?: (updated: ChannelConfig) => TE.TaskEither<unknown, void>;
}

export function ChannelBasicInfo({ name, mp4Source, channel, defaultMode, onChange, onSave }: ChannelBasicInfoProps) {
  const isLocked = defaultMode !== undefined;
  const [mode, setMode] = useState<"display" | "edit">(defaultMode ?? "display");
  const [localName, setLocalName] = useState(name);
  const [localMp4Source, setLocalMp4Source] = useState(mp4Source);

  const handleSave = () => {
    onChange?.("name", localName);
    onChange?.("mp4Source", localMp4Source);

    const updated = { ...channel, name: localName, mp4Source: localMp4Source };

    const save = pipe(
      onSave!(updated),
      TE.tapIO(() => () => {
        if (!isLocked) setMode("display");
      }),
      TE.match(
        (error) => console.error("Failed to save channel:", error),
        () => console.log("Channel saved successfully"),
      ),
    );

    if (onSave) {
      save();
    } else if (!isLocked) {
      setMode("display");
    }
  };

  const handleEdit = () => {
    if (!isLocked) {
      setLocalName(name);
      setLocalMp4Source(mp4Source);
      setMode("edit");
    }
  };

  if (mode === "display") {
    return (
      <Stack gap={1} position="relative">
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Name
          </Typography>
          {!isLocked && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={handleEdit}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Typography>{name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          MP4 Source
        </Typography>
        <Typography sx={{ wordBreak: "break-all", fontSize: "0.875rem" }}>{mp4Source}</Typography>
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      {!isLocked && (
        <IconButton size="small" onClick={handleSave} sx={{ alignSelf: "flex-end" }}>
          <Save fontSize="small" />
        </IconButton>
      )}
      <TextField
        label="Channel Name"
        value={isLocked ? name : localName}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (isLocked) {
            onChange?.("name", e.target.value);
          } else {
            setLocalName(e.target.value);
          }
        }}
        fullWidth
        required
      />
      <TextField
        label="MP4 Source"
        value={isLocked ? mp4Source : localMp4Source}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (isLocked) {
            onChange?.("mp4Source", e.target.value);
          } else {
            setLocalMp4Source(e.target.value);
          }
        }}
        fullWidth
        required
        type="url"
      />
    </Stack>
  );
}
