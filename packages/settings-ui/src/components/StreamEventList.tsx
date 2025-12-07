import { createLogger, type StreamEventConfig } from "@hbb-emu/core";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Send as SendIcon,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useConfig } from "../context/config";
import StreamEventForm from "./StreamEventForm";

const logger = createLogger("StreamEventList");

export default function StreamEventList() {
  const { channel } = useConfig();
  const [events, setEvents] = useState<StreamEventConfig[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<StreamEventConfig | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      const loaded = await channel.streamEvent.load();
      setEvents(loaded);
    };
    loadEvents();
  }, [channel.streamEvent]);

  const handleAddEvent = () => {
    setEditingEvent(null);
    setFormOpen(true);
  };

  const handleEditEvent = (event: StreamEventConfig) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleDeleteEvent = async (id: string) => {
    await channel.streamEvent.remove(id);
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  const handleSaveEvent = async (event: StreamEventConfig) => {
    await channel.streamEvent.upsert(event);
    setEvents((prev) => {
      const index = prev.findIndex((ev) => ev.id === event.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = event;
        return updated;
      }
      return [...prev, event];
    });
  };

  const handleToggleEnabled = async (event: StreamEventConfig) => {
    const updated = { ...event, enabled: !(event.enabled ?? true) };
    await handleSaveEvent(updated);
  };

  const handleDispatchEvent = async (event: StreamEventConfig) => {
    logger.info("TODO Dispatching stream event:", event);
  };

  const formatDelay = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h5" component="h2">
          DSM-CC Stream Events
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddEvent}>
          Add Stream Event
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Events are dispatched in sequence with the specified delay between each event. After the last event, the cycle
        repeats.
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={60}>#</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Event Name</TableCell>
              <TableCell>Delay</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No stream events configured. Click "Add Stream Event" to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              events.map((event, index) => {
                const isEnabled = event.enabled ?? true;
                return (
                  <TableRow key={event.id} hover sx={{ opacity: isEnabled ? 1 : 0.5 }}>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {index + 1}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="medium">{event.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {event.targetURL}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={event.eventName} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDelay(event.delaySeconds)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={isEnabled ? "Enabled" : "Disabled"}
                        size="small"
                        color={isEnabled ? "success" : "default"}
                        variant={isEnabled ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={isEnabled ? "Disable" : "Enable"}>
                        <IconButton size="small" onClick={() => handleToggleEnabled(event)}>
                          {isEnabled ? <PauseIcon /> : <PlayIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dispatch Event">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleDispatchEvent(event)}
                          disabled={!isEnabled}
                        >
                          <SendIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" color="primary" onClick={() => handleEditEvent(event)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteEvent(event.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <StreamEventForm
        open={formOpen}
        event={editingEvent}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveEvent}
      />
    </Box>
  );
}
