import { hexToText, isValidHex, randomUUID, textToHex } from "@hbb-emu/core";
import type { ChannelConfig, StreamEventConfig, StreamEventScheduleMode } from "@hbb-emu/extension-common";
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  AppBar,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppState } from "../context/state";
import { useChannelActions } from "../hooks/useChannelActions";

interface EventFormData extends Omit<StreamEventConfig, "id"> {}

const defaultEventFormData: EventFormData = {
  label: "",
  status: "trigger",
  eventName: "",
  data: "",
  text: "",
  targetURL: "dvb://current.ait",
  scheduleMode: "delay",
  delaySeconds: 10,
  atSeconds: 0,
  intervalSeconds: 10,
  offsetSeconds: 0,
  enabled: true,
};

export default function StreamEventsEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    config: { channels },
  } = useAppState();
  const { upsert } = useChannelActions();
  const [events, setEvents] = useState<StreamEventConfig[]>([]);
  const [editingEvent, setEditingEvent] = useState<StreamEventConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<EventFormData>(defaultEventFormData);

  const channel = useMemo(() => channels.find((ch) => ch.id === id), [channels, id]);

  useEffect(() => {
    if (!channel) return;
    setEvents(channel.streamEvents || []);
  }, [channel]);

  const handleAddEvent = () => {
    setEditingEvent(null);
    setFormData(defaultEventFormData);
    setShowForm(true);
  };

  const handleEditEvent = (event: StreamEventConfig) => {
    setEditingEvent(event);
    setFormData({
      label: event.label ?? "",
      eventName: event.eventName,
      data: event.data,
      text: event.text || "",
      status: event.status || "trigger",
      targetURL: event.targetURL || "dvb://current.ait",
      scheduleMode: (event.scheduleMode as StreamEventScheduleMode | undefined) ?? "delay",
      delaySeconds: event.delaySeconds ?? 0,
      atSeconds: event.atSeconds ?? 0,
      intervalSeconds: event.intervalSeconds ?? 10,
      offsetSeconds: event.offsetSeconds ?? 0,
      enabled: event.enabled !== false,
    });
    setShowForm(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
  };

  const handleSaveEvent = () => {
    const eventData: StreamEventConfig = {
      id: editingEvent?.id || randomUUID(),
      ...formData,
    };

    setEvents((prev) => {
      const index = prev.findIndex((ev) => ev.id === eventData.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = eventData;
        return updated;
      }
      return [...prev, eventData];
    });

    setShowForm(false);
  };

  const handleSaveAll = async () => {
    if (channel) {
      const updatedChannel: ChannelConfig = {
        ...channel,
        streamEvents: events,
      };
      await upsert(updatedChannel);
      navigate(`/channel/${id}`);
    }
  };

  if (!channel) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (showForm) {
    return (
      <Box>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar variant="dense">
            <IconButton edge="start" onClick={() => setShowForm(false)}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
              {editingEvent ? "Edit Stream Event" : "New Stream Event"}
            </Typography>
            <Button variant="contained" onClick={handleSaveEvent}>
              Save
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 2 }}>
          <Stack gap={2}>
            <TextField
              label="Label"
              value={formData.label}
              onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
              fullWidth
              helperText="Shown in the settings list (optional)"
            />

            <FormControl fullWidth>
              <InputLabel id="event-schedule-mode-label">Scheduling Mode</InputLabel>
              <Select
                labelId="event-schedule-mode-label"
                label="Scheduling Mode"
                value={(formData.scheduleMode as StreamEventScheduleMode | undefined) ?? "delay"}
                onChange={(e) => {
                  const mode = e.target.value as StreamEventScheduleMode;
                  setFormData((prev) => ({ ...prev, scheduleMode: mode }));
                }}
              >
                <MenuItem value="timestamps">Manual timestamps</MenuItem>
                <MenuItem value="interval">Fixed interval</MenuItem>
                <MenuItem value="delay">Delay from cycle start</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="DSM-CC Event Name"
              value={formData.eventName}
              onChange={(e) => setFormData((prev) => ({ ...prev, eventName: e.target.value }))}
              fullWidth
              required
              helperText="e.g., 'now', 'next', custom event name"
            />
            <TextField
              label="Text Payload (UTF-8)"
              value={formData.text}
              onChange={(e) => {
                const newText = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  text: newText,
                  data: textToHex(newText),
                }));
              }}
              fullWidth
              multiline
              rows={4}
              helperText="UTF-8 text payload. Editing this will update the hex data automatically."
            />
            <TextField
              label="Data Payload (Hexadecimal)"
              value={formData.data}
              onChange={(e) => {
                const newData = e.target.value.toUpperCase();
                setFormData((prev) => ({
                  ...prev,
                  data: newData,
                  text: isValidHex(newData) ? hexToText(newData) : prev.text,
                }));
              }}
              fullWidth
              multiline
              rows={2}
              error={formData.data.length > 0 && !isValidHex(formData.data)}
              helperText={
                formData.data.length > 0 && !isValidHex(formData.data)
                  ? "Invalid hexadecimal format"
                  : "Hex-encoded payload. Editing this will update the text automatically."
              }
            />
            {formData.scheduleMode === "timestamps" && (
              <TextField
                label="Timestamp (seconds from start)"
                type="number"
                value={formData.atSeconds}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    atSeconds: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
                fullWidth
                inputProps={{ min: 0 }}
                helperText="Absolute time from start of the cycle"
              />
            )}

            {formData.scheduleMode === "delay" && (
              <TextField
                label="Delay (seconds)"
                type="number"
                value={formData.delaySeconds}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    delaySeconds: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
                fullWidth
                inputProps={{ min: 0 }}
                helperText="Delay in seconds before this event fires (relative)"
              />
            )}

            {formData.scheduleMode === "interval" && (
              <Stack gap={2}>
                <TextField
                  label="Interval (seconds)"
                  type="number"
                  value={formData.intervalSeconds ?? 10}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      intervalSeconds: Number.parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  fullWidth
                  inputProps={{ min: 1 }}
                  helperText="Event fires every N seconds"
                />
                <TextField
                  label="Offset (seconds)"
                  type="number"
                  value={formData.offsetSeconds ?? 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      offsetSeconds: Number.parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  fullWidth
                  inputProps={{ min: 0 }}
                  helperText="Optional delay before the interval starts"
                />
              </Stack>
            )}
            <TextField
              label="Target URL"
              value={formData.targetURL}
              onChange={(e) => setFormData((prev) => ({ ...prev, targetURL: e.target.value }))}
              fullWidth
            />
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <IconButton edge="start" onClick={() => navigate(`/channel/${id}`)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            Stream Events
          </Typography>
          <Button variant="contained" onClick={handleSaveAll} sx={{ mr: 1 }}>
            Save
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Channel: {channel.name}
          </Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddEvent}>
            Add Event
          </Button>
        </Box>

        {events.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            No stream events configured
          </Typography>
        ) : (
          <List>
            {events.map((event) => (
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
                  primary={event.label?.trim() ? event.label : event.eventName}
                  secondary={(() => {
                    const mode = (event.scheduleMode as StreamEventScheduleMode | undefined) ?? "delay";
                    if (mode === "timestamps")
                      return `At: ${event.atSeconds ?? 0}s | ${event.enabled ? "Enabled" : "Disabled"}`;
                    if (mode === "interval")
                      return `Every: ${event.intervalSeconds ?? 10}s (+${event.offsetSeconds ?? 0}s) | ${event.enabled ? "Enabled" : "Disabled"}`;
                    return `Delay: ${event.delaySeconds ?? 0}s | ${event.enabled ? "Enabled" : "Disabled"}`;
                  })()}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
