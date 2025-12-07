import type { OipfConfigurationState } from "@hbb-emu/core";
import { Add } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useAppState, useDispatch, useSideEffects } from "../context/state";

// ISO 639-2/B language codes
const LANGUAGE_OPTIONS = [
  { code: "eng", label: "English" },
  { code: "ita", label: "Italian" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "spa", label: "Spanish" },
  { code: "por", label: "Portuguese" },
  { code: "nld", label: "Dutch" },
  { code: "pol", label: "Polish" },
  { code: "rus", label: "Russian" },
  { code: "ara", label: "Arabic" },
  { code: "zho", label: "Chinese" },
  { code: "jpn", label: "Japanese" },
  { code: "kor", label: "Korean" },
];

// ISO 3166-1 alpha-2 country codes
const COUNTRY_OPTIONS = [
  { code: "IT", label: "Italy" },
  { code: "GB", label: "United Kingdom" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "PT", label: "Portugal" },
  { code: "NL", label: "Netherlands" },
  { code: "PL", label: "Poland" },
  { code: "AT", label: "Austria" },
  { code: "CH", label: "Switzerland" },
  { code: "BE", label: "Belgium" },
  { code: "US", label: "United States" },
];

export default function ConfigurationTab() {
  const { config, isLoading } = useAppState();
  const dispatch = useDispatch();
  const sideEffects = useSideEffects();

  const configuration = config.hbbtv?.oipfConfiguration ?? {};

  const [countryId, setCountryId] = useState(configuration.countryId ?? "IT");
  const [language, setLanguage] = useState(configuration.language ?? "ita");
  const [preferredAudioLanguage, setPreferredAudioLanguage] = useState<string[]>(
    configuration.preferredAudioLanguage ?? ["ita", "eng"],
  );
  const [preferredSubtitleLanguage, setPreferredSubtitleLanguage] = useState<string[]>(
    configuration.preferredSubtitleLanguage ?? ["ita", "eng"],
  );
  const [networkOnline, setNetworkOnline] = useState(configuration.network?.online ?? true);
  const [parentalEnabled, setParentalEnabled] = useState(configuration.parentalControl?.enabled ?? false);
  const [parentalRating, setParentalRating] = useState(configuration.parentalControl?.rating ?? 0);
  const [newAudioLang, setNewAudioLang] = useState("");
  const [newSubtitleLang, setNewSubtitleLang] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const cfg = config.hbbtv?.oipfConfiguration ?? {};
    setCountryId(cfg.countryId ?? "IT");
    setLanguage(cfg.language ?? "ita");
    setPreferredAudioLanguage(cfg.preferredAudioLanguage ?? ["ita", "eng"]);
    setPreferredSubtitleLanguage(cfg.preferredSubtitleLanguage ?? ["ita", "eng"]);
    setNetworkOnline(cfg.network?.online ?? true);
    setParentalEnabled(cfg.parentalControl?.enabled ?? false);
    setParentalRating(cfg.parentalControl?.rating ?? 0);
    setIsEditing(false);
  }, [config.hbbtv?.oipfConfiguration]);

  const handleSave = async () => {
    const newConfiguration: OipfConfigurationState = {
      countryId,
      language,
      preferredAudioLanguage,
      preferredSubtitleLanguage,
      network: {
        ...configuration.network,
        online: networkOnline,
      },
      parentalControl: {
        enabled: parentalEnabled,
        rating: parentalRating,
      },
    };

    const newConfig = {
      ...config,
      hbbtv: {
        ...config.hbbtv,
        oipfConfiguration: newConfiguration,
      },
    };

    dispatch({ type: "SET_CONFIG", payload: newConfig });
    await sideEffects.save(newConfig);
    setIsEditing(false);
  };

  const handleCancel = () => {
    const cfg = config.hbbtv?.oipfConfiguration ?? {};
    setCountryId(cfg.countryId ?? "IT");
    setLanguage(cfg.language ?? "ita");
    setPreferredAudioLanguage(cfg.preferredAudioLanguage ?? ["ita", "eng"]);
    setPreferredSubtitleLanguage(cfg.preferredSubtitleLanguage ?? ["ita", "eng"]);
    setNetworkOnline(cfg.network?.online ?? true);
    setParentalEnabled(cfg.parentalControl?.enabled ?? false);
    setParentalRating(cfg.parentalControl?.rating ?? 0);
    setIsEditing(false);
  };

  const addAudioLang = () => {
    if (newAudioLang && !preferredAudioLanguage.includes(newAudioLang)) {
      setPreferredAudioLanguage([...preferredAudioLanguage, newAudioLang]);
      setNewAudioLang("");
      setIsEditing(true);
    }
  };

  const removeAudioLang = (lang: string) => {
    setPreferredAudioLanguage(preferredAudioLanguage.filter((l) => l !== lang));
    setIsEditing(true);
  };

  const addSubtitleLang = () => {
    if (newSubtitleLang && !preferredSubtitleLanguage.includes(newSubtitleLang)) {
      setPreferredSubtitleLanguage([...preferredSubtitleLanguage, newSubtitleLang]);
      setNewSubtitleLang("");
      setIsEditing(true);
    }
  };

  const removeSubtitleLang = (lang: string) => {
    setPreferredSubtitleLanguage(preferredSubtitleLanguage.filter((l) => l !== lang));
    setIsEditing(true);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        OIPF Configuration
      </Typography>

      <Stack spacing={3} sx={{ mt: 3 }}>
        {/* Country */}
        <FormControl fullWidth>
          <InputLabel>Country</InputLabel>
          <Select
            value={countryId}
            label="Country"
            onChange={(e) => {
              setCountryId(e.target.value);
              setIsEditing(true);
            }}
          >
            {COUNTRY_OPTIONS.map((c) => (
              <MenuItem key={c.code} value={c.code}>
                {c.label} ({c.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Primary Language */}
        <FormControl fullWidth>
          <InputLabel>Primary Language</InputLabel>
          <Select
            value={language}
            label="Primary Language"
            onChange={(e) => {
              setLanguage(e.target.value);
              setIsEditing(true);
            }}
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <MenuItem key={l.code} value={l.code}>
                {l.label} ({l.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Preferred Audio Languages */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Preferred Audio Languages (in order)
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
            {preferredAudioLanguage.map((lang, idx) => (
              <Chip key={lang} label={`${idx + 1}. ${lang}`} onDelete={() => removeAudioLang(lang)} sx={{ mb: 1 }} />
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select value={newAudioLang} displayEmpty onChange={(e) => setNewAudioLang(e.target.value)}>
                <MenuItem value="" disabled>
                  Select language
                </MenuItem>
                {LANGUAGE_OPTIONS.filter((l) => !preferredAudioLanguage.includes(l.code)).map((l) => (
                  <MenuItem key={l.code} value={l.code}>
                    {l.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton onClick={addAudioLang} color="primary" disabled={!newAudioLang}>
              <Add />
            </IconButton>
          </Stack>
        </Box>

        {/* Preferred Subtitle Languages */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Preferred Subtitle Languages (in order)
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
            {preferredSubtitleLanguage.map((lang, idx) => (
              <Chip key={lang} label={`${idx + 1}. ${lang}`} onDelete={() => removeSubtitleLang(lang)} sx={{ mb: 1 }} />
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select value={newSubtitleLang} displayEmpty onChange={(e) => setNewSubtitleLang(e.target.value)}>
                <MenuItem value="" disabled>
                  Select language
                </MenuItem>
                {LANGUAGE_OPTIONS.filter((l) => !preferredSubtitleLanguage.includes(l.code)).map((l) => (
                  <MenuItem key={l.code} value={l.code}>
                    {l.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton onClick={addSubtitleLang} color="primary" disabled={!newSubtitleLang}>
              <Add />
            </IconButton>
          </Stack>
        </Box>

        {/* Network */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Network
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={networkOnline}
                onChange={(e) => {
                  setNetworkOnline(e.target.checked);
                  setIsEditing(true);
                }}
              />
            }
            label="Online"
          />
        </Box>

        {/* Parental Control */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Parental Control
          </Typography>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={parentalEnabled}
                  onChange={(e) => {
                    setParentalEnabled(e.target.checked);
                    setIsEditing(true);
                  }}
                />
              }
              label="Enabled"
            />
            {parentalEnabled && (
              <TextField
                type="number"
                label="Rating Threshold"
                value={parentalRating}
                onChange={(e) => {
                  setParentalRating(parseInt(e.target.value, 10) || 0);
                  setIsEditing(true);
                }}
                inputProps={{ min: 0, max: 18 }}
                sx={{ maxWidth: 200 }}
                helperText="Minimum age rating (0-18)"
              />
            )}
          </Stack>
        </Box>

        {/* Action Buttons */}
        {isEditing && (
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
            <Button variant="outlined" onClick={handleCancel}>
              Cancel
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
