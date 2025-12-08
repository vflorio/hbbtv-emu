import { randomUUID, type StreamEventConfig } from "@hbb-emu/core";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

interface StreamEventFormProps {
  open: boolean;
  event: StreamEventConfig | null;
  onClose: () => void;
  onSave: (event: StreamEventConfig) => void;
}

export default function StreamEventForm({ open, event, onClose, onSave }: StreamEventFormProps) {
  const [formData, setFormData] = useState<Omit<StreamEventConfig, "id">>({
    eventName: "",
    data: "",
    delaySeconds: 10,
    targetURL: "dvb://current.ait",
    text: "",
    enabled: true,
    status: "trigger",
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: <need investigate>
  useEffect(() => {
    if (event) {
      setFormData({
        eventName: event.eventName,
        data: event.data,
        delaySeconds: event.delaySeconds,
        targetURL: event.targetURL ?? "dvb://current.ait",
        text: event.text ?? "",
        status: event.status ?? "trigger",
        enabled: event.enabled ?? true,
      });
    } else {
      setFormData({
        eventName: "",
        data: "",
        delaySeconds: 10,
        targetURL: "dvb://current.ait",
        text: "",
        status: "trigger",
        enabled: true,
      });
    }
  }, [event, open]);

  const handleChange = (field: keyof Omit<StreamEventConfig, "id">) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === "delaySeconds" ? Number.parseInt(e.target.value, 10) || 0 : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggleEnabled = () => {
    setFormData((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleSubmit = () => {
    const eventData: StreamEventConfig = {
      id: event?.id || randomUUID(),
      eventName: formData.eventName,
      data: formData.data,
      delaySeconds: formData.delaySeconds,
      targetURL: formData.targetURL,
      text: formData.text,
      status: formData.status,
      enabled: formData.enabled,
    };
    onSave(eventData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{event ? "Edit Stream Event" : "New Stream Event"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControlLabel
            control={<Switch checked={formData.enabled} onChange={handleToggleEnabled} />}
            label="Enabled"
          />
          <TextField
            label="DSM-CC Event Name"
            value={formData.eventName}
            onChange={handleChange("eventName")}
            fullWidth
            required
            helperText="The actual stream event name (e.g., 'PREP', 'GO', 'END')"
          />
          <TextField
            label="Delay (seconds)"
            type="number"
            value={formData.delaySeconds}
            onChange={handleChange("delaySeconds")}
            fullWidth
            required
            inputProps={{ min: 0 }}
            helperText="Delay in seconds before this event fires (relative to previous event in sequence)"
          />
          <TextField
            label="Data (hex)"
            value={formData.data}
            onChange={handleChange("data")}
            fullWidth
            required
            multiline
            rows={2}
            helperText="Event data payload in hexadecimal format"
          />

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Advanced Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField
                  label="Target URL"
                  value={formData.targetURL}
                  onChange={handleChange("targetURL")}
                  fullWidth
                  helperText="Target URL for the stream event (e.g., 'dvb://current.ait')"
                />
                <TextField
                  label="Text"
                  value={formData.text}
                  onChange={handleChange("text")}
                  fullWidth
                  multiline
                  rows={2}
                  helperText="Optional text data (human-readable version of data)"
                />
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
