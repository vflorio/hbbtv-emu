import { hexToText, isValidHex, textToHex } from "@hbb-emu/core";
import type { StreamEventConfig, StreamEventScheduleMode } from "@hbb-emu/extension-common";
import { Delete, Edit, ExpandMore, Save } from "@mui/icons-material";
import {
  Accordion,
  AccordionActions,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { StreamEventData } from "./StreamEventData";
import { StreamEventIdentification } from "./StreamEventIdentification";
import { StreamEventScheduling } from "./StreamEventScheduling";

interface StreamEventItemProps {
  event: StreamEventConfig;
  defaultMode?: "display" | "edit";
  onDelete?: () => void;
  onSave?: (event: StreamEventConfig) => void;
}

export function StreamEventItem({ event, defaultMode, onDelete, onSave }: StreamEventItemProps) {
  const isLocked = defaultMode !== undefined;
  const [mode, setMode] = useState<"display" | "edit">(defaultMode ?? "display");
  const [formData, setFormData] = useState<StreamEventConfig>(event);

  const handleChange = (field: keyof StreamEventConfig, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTextChange = (newText: string) => {
    setFormData((prev) => ({
      ...prev,
      text: newText,
      data: textToHex(newText),
    }));
  };

  const handleDataChange = (newData: string) => {
    const upperData = newData.toUpperCase();
    setFormData((prev) => ({
      ...prev,
      data: upperData,
      text: isValidHex(upperData) ? hexToText(upperData) : prev.text,
    }));
  };

  const handleSave = () => {
    onSave?.(formData);
    if (!isLocked) setMode("display");
  };

  const handleEdit = () => {
    if (!isLocked) {
      setFormData(event);
      setMode("edit");
    }
  };

  const scheduleMode = (formData.scheduleMode as StreamEventScheduleMode | undefined) ?? "delay";

  return (
    <Accordion elevation={3}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Stack direction="row" alignItems="center" gap={2} sx={{ width: "100%" }}>
          <Chip
            label={formData.enabled ? "Enabled" : "Disabled"}
            color={formData.enabled ? "success" : "default"}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              if (!isLocked || mode === "edit") {
                handleChange("enabled", !formData.enabled);
              }
            }}
            sx={{ cursor: !isLocked || mode === "edit" ? "pointer" : "default" }}
          />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {formData.label?.trim() || formData.eventName || "Unnamed Event"}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
            {scheduleMode === "delay" && `Delay: ${formData.delaySeconds ?? 0}s`}
            {scheduleMode === "interval" && `Every: ${formData.intervalSeconds ?? 10}s`}
            {scheduleMode === "timestamps" && `At: ${formData.atSeconds ?? 0}s`}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack gap={2} onClick={(e) => e.stopPropagation()}>
          <Box>
            <StreamEventIdentification
              label={formData.label}
              eventName={formData.eventName}
              mode={mode}
              onChange={(field, value) => handleChange(field, value)}
            />
          </Box>

          <Divider />

          <Box>
            <StreamEventScheduling
              scheduleMode={scheduleMode}
              delaySeconds={formData.delaySeconds}
              intervalSeconds={formData.intervalSeconds}
              offsetSeconds={formData.offsetSeconds}
              atSeconds={formData.atSeconds}
              mode={mode}
              onChange={(field, value) =>
                handleChange(field as keyof StreamEventConfig, value as string | number | boolean)
              }
            />
          </Box>

          <Divider />

          <Box>
            <StreamEventData
              text={formData.text}
              data={formData.data}
              targetURL={formData.targetURL}
              mode={mode}
              onTextChange={handleTextChange}
              onDataChange={handleDataChange}
              onTargetURLChange={(url) => handleChange("targetURL", url)}
            />
          </Box>
        </Stack>
      </AccordionDetails>
      {!isLocked && (
        <AccordionActions>
          {mode === "edit" ? (
            <IconButton size="small" onClick={handleSave} color="primary">
              <Save fontSize="small" />
            </IconButton>
          ) : (
            <>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={handleEdit}>
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" onClick={onDelete} color="error">
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </AccordionActions>
      )}
    </Accordion>
  );
}
