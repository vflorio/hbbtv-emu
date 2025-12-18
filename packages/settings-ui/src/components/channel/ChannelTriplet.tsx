import { Edit, Save } from "@mui/icons-material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionActions,
  AccordionDetails,
  AccordionSummary,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { type ChangeEvent, useState } from "react";

interface ChannelTripletProps {
  onid: number;
  tsid: number;
  sid: number;
  defaultMode?: "display" | "edit";
  onChange?: (field: "onid" | "tsid" | "sid", value: number) => void;
}

export function ChannelTriplet({ onid, tsid, sid, defaultMode, onChange }: ChannelTripletProps) {
  const isLocked = defaultMode !== undefined;
  const [mode, setMode] = useState<"display" | "edit">(defaultMode ?? "display");
  const [localOnid, setLocalOnid] = useState(onid);
  const [localTsid, setLocalTsid] = useState(tsid);
  const [localSid, setLocalSid] = useState(sid);

  const handleChange = (field: "onid" | "tsid" | "sid", value: number) => {
    if (isLocked) {
      onChange?.(field, value);
    } else {
      if (field === "onid") setLocalOnid(value);
      if (field === "tsid") setLocalTsid(value);
      if (field === "sid") setLocalSid(value);
    }
  };

  const handleSave = () => {
    onChange?.("onid", localOnid);
    onChange?.("tsid", localTsid);
    onChange?.("sid", localSid);
    if (!isLocked) setMode("display");
  };

  const handleEdit = () => {
    if (!isLocked) {
      setLocalOnid(onid);
      setLocalTsid(tsid);
      setLocalSid(sid);
      setMode("edit");
    }
  };

  return (
    <Accordion elevation={2}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2">DVB Triplet (ONID/TSID/SID)</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack gap={2}>
          {mode === "display" ? (
            <>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  ONID (Original Network ID)
                </Typography>
                <Typography variant="body2">{onid}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  TSID (Transport Stream ID)
                </Typography>
                <Typography variant="body2">{tsid}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  SID (Service ID)
                </Typography>
                <Typography variant="body2">{sid}</Typography>
              </Stack>
            </>
          ) : (
            <>
              <TextField
                label="ONID"
                type="number"
                value={isLocked ? onid : localOnid}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange("onid", Number.parseInt(e.target.value, 10) || 0)
                }
                fullWidth
                helperText="Original Network ID"
                size="small"
              />
              <TextField
                label="TSID"
                type="number"
                value={isLocked ? tsid : localTsid}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange("tsid", Number.parseInt(e.target.value, 10) || 0)
                }
                fullWidth
                helperText="Transport Stream ID"
                size="small"
              />
              <TextField
                label="SID"
                type="number"
                value={isLocked ? sid : localSid}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange("sid", Number.parseInt(e.target.value, 10) || 0)
                }
                fullWidth
                helperText="Service ID"
                size="small"
              />
            </>
          )}
        </Stack>
      </AccordionDetails>
      {!isLocked && (
        <AccordionActions>
          {mode === "edit" ? (
            <Tooltip title="Save">
              <IconButton size="small" onClick={handleSave}>
                <Save fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={handleEdit}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </AccordionActions>
      )}
    </Accordion>
  );
}
