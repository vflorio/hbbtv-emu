import { randomUUID } from "@hbb-emu/core";
import type { StreamEventConfig } from "@hbb-emu/extension-common";
import { Add, ExpandMore } from "@mui/icons-material";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Stack, Typography } from "@mui/material";
import { StreamEventItem } from "./StreamEventItem";

interface StreamEventsListProps {
  streamEvents: StreamEventConfig[];
  defaultMode?: "display" | "edit";
  onChange?: (events: StreamEventConfig[]) => void;
}

const defaultStreamEvent: Omit<StreamEventConfig, "id"> = {
  label: "New Event",
  enabled: true,
  eventName: "default",
  data: "",
  text: "",
  targetURL: "dvb://current.ait",
  status: "trigger",
  scheduleMode: "delay",
  delaySeconds: 10,
};

export function StreamEventsList({ streamEvents, defaultMode, onChange }: StreamEventsListProps) {
  const isLocked = defaultMode !== undefined;
  const handleAddEvent = () => {
    const newEvent: StreamEventConfig = {
      id: randomUUID(),
      ...defaultStreamEvent,
    };
    onChange?.([...streamEvents, newEvent]);
  };

  const handleDeleteEvent = (id: string) => {
    onChange?.(streamEvents.filter((e) => e.id !== id));
  };

  const handleSaveEvent = (updated: StreamEventConfig) => {
    onChange?.(streamEvents.map((e) => (e.id === updated.id ? updated : e)));
  };

  return (
    <Accordion elevation={2} defaultExpanded={streamEvents.length > 0}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Stack direction="row" alignItems="center" gap={2}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Stream Events (DSM-CC)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {streamEvents.length} event{streamEvents.length !== 1 ? "s" : ""}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack gap={2} onClick={(e) => e.stopPropagation()}>
          {streamEvents.length === 0 ? (
            <Box sx={{ py: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No stream events configured
              </Typography>
            </Box>
          ) : (
            <Stack gap={1}>
              {streamEvents.map((event) => (
                <StreamEventItem
                  key={event.id}
                  event={event}
                  defaultMode={defaultMode}
                  onDelete={() => handleDeleteEvent(event.id)}
                  onSave={handleSaveEvent}
                />
              ))}
            </Stack>
          )}

          {!isLocked && (
            <Button variant="outlined" size="small" startIcon={<Add />} onClick={handleAddEvent} fullWidth>
              Add Stream Event
            </Button>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
