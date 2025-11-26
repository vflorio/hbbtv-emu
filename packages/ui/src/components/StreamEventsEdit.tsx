import type { ExtensionConfig } from "@hbb-emu/lib";
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  AppBar,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useConfig } from "../context/config";

interface EventFormData extends Omit<ExtensionConfig.StreamEvent, "id"> {}

export default function StreamEventsEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { api } = useConfig();
  const [channel, setChannel] = useState<ExtensionConfig.Channel | null>(null);
  const [events, setEvents] = useState<ExtensionConfig.StreamEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<ExtensionConfig.StreamEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<EventFormData>({
    name: "",
    eventName: "",
    data: "",
    text: "",
    targetURL: "dvb://current.ait",
    cronSchedule: "*/5 * * * *",
    enabled: true,
  });

  useEffect(() => {
    if (id) {
      api.channel.load().then((channels) => {
        const ch = channels.find((c) => c.id === id);
        if (ch) {
          setChannel(ch);
          setEvents(ch.streamEvents || []);
        }
      });
    }
  }, [id, api.channel]);

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
    setShowForm(true);
  };

  const handleEditEvent = (event: ExtensionConfig.StreamEvent) => {
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
    setShowForm(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
  };

  const handleSaveEvent = () => {
    const eventData: ExtensionConfig.StreamEvent = {
      id: editingEvent?.id || crypto.randomUUID(),
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
      const updatedChannel: ExtensionConfig.Channel = {
        ...channel,
        streamEvents: events,
      };
      await api.channel.save(updatedChannel);
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
          <Stack spacing={2}>
            <TextField
              label="Event Name (Display)"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="DSM-CC Event Name"
              value={formData.eventName}
              onChange={(e) => setFormData((prev) => ({ ...prev, eventName: e.target.value }))}
              fullWidth
              required
              helperText="e.g., 'now', 'next', custom event name"
            />
            <TextField
              label="Data Payload"
              value={formData.data}
              onChange={(e) => setFormData((prev) => ({ ...prev, data: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, targetURL: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Text (optional)"
              value={formData.text}
              onChange={(e) => setFormData((prev) => ({ ...prev, text: e.target.value }))}
              fullWidth
              multiline
              rows={2}
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
                  primary={event.name}
                  secondary={`Event: ${event.eventName} | Schedule: ${event.cronSchedule || "Manual"} | ${event.enabled ? "Enabled" : "Disabled"}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
