import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
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
import type { StreamEventConfig } from "../context/config";

interface StreamEventsManagerProps {
  open: boolean;
  events: StreamEventConfig[];
  onClose: () => void;
  onSave: (events: StreamEventConfig[]) => void;
}

interface EventFormData extends Omit<StreamEventConfig, "id"> {}

export default function StreamEventsManager({
  open,
  events,
  onClose,
  onSave,
}: StreamEventsManagerProps) {
  const [localEvents, setLocalEvents] = useState<StreamEventConfig[]>(events);
  const [editingEvent, setEditingEvent] = useState<StreamEventConfig | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<EventFormData>({
    name: "",
    eventName: "",
    data: "",
    text: "",
    targetURL: "dvb://current.ait",
    cronSchedule: "*/5 * * * *",
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
      cronSchedule: "*/5 * * * *",
      enabled: true,
    });
    setFormOpen(true);
  };

  const handleEditEvent = (event: StreamEventConfig) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      eventName: event.eventName,
      data: event.data,
      text: event.text || "",
      targetURL: event.targetURL || "dvb://current.ait",
      cronSchedule: event.cronSchedule || "*/5 * * * *",
      enabled: event.enabled !== false,
    });
    setFormOpen(true);
  };

  const handleDeleteEvent = (id: string) => {
    setLocalEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  const handleSaveEvent = () => {
    const eventData: StreamEventConfig = {
      id: editingEvent?.id || crypto.randomUUID(),
      ...formData,
    };

    setLocalEvents((prev) => {
      const index = prev.findIndex((ev) => ev.id === eventData.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = eventData;
        return updated;
      }
      return [...prev, eventData];
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
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddEvent}
              >
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
                          <IconButton
                            edge="end"
                            onClick={() => handleEditEvent(event)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            edge="end"
                            onClick={() => handleDeleteEvent(event.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={event.name}
                      secondary={`Event: ${event.eventName} | Schedule: ${event.cronSchedule || "Manual"} | ${event.enabled ? "Enabled" : "Disabled"}`}
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
        <DialogTitle>
          {editingEvent ? "Edit Stream Event" : "New Stream Event"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Event Name (Display)"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              fullWidth
              required
            />
            <TextField
              label="DSM-CC Event Name"
              value={formData.eventName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, eventName: e.target.value }))
              }
              fullWidth
              required
              helperText="e.g., 'now', 'next', custom event name"
            />
            <TextField
              label="Data Payload"
              value={formData.data}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, data: e.target.value }))
              }
              fullWidth
              required
              multiline
              rows={2}
            />
            <TextField
              label="Cron Schedule"
              value={formData.cronSchedule}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  cronSchedule: e.target.value,
                }))
              }
              fullWidth
              helperText="Cron expression (e.g., '*/5 * * * *' = every 5 minutes)"
            />
            <TextField
              label="Target URL"
              value={formData.targetURL}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, targetURL: e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Text (optional)"
              value={formData.text}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, text: e.target.value }))
              }
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
