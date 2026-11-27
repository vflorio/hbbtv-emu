import {
  type DeviceCapabilities,
  type DeviceMedia,
  type DrmSystem,
  deviceXmlCapabilities,
  HBBTV_VERSION_MAP,
  HEVC_HD_SUPPORT,
  type HevcHdSupport,
  xmlCapabilitiesNamespace,
} from "@hbb-emu/oipf-api";
import { Add } from "@mui/icons-material";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
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
import Panel from "../components/Panel";
import { useAppState, useCapabilities, useDevice } from "../hooks";

const words = (text: string): string[] => text.split(/\s+/).filter((word) => word !== "");

const drmLabel = (drm: DrmSystem): string =>
  [
    drm.systemId,
    drm.formats.length > 0 ? drm.formats.join(" ") : null,
    drm.protectionGateways?.length ? `(${drm.protectionGateways.join(" ")})` : null,
  ]
    .filter((part) => part !== null)
    .join(" — ");

export default function CapabilitiesTab() {
  const { isLoading } = useAppState();
  const { capabilities, update } = useCapabilities();
  const { device } = useDevice();
  const { hbbtvVersion } = device.terminal;
  const specVersion = HBBTV_VERSION_MAP.find((entry) => entry.hbbtv === hbbtvVersion)?.spec;
  const hasHevc = xmlCapabilitiesNamespace(hbbtvVersion) !== null;
  const [draft, setDraft] = useState<DeviceCapabilities>(capabilities);
  const [newProfile, setNewProfile] = useState("");
  const [newDrm, setNewDrm] = useState({ systemId: "", formats: "", protectionGateways: "" });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setDraft(capabilities);
    setIsEditing(false);
  }, [capabilities]);

  const edit = (next: Partial<DeviceCapabilities>) => {
    setDraft({ ...draft, ...next });
    setIsEditing(true);
  };

  const editMedia = (next: Partial<DeviceMedia>) => edit({ media: { ...draft.media, ...next } });

  const handleSave = pipe(
    TE.of<unknown, DeviceCapabilities>(draft),
    TE.tap((next) => update(next)),
    TE.tapIO(() => () => {
      setIsEditing(false);
    }),
  );

  const handleCancel = () => {
    setDraft(capabilities);
    setIsEditing(false);
  };

  const addProfile = () => {
    if (newProfile && !draft.uiProfiles.includes(newProfile)) {
      edit({ uiProfiles: [...draft.uiProfiles, newProfile] });
      setNewProfile("");
    }
  };

  const addDrm = () => {
    const systemId = newDrm.systemId.trim();
    if (systemId === "" || draft.drm.some((drm) => drm.systemId === systemId)) return;
    const gateways = words(newDrm.protectionGateways);
    const drm: DrmSystem = {
      systemId,
      formats: words(newDrm.formats),
      ...(gateways.length > 0 ? { protectionGateways: gateways } : {}),
    };
    edit({ drm: [...draft.drm, drm] });
    setNewDrm({ systemId: "", formats: "", protectionGateways: "" });
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  return (
    <Panel
      title="Capabilities"
      actions={
        isEditing && (
          <Stack direction="row" gap={2}>
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
            <Button variant="outlined" onClick={handleCancel}>
              Cancel
            </Button>
          </Stack>
        )
      }
    >
      {/* HbbTV Version: the device's */}
      <Box>
        <Typography variant="subtitle1">Version</Typography>
        <Typography>
          HbbTV {hbbtvVersion} (TS 102 796 V{specVersion})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The device's: change it in Common → Device. The XML capabilities follow its edition.
        </Typography>
      </Box>

      {/* UI Profiles */}
      <Box>
        <Typography variant="subtitle1">UI Profile</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          A base profile (OITF_HD_UIPROF, OITF_FULL_HD_UIPROF, …) and name fragments (OIPF DAE §9.2): hasCapability()
          answers them, and the device's option strings ({device.terminal.options.join(" ") || "none"}).
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
          {draft.uiProfiles.map((profile) => (
            <Chip
              key={profile}
              label={profile}
              onDelete={() => edit({ uiProfiles: draft.uiProfiles.filter((p) => p !== profile) })}
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>
        <Stack direction="row" gap={1}>
          <TextField
            size="small"
            value={newProfile}
            onChange={(e) => setNewProfile(e.target.value)}
            placeholder="OITF_HD_UIPROF, +TRICKMODE, +DVB_T, etc."
            onKeyDown={(e) => e.key === "Enter" && addProfile()}
          />
          <IconButton onClick={addProfile} color="primary">
            <Add />
          </IconButton>
        </Stack>
      </Box>

      {/* Media beyond the base level (TS 102 796 §10.2.4.7) */}
      <Box>
        <Typography variant="subtitle1">Media</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Beyond the base level (AVC with HE-AAC, TS 102 796 §10.2.4.7): each adds its audio and video profiles.
        </Typography>
        <Stack gap={1}>
          <FormControlLabel
            label="E-AC3 audio (Table 9)"
            control={<Checkbox checked={draft.media.eac3} onChange={(e) => editMedia({ eac3: e.target.checked })} />}
          />
          <FormControl size="small" sx={{ maxWidth: 240 }} disabled={!hasHevc}>
            <InputLabel id="hevc-hd-label">HEVC HD video</InputLabel>
            <Select
              labelId="hevc-hd-label"
              label="HEVC HD video"
              value={draft.media.hevcHd}
              onChange={(e) => editMedia({ hevcHd: e.target.value as HevcHdSupport })}
            >
              {HEVC_HD_SUPPORT.map((support) => (
                <MenuItem key={support} value={support}>
                  {support === "none" ? "None" : support}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            label="HEVC UHD video"
            disabled={!hasHevc}
            control={
              <Checkbox checked={draft.media.hevcUhd} onChange={(e) => editMedia({ hevcUhd: e.target.checked })} />
            }
          />
          {!hasHevc && (
            <Typography variant="body2" color="text.secondary">
              HbbTV {hbbtvVersion} has no HEVC profiles.
            </Typography>
          )}
        </Stack>
      </Box>

      {/* DRM Systems: <drm> elements (OIPF DAE §9.3.10) */}
      <Box>
        <Typography variant="subtitle1">DRM Systems</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          A &lt;drm&gt; element each (OIPF DAE §9.3.10): the DVB CA system id, its protected formats (TS_PF, MP4_PDCF,
          …) and the gateways that support it (ci+ for a CICAM). The emulator has no DRM agent.
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
          {draft.drm.map((drm) => (
            <Chip
              key={drm.systemId}
              label={drmLabel(drm)}
              onDelete={() => edit({ drm: draft.drm.filter((d) => d.systemId !== drm.systemId) })}
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <TextField
            size="small"
            label="System id"
            value={newDrm.systemId}
            onChange={(e) => setNewDrm({ ...newDrm, systemId: e.target.value })}
            placeholder="urn:dvb:casystemid:19188"
            onKeyDown={(e) => e.key === "Enter" && addDrm()}
          />
          <TextField
            size="small"
            label="Formats"
            value={newDrm.formats}
            onChange={(e) => setNewDrm({ ...newDrm, formats: e.target.value })}
            placeholder="TS_PF MP4_PDCF"
            onKeyDown={(e) => e.key === "Enter" && addDrm()}
          />
          <TextField
            size="small"
            label="Gateways"
            value={newDrm.protectionGateways}
            onChange={(e) => setNewDrm({ ...newDrm, protectionGateways: e.target.value })}
            placeholder="ci+"
            onKeyDown={(e) => e.key === "Enter" && addDrm()}
          />
          <IconButton onClick={addDrm} color="primary">
            <Add />
          </IconButton>
        </Stack>
      </Box>

      {/* What applications read */}
      <Box>
        <Typography variant="subtitle1">xmlCapabilities</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          The document applications read (TS 102 796 §10.2.4), without the indentation.
        </Typography>
        <Box
          component="pre"
          sx={{ fontFamily: "monospace", fontSize: 12, overflowX: "auto", m: 0, p: 1, bgcolor: "action.hover" }}
        >
          {deviceXmlCapabilities({ ...device, capabilities: draft }, "  ")}
        </Box>
      </Box>
    </Panel>
  );
}
