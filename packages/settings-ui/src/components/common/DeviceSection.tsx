import {
  type DeviceProfile,
  deviceUserAgent,
  EMULATOR_TERMINAL,
  HBBTV_OPTIONS,
  HBBTV_VERSION_MAP,
  type HbbTVOption,
  type HbbTVVersion,
  hasFamilyName,
  type TerminalIdentity,
} from "@hbb-emu/oipf-api";
import {
  Alert,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useEffect, useState } from "react";
import { useDevice } from "../../hooks";

/** The text fields of the identity, in the order of the User-Agent (TS 102 796 §7.3.2.4). */
const IDENTITY_FIELDS = [
  { key: "vendorName", label: "Vendor", helper: "The consumer-facing make or brand" },
  { key: "modelName", label: "Model", helper: "The consumer-facing model name" },
  { key: "softwareVersion", label: "Software version" },
  { key: "hardwareVersion", label: "Hardware version", helper: "Optional" },
  { key: "familyName", label: "Family", helper: "Globally unique: a reverse domain name or a version 4 UUID" },
  { key: "browser", label: "Browser", helper: "The browser's user agent, sent before the HbbTV part" },
] as const satisfies ReadonlyArray<{ key: keyof TerminalIdentity; label: string; helper?: string }>;

/** The TV the emulator is: its identity, and the User-Agent header it sends. */
export function DeviceSection() {
  const { device, update } = useDevice();
  const [draft, setDraft] = useState<DeviceProfile>(device);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setDraft(device);
    setIsEditing(false);
  }, [device]);

  const edit = (next: DeviceProfile) => {
    setDraft(next);
    setIsEditing(true);
  };

  const editTerminal = (changes: Partial<TerminalIdentity>) =>
    edit({ ...draft, terminal: { ...draft.terminal, ...changes } });

  const toggleOption = (option: HbbTVOption, enabled: boolean) =>
    editTerminal({
      // In the order of Table 13, as the spec's examples write them.
      options: HBBTV_OPTIONS.filter((o) => (o === option ? enabled : draft.terminal.options.includes(o))),
    });

  const handleSave = pipe(
    TE.of(draft),
    TE.tap((next) => update(next)),
    TE.tapIO(() => () => {
      setIsEditing(false);
    }),
  );

  const handleCancel = () => {
    setDraft(device);
    setIsEditing(false);
  };

  const { terminal } = draft;

  return (
    <Stack gap={2}>
      <Typography variant="h6">Device</Typography>

      <FormControl fullWidth>
        <InputLabel id="device-version-label">HbbTV version</InputLabel>
        <Select
          labelId="device-version-label"
          value={terminal.hbbtvVersion}
          label="HbbTV version"
          onChange={(e) => editTerminal({ hbbtvVersion: e.target.value as HbbTVVersion })}
        >
          {HBBTV_VERSION_MAP.map(({ spec, hbbtv }) => (
            <MenuItem key={hbbtv} value={hbbtv}>
              HbbTV {hbbtv} (TS 102 796 V{spec})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Options (TS 102 796 Table 13)</FormLabel>
        <FormGroup row>
          {HBBTV_OPTIONS.map((option) => (
            <FormControlLabel
              key={option}
              label={option}
              control={
                <Checkbox
                  checked={terminal.options.includes(option)}
                  onChange={(e) => toggleOption(option, e.target.checked)}
                />
              }
            />
          ))}
        </FormGroup>
      </FormControl>

      {IDENTITY_FIELDS.map(({ key, label, ...field }) => {
        const unused = key === "familyName" && !hasFamilyName(terminal.hbbtvVersion);
        return (
          <TextField
            key={key}
            label={label}
            size="small"
            value={terminal[key] ?? ""}
            disabled={unused}
            helperText={
              unused ? "Not in the User-Agent before HbbTV 2.0" : "helper" in field ? field.helper : undefined
            }
            onChange={(e) => editTerminal({ [key]: e.target.value })}
          />
        );
      })}

      <TextField
        label="Own User-Agent header"
        value={draft.userAgent ?? ""}
        fullWidth
        multiline
        minRows={2}
        helperText="Sent verbatim in place of the one the identity gives, for a TV that does not follow the spec. Empty: the identity's."
        onChange={(e) => {
          const { userAgent: _replaced, ...rest } = draft;
          edit(e.target.value === "" ? rest : { ...rest, userAgent: e.target.value });
        }}
      />

      <Stack gap={0.5}>
        <Typography variant="subtitle2">User-Agent</Typography>
        <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
          {deviceUserAgent(draft)}
        </Typography>
      </Stack>

      <Stack direction="row" gap={2}>
        {/* The identity and the header: the capabilities have their own page. */}
        <Button onClick={() => edit({ ...draft, terminal: EMULATOR_TERMINAL, userAgent: undefined })}>
          Reset to the emulator
        </Button>
        {isEditing && (
          <>
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
            <Button variant="outlined" onClick={handleCancel}>
              Cancel
            </Button>
          </>
        )}
      </Stack>
      <Alert severity="warning">
        Applications usually read the User-Agent when they start: reload them to see a change.
      </Alert>
    </Stack>
  );
}
