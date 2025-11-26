import type { ExtensionConfig } from "@hbb-emu/lib";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  AppBar,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useConfig } from "../context/config";
import { generateRandomChannel } from "../misc";

export default function ChannelEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { api } = useConfig();
  const [formData, setFormData] = useState<Omit<ExtensionConfig.Channel, "id">>({
    ...generateRandomChannel(),
    name: "",
    mp4Source: "",
    streamEvents: [],
    enableStreamEvents: false,
  });

  useEffect(() => {
    if (id && id !== "new") {
      api.channel.load().then((channels) => {
        const channel = channels.find((ch) => ch.id === id);
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
        }
      });
    }
  }, [id, api.channel]);

  const handleChange =
    (field: keyof Omit<ExtensionConfig.Channel, "id">) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async () => {
    const channelData: ExtensionConfig.Channel = {
      id: id && id !== "new" ? id : crypto.randomUUID(),
      ...formData,
    };
    await api.channel.save(channelData);
    navigate("/");
  };

  return (
    <Box>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <IconButton edge="start" onClick={() => navigate("/")}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            {id && id !== "new" ? "Edit Channel" : "New Channel"}
          </Typography>
          <Button variant="contained" onClick={handleSubmit}>
            Save
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2 }}>
        <Stack spacing={2}>
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
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  if (id && id !== "new") {
                    navigate(`/channel/${id}/events`);
                  }
                }}
                disabled={!id || id === "new"}
              >
                Manage Stream Events
              </Button>
              {(!id || id === "new") && (
                <Typography variant="caption" color="text.secondary">
                  Save the channel first to manage stream events
                </Typography>
              )}
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
                />
                <TextField
                  label="TSID"
                  value={formData.tsid}
                  onChange={handleChange("tsid")}
                  fullWidth
                  helperText="Transport Stream ID"
                />
                <TextField
                  label="SID"
                  value={formData.sid}
                  onChange={handleChange("sid")}
                  fullWidth
                  helperText="Service ID"
                />
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </Box>
    </Box>
  );
}
