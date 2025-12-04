import type { ExtensionConfig } from "@hbb-emu/lib";
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, PlayArrow as PlayIcon } from "@mui/icons-material";
import { Box, Button, IconButton, List, ListItem, ListItemText, Paper, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConfig } from "../context/config";

export default function ChannelList() {
  const { channel } = useConfig();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<ExtensionConfig.Channel[]>([]);

  const handleAddChannel = () => {
    navigate("/channel/new");
  };

  const handleEditChannel = (id: string) => {
    navigate(`/channel/${id}`);
  };

  const handleDeleteChannel = async (id: string) => {
    await channel.remove(id);
    const updated = await channel.load();
    setChannels(updated);
  };

  const handlePlayChannel = async (ch: ExtensionConfig.Channel) => {
    await channel.play(ch);
  };

  useEffect(() => {
    channel.load().then(setChannels);
  }, [channel]);

  return (
    <Box p={2}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6" component="h2">
          Channels
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddChannel}>
          Add
        </Button>
      </Box>

      <Paper variant="outlined">
        {channels.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography color="text.secondary" variant="body2">
              No channels configured.
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {channels.map((ch, index) => (
              <ListItem
                key={ch.id}
                divider={index < channels.length - 1}
                secondaryAction={
                  <Box>
                    <Tooltip title="Play">
                      <IconButton size="small" color="success" onClick={() => handlePlayChannel(ch)}>
                        <PlayIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" color="primary" onClick={() => handleEditChannel(ch.id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDeleteChannel(ch.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemText
                  primary={ch.name}
                  secondary={`${ch.onid}-${ch.tsid}-${ch.sid}`}
                  slotProps={{
                    primary: { noWrap: true },
                    secondary: { variant: "caption" },
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
