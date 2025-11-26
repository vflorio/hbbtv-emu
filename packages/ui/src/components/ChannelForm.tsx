import type { ExtensionConfig } from "@hbb-emu/lib";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { generateRandomChannel } from "../misc";
import StreamEventsManager from "./StreamEventsManager";

interface ChannelFormProps {
  open: boolean;
  channel: ExtensionConfig.Channel | null;
  onClose: () => void;
  onSave: (channel: ExtensionConfig.Channel) => void;
}

export default function ChannelForm({ open, channel, onClose, onSave }: ChannelFormProps) {
  const [streamEventsOpen, setStreamEventsOpen] = useState(false);
  const [formData, setFormData] = useState<Omit<ExtensionConfig.Channel, "id">>({
    ...generateRandomChannel(),
    name: "",
    mp4Source: "",
    streamEvents: [],
    enableStreamEvents: false,
  });

  useEffect(() => {
    if (channel) {
      setFormData({
        name: channel.name,
        onid: channel.onid,
        tsid: channel.tsid,
        sid: channel.sid,
        mp4Source: channel.mp4Source,
        streamEvents: channel.streamEvents || [],
        enableStreamEvents: channel.enableStreamEvents || false,
      });
    } else {
      setFormData({
        ...generateRandomChannel(),
        name: "",
        mp4Source: "",
        streamEvents: [],
        enableStreamEvents: false,
      });
    }
  }, [channel]);

  const handleChange =
    (field: keyof Omit<ExtensionConfig.Channel, "id">) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = () => {
    const channelData: ExtensionConfig.Channel = {
      id: channel?.id || crypto.randomUUID(),
      ...formData,
    };
    onSave(channelData);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{channel ? "Edit Channel" : "New Channel"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Channel Name" value={formData.name} onChange={handleChange("name")} fullWidth required />
            <TextField
              label="MP4 Source"
              value={formData.mp4Source}
              onChange={handleChange("mp4Source")}
              fullWidth
              required
              helperText="MP4 file URL"
              type="url"
            />

            <Divider />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.enableStreamEvents || false}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      enableStreamEvents: e.target.checked,
                    }))
                  }
                />
              }
              label="Enable Stream Events (DSM-CC)"
            />

            {formData.enableStreamEvents && (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Stream events: {formData.streamEvents?.length || 0} configured
                </Typography>
                <Button variant="outlined" size="small" onClick={() => setStreamEventsOpen(true)}>
                  Manage Stream Events
                </Button>
              </Stack>
            )}

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Advanced Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    label="ONID"
                    value={formData.onid}
                    onChange={handleChange("onid")}
                    fullWidth
                    helperText="Original Network ID"
                    type="number"
                  />
                  <TextField
                    label="TSID"
                    value={formData.tsid}
                    onChange={handleChange("tsid")}
                    fullWidth
                    helperText="Transport Stream ID"
                    type="number"
                  />
                  <TextField
                    label="SID"
                    value={formData.sid}
                    onChange={handleChange("sid")}
                    fullWidth
                    helperText="Service ID"
                    type="number"
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

      <StreamEventsManager
        open={streamEventsOpen}
        events={formData.streamEvents || []}
        onClose={() => setStreamEventsOpen(false)}
        onSave={(events: ExtensionConfig.StreamEvent[]) => {
          setFormData((prev) => ({ ...prev, streamEvents: events }));
          setStreamEventsOpen(false);
        }}
      />
    </>
  );
}
