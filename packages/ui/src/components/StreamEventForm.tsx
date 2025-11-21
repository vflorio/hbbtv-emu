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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import type { StreamEventConfig } from "../context/config";

interface StreamEventFormProps {
  open: boolean;
  event: StreamEventConfig | null;
  onClose: () => void;
  onSave: (event: StreamEventConfig) => void;
}

export default function StreamEventForm({ open, event, onClose, onSave }: StreamEventFormProps) {
  const [formData, setFormData] = useState<Omit<StreamEventConfig, "id">>({
    name: "",
    targetURL: "dvb://current.ait",
    eventName: "",
    data: "",
    text: "",
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: <need investigate>
  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name,
        targetURL: event.targetURL,
        eventName: event.eventName,
        data: event.data,
        text: event.text,
      });
    } else {
      setFormData({
        name: "",
        targetURL: "dvb://current.ait",
        eventName: "",
        data: "",
        text: "",
      });
    }
  }, [event, open]);

  const handleChange = (field: keyof Omit<StreamEventConfig, "id">) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    const eventData: StreamEventConfig = {
      id: event?.id || crypto.randomUUID(),
      ...formData,
    };
    onSave(eventData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{event ? "Edit Stream Event" : "New Stream Event"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Event Name (UI)"
            value={formData.name}
            onChange={handleChange("name")}
            fullWidth
            required
            helperText="Display name for this event configuration"
          />
          <TextField
            label="DSM-CC Event Name"
            value={formData.eventName}
            onChange={handleChange("eventName")}
            fullWidth
            required
            helperText="The actual stream event name (e.g., 'now', 'next')"
          />
          <TextField
            label="Data"
            value={formData.data}
            onChange={handleChange("data")}
            fullWidth
            required
            multiline
            rows={2}
            helperText="Event data payload"
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
                  helperText="Target URL for the stream event"
                />
                <TextField
                  label="Text"
                  value={formData.text}
                  onChange={handleChange("text")}
                  fullWidth
                  multiline
                  rows={2}
                  helperText="Optional text data"
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
