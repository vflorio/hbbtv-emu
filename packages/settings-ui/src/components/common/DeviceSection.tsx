import {
  BROWSER_ENGINES,
  type BrowserEngine,
  type DeviceKeys,
  type DeviceNavigator,
  type DeviceProfile,
  deviceKeys,
  deviceNavigator,
  deviceUserAgent,
  EMULATOR_TERMINAL,
  EXTRA_KEY_GROUPS,
  type ExtraKeyGroup,
  engineOfUserAgent,
  HBBTV_OPTIONS,
  HBBTV_VERSION_MAP,
  type HbbTVOption,
  type HbbTVVersion,
  hasFamilyName,
  NAVIGATOR_PROPERTIES,
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

/** The keys outside Table 12 a TV may give the applications, by Keyset constant. */
const EXTRA_KEY_LABELS: Readonly<Record<ExtraKeyGroup, string>> = {
  INFO: "INFO (VK_INFO)",
  SCROLL: "Page up/down (VK_PAGE_UP, VK_PAGE_DOWN)",
};

const ENGINE_LABELS: Readonly<Record<BrowserEngine, string>> = { blink: "Blink", webkit: "WebKit", gecko: "Gecko" };

/** A property of the TV's navigator as the preview shows it. */
const navigatorValue = (value: string | number | null | undefined): string =>
  value === undefined ? "(the browser's)" : value === null ? "(none)" : JSON.stringify(value);

/** The TV the emulator is: its identity, the User-Agent header it sends, its browser and its remote. */
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

  /** One property of the navigator: `undefined` leaves it to the browser. */
  const editNavigator = (changes: Partial<DeviceNavigator>) => {
    const next: Record<string, unknown> = { ...draft.navigator, ...changes };
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    const { navigator: _replaced, ...rest } = draft;
    edit(Object.keys(next).length === 0 ? rest : { ...rest, navigator: next as DeviceNavigator });
  };

  const editKeys = (changes: Partial<DeviceKeys>) => edit({ ...draft, keys: { ...deviceKeys(draft), ...changes } });

  const toggleExtraKeys = (group: ExtraKeyGroup, enabled: boolean) =>
    editKeys({
      extra: EXTRA_KEY_GROUPS.filter((g) => (g === group ? enabled : deviceKeys(draft).extra.includes(g))),
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
  const keys = deviceKeys(draft);
  const browser = draft.navigator ?? {};
  const uaEngine = engineOfUserAgent(deviceUserAgent(draft));
  const navigatorPreview = deviceNavigator(draft);

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

      <FormControl>
        <FormLabel>Browser (navigator)</FormLabel>
        <Typography variant="caption" color="text.secondary">
          What the page's navigator says beyond the User-Agent. Left empty: the browser the emulator runs in.
        </Typography>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel id="device-engine-label">Engine</InputLabel>
        <Select
          labelId="device-engine-label"
          value={browser.engine ?? ""}
          label="Engine"
          displayEmpty
          onChange={(e) => editNavigator({ engine: (e.target.value || undefined) as BrowserEngine | undefined })}
        >
          <MenuItem value="">From the User-Agent: {uaEngine ? ENGINE_LABELS[uaEngine] : "none"}</MenuItem>
          {BROWSER_ENGINES.map((engine) => (
            <MenuItem key={engine} value={engine}>
              {ENGINE_LABELS[engine]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Platform"
        size="small"
        value={browser.platform ?? ""}
        placeholder="Linux armv7l"
        helperText="navigator.platform: Linux and the machine, as uname gives it"
        onChange={(e) => editNavigator({ platform: e.target.value === "" ? undefined : e.target.value })}
      />

      <Stack direction="row" gap={2} alignItems="center">
        <TextField
          label="CPU cores"
          size="small"
          type="number"
          value={typeof browser.hardwareConcurrency === "number" ? browser.hardwareConcurrency : ""}
          disabled={browser.hardwareConcurrency === null}
          helperText="navigator.hardwareConcurrency"
          inputProps={{ min: 1 }}
          onChange={(e) => {
            const cores = Number.parseInt(e.target.value, 10);
            editNavigator({ hardwareConcurrency: Number.isNaN(cores) || cores < 1 ? undefined : cores });
          }}
        />
        <FormControlLabel
          label="The engine has none"
          control={
            <Checkbox
              checked={browser.hardwareConcurrency === null}
              onChange={(e) => editNavigator({ hardwareConcurrency: e.target.checked ? null : undefined })}
            />
          }
        />
      </Stack>

      <Stack gap={0.5}>
        <Typography variant="subtitle2">navigator</Typography>
        <Typography
          component="pre"
          variant="body2"
          sx={{ fontFamily: "monospace", wordBreak: "break-all", whiteSpace: "pre-wrap", m: 0 }}
        >
          {NAVIGATOR_PROPERTIES.filter((name) => name !== "userAgent" && name !== "appVersion")
            .map((name) => `${name}: ${navigatorValue(navigatorPreview[name])}`)
            .join("\n")}
        </Typography>
      </Stack>

      <FormControl>
        <FormLabel>Remote control (TS 102 796 §10.2.2.1)</FormLabel>
        <Typography variant="caption" color="text.secondary">
          A TV that follows the spec gives applications only the keys of Table 12 they ask for. Many do more.
        </Typography>
        <FormGroup>
          {EXTRA_KEY_GROUPS.map((group) => (
            <FormControlLabel
              key={group}
              label={`Gives ${EXTRA_KEY_LABELS[group]}`}
              control={
                <Checkbox
                  checked={keys.extra.includes(group)}
                  onChange={(e) => toggleExtraKeys(group, e.target.checked)}
                />
              }
            />
          ))}
          <FormControlLabel
            label="Delivers the keys the application's keyset does not ask for"
            control={
              <Checkbox
                checked={keys.deliversUnrequested}
                onChange={(e) => editKeys({ deliversUnrequested: e.target.checked })}
              />
            }
          />
        </FormGroup>
      </FormControl>

      <Stack direction="row" gap={2}>
        {/* The identity, the header, the browser and the remote: the capabilities have their own page. */}
        <Button
          onClick={() => {
            const { keys: _spec, navigator: _browser, ...rest } = draft;
            edit({ ...rest, terminal: EMULATOR_TERMINAL, userAgent: undefined });
          }}
        >
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
