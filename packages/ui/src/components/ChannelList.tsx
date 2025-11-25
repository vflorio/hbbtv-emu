import type { ChannelConfig } from "@hbb-emu/lib";
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
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
import { useNavigate } from "react-router-dom";
import { useConfig } from "../context/config";

export default function ChannelList() {
  const { api } = useConfig();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<ChannelConfig[]>([]);

  const handleAddChannel = () => {
    navigate("/channel/new");
  };

  const handleEditChannel = (id: string) => {
    navigate(`/channel/${id}`);
  };

  const handleDeleteChannel = async (id: string) => {
    await api.channel.deleteChannel(id);
    const updated = await api.channel.loadChannels();
    setChannels(updated);
  };

  useEffect(() => {
    api.channel.loadChannels().then(setChannels);
  }, [api.channel]);

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
        <Typography variant="h5" component="h2">
          Channel Configuration
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddChannel}>
          Add Channel
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>MP4 Source</TableCell>
              <TableCell>CCID</TableCell>
              <TableCell>ONID</TableCell>
              <TableCell>TSID</TableCell>
              <TableCell>SID</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {channels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No channel configured. Click "Add Channel" to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              channels.map((channel) => (
                <TableRow key={channel.id} hover>
                  <TableCell>{channel.name}</TableCell>
                  <TableCell>
                    <Tooltip title={channel.mp4Source}>
                      <Typography
                        sx={{
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {channel.mp4Source}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{channel.ccid}</TableCell>
                  <TableCell>{channel.onid}</TableCell>
                  <TableCell>{channel.tsid}</TableCell>
                  <TableCell>{channel.sid}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" color="primary" onClick={() => handleEditChannel(channel.id)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDeleteChannel(channel.id)}>
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
    </Box>
  );
}
