import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Send as SendIcon } from "@mui/icons-material";
import {
  Box,
  Button,
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
import { type StreamEventConfig, useConfig } from "../context/config";
import StreamEventForm from "./StreamEventForm";

export default function StreamEventList() {
  const config = useConfig();
  const [events, setEvents] = useState<StreamEventConfig[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<StreamEventConfig | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      const loaded = await config.api.streamEvent.loadStreamEvents();
      setEvents(loaded);
    };
    loadEvents();
  }, [config.api.streamEvent]);

  const handleAddEvent = () => {
    setEditingEvent(null);
    setFormOpen(true);
  };

  const handleEditEvent = (event: StreamEventConfig) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleDeleteEvent = async (id: string) => {
    await config.api.streamEvent.deleteStreamEvent(id);
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  const handleSaveEvent = async (event: StreamEventConfig) => {
    await config.api.streamEvent.saveStreamEvent(event);
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

  const handleDispatchEvent = async (event: StreamEventConfig) => {
    await config.api.streamEvent.dispatchStreamEvent(event);
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Event Name</TableCell>
              <TableCell>Target URL</TableCell>
              <TableCell>Data</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No stream events configured. Click "Add Stream Event" to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id} hover>
                  <TableCell>{event.name}</TableCell>
                  <TableCell>{event.eventName}</TableCell>
                  <TableCell>{event.targetURL}</TableCell>
                  <TableCell>
                    <Tooltip title={event.data}>
                      <Typography
                        sx={{
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {event.data}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Dispatch Event">
                      <IconButton size="small" color="success" onClick={() => handleDispatchEvent(event)}>
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
              ))
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
