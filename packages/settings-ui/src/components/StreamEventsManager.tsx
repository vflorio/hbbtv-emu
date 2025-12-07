import { type ExtensionConfig, randomUUID } from "@hbb-emu/core";
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";

interface StreamEventsManagerProps {
  open: boolean;
  events: ExtensionConfig.StreamEventConfig[];
  onClose: () => void;
  onSave: (events: ExtensionConfig.StreamEventConfig[]) => void;
}

interface EventFormData extends Omit<ExtensionConfig.StreamEventConfig, "id"> {}

export default function StreamEventsManager({ open, events, onClose, onSave }: StreamEventsManagerProps) {
  const [localEvents, setLocalEvents] = useState<ExtensionConfig.StreamEventConfig[]>(events);
  const [editingEvent, setEditingEvent] = useState<ExtensionConfig.StreamEventConfig | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<EventFormData>({
    name: "",
    eventName: "",
    data: "",
    text: "",
    targetURL: "dvb://current.ait",
    delaySeconds: 10,
    enabled: true,
  });

  const handleAddEvent = () => {
    setEditingEvent(null);
    setFormData({
      name: "",
      eventName: "",
      data: "",
      text: "",
      targetURL: "dvb://current.ait",
      delaySeconds: 10,
      enabled: true,
    });
    setFormOpen(true);
  };

  const handleEditEvent = (event: ExtensionConfig.StreamEventConfig) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      eventName: event.eventName,
      data: event.data,
      text: event.text || "",
      targetURL: event.targetURL || "dvb://current.ait",
      delaySeconds: event.delaySeconds,
      enabled: event.enabled !== false,
    });
    setFormOpen(true);
  };

  const handleDeleteEvent = (id: string) => {
    setLocalEvents((current) => current.filter((ev) => ev.id !== id));
  };

  const handleSaveEvent = () => {
    const eventData: ExtensionConfig.StreamEventConfig = {
      id: editingEvent?.id || randomUUID(),
      ...formData,
    };

    setLocalEvents((current) => {
      const index = current.findIndex((ev) => ev.id === eventData.id);
      if (index >= 0) {
        const updated = [...current];
        updated[index] = eventData;
        return updated;
      }
      return [...current, eventData];
    });

    setFormOpen(false);
  };

  const handleSaveAll = () => {
    onSave(localEvents);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Manage Stream Events</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Configure DSM-CC stream events for this channel
              </Typography>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddEvent}>
                Add Event
              </Button>
            </Box>

            {localEvents.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No stream events configured
              </Typography>
            ) : (
              <List>
                {localEvents.map((event) => (
                  <ListItem
                    key={event.id}
                    secondaryAction={
                      <Box>
                        <Tooltip title="Edit">
                          <IconButton edge="end" onClick={() => handleEditEvent(event)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton edge="end" onClick={() => handleDeleteEvent(event.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={event.name}
                      secondary={`Event: ${event.eventName} | Delay: ${event.delaySeconds}s | ${event.enabled ? "Enabled" : "Disabled"}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSaveAll} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Event Form Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEvent ? "Edit Stream Event" : "New Stream Event"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Event Name (Display)"
              value={formData.name}
              onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="DSM-CC Event Name"
              value={formData.eventName}
              onChange={(event) => setFormData((current) => ({ ...current, eventName: event.target.value }))}
              fullWidth
              required
              helperText="e.g., 'now', 'next', custom event name"
            />
            <TextField
              label="Data Payload"
              value={formData.data}
              onChange={(event) => setFormData((current) => ({ ...current, data: event.target.value }))}
              fullWidth
              required
              multiline
              rows={8}
            />
            <TextField
              label="Delay (seconds)"
              type="number"
              value={formData.delaySeconds}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  delaySeconds: Number.parseInt(event.target.value, 10) || 0,
                }))
              }
              fullWidth
              inputProps={{ min: 0 }}
              helperText="Delay in seconds before this event fires"
            />
            <TextField
              label="Target URL"
              value={formData.targetURL}
              onChange={(event) => setFormData((current) => ({ ...current, targetURL: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Text (optional)"
              value={formData.text}
              onChange={(event) => setFormData((current) => ({ ...current, text: event.target.value }))}
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEvent} variant="contained" color="primary">
            Save Event
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
