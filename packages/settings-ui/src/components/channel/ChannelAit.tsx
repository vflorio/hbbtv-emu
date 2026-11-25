import { randomUUID } from "@hbb-emu/core";
import type { ChannelConfig } from "@hbb-emu/extension-common";
import { type AitApplication, type AitControlCode, autostartApplication } from "@hbb-emu/oipf-api";
import { Add, Delete, Edit, Save } from "@mui/icons-material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionActions,
  AccordionDetails,
  AccordionSummary,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useState } from "react";

const CONTROL_CODES: ReadonlyArray<AitControlCode> = ["AUTOSTART", "PRESENT", "KILL", "DISABLED"];

const NEW_APPLICATION: AitApplication = { orgId: 0, appId: 1, controlCode: "AUTOSTART", url: "" };

/** A row being edited, with a key of its own (rows can be removed while edited). */
type Row = Readonly<{ key: string; application: AitApplication }>;

const toRows = (applications: ReadonlyArray<AitApplication>): Row[] =>
  applications.map((application) => ({ key: randomUUID(), application }));

const hex = (value: number) => `0x${value.toString(16)}`;

/** Accepts decimal or 0x-prefixed hexadecimal, as ids are written either way. */
const parseId = (text: string): number => {
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 0 ? value : 0;
};

interface ChannelAitProps {
  channel: ChannelConfig;
  onSave?: (updated: ChannelConfig) => TE.TaskEither<unknown, void>;
}

/** The applications the channel signals in its AIT (which one starts, from which URL). */
export function ChannelAit({ channel, onSave }: ChannelAitProps) {
  const applications = channel.ait?.applications ?? [];
  const [mode, setMode] = useState<"display" | "edit">("display");
  const [rows, setRows] = useState<Row[]>([]);
  const autostart = autostartApplication(channel.ait);

  const update = (key: string, patch: Partial<AitApplication>) =>
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { key, application: { ...row.application, ...patch } } : row)),
    );

  const handleEdit = () => {
    setRows(toRows(applications));
    setMode("edit");
  };

  const handleSave = () => {
    const { ait: _previous, ...rest } = channel;
    const edited = rows.map((row) => row.application);
    const updated: ChannelConfig = edited.length > 0 ? { ...rest, ait: { applications: edited } } : rest;
    if (!onSave) return setMode("display");
    void pipe(
      onSave(updated),
      TE.match(
        (error) => console.error("Failed to save the AIT:", error),
        () => setMode("display"),
      ),
    )();
  };

  return (
    <Accordion elevation={2}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2">AIT (applications)</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {mode === "display" ? (
          <Stack gap={1}>
            {applications.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No applications signalled: the channel shows the broadcast alone.
              </Typography>
            ) : (
              applications.map((application) => (
                <Stack key={`${application.orgId}.${application.appId}.${application.url}`} gap={0.5}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Chip
                      size="small"
                      label={application.controlCode}
                      color={application === autostart ? "primary" : "default"}
                    />
                    <Typography variant="body2">{application.name ?? "(no name)"}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      org {hex(application.orgId)} · app {hex(application.appId)}
                      {application.priority !== undefined && ` · priority ${application.priority}`}
                    </Typography>
                  </Stack>
                  <Typography sx={{ wordBreak: "break-all", fontSize: "0.875rem" }}>{application.url}</Typography>
                </Stack>
              ))
            )}
          </Stack>
        ) : (
          <Stack gap={3}>
            {rows.map(({ key, application }) => (
              <Stack key={key} gap={1.5}>
                <Stack direction="row" gap={1} alignItems="center">
                  <TextField
                    select
                    label="Control code"
                    size="small"
                    value={application.controlCode}
                    onChange={(e) => update(key, { controlCode: e.target.value as AitControlCode })}
                    sx={{ minWidth: 140 }}
                  >
                    {CONTROL_CODES.map((code) => (
                      <MenuItem key={code} value={code}>
                        {code}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Name"
                    size="small"
                    value={application.name ?? ""}
                    onChange={(e) => update(key, { name: e.target.value || undefined })}
                    fullWidth
                  />
                  <Tooltip title="Remove">
                    <IconButton size="small" onClick={() => setRows((prev) => prev.filter((row) => row.key !== key))}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <TextField
                  label="URL"
                  size="small"
                  type="url"
                  value={application.url}
                  onChange={(e) => update(key, { url: e.target.value })}
                  fullWidth
                  required
                />
                <Stack direction="row" gap={1}>
                  <TextField
                    label="Organisation id"
                    size="small"
                    defaultValue={hex(application.orgId)}
                    onChange={(e) => update(key, { orgId: parseId(e.target.value) })}
                  />
                  <TextField
                    label="Application id"
                    size="small"
                    defaultValue={hex(application.appId)}
                    onChange={(e) => update(key, { appId: parseId(e.target.value) })}
                  />
                  <TextField
                    label="Priority"
                    size="small"
                    type="number"
                    value={application.priority ?? 0}
                    onChange={(e) => update(key, { priority: parseId(e.target.value) })}
                  />
                </Stack>
              </Stack>
            ))}
            <Button
              size="small"
              startIcon={<Add />}
              onClick={() => setRows((prev) => [...prev, ...toRows([NEW_APPLICATION])])}
              sx={{ alignSelf: "flex-start" }}
            >
              Add application
            </Button>
          </Stack>
        )}
      </AccordionDetails>
      <AccordionActions>
        {mode === "edit" ? (
          <Tooltip title="Save">
            <IconButton size="small" onClick={handleSave}>
              <Save fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="Edit">
            <IconButton size="small" onClick={handleEdit}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </AccordionActions>
    </Accordion>
  );
}
