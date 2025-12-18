import { randomUUID } from "@hbb-emu/core";
import type { ChannelConfig } from "@hbb-emu/extension-common";
import { Add as AddIcon, ExpandMore } from "@mui/icons-material";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { ChannelBasicInfo, ChannelTimeline, ChannelTriplet } from "../components/channel";
import Panel from "../components/Panel";
import { StreamEventsList } from "../components/streamEvent";
import { useAppState } from "../context/state";
import { useChannelActions } from "../hooks/useChannelActions";

export default function ChannelList() {
  const { upsert } = useChannelActions();
  const {
    isLoading,
    config: { channels },
  } = useAppState();
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  const handleAddChannel = async () => {
    const newChannel: ChannelConfig = {
      id: randomUUID(),
      name: "New Channel",
      mp4Source: "",
      onid: Math.floor(Math.random() * 65535),
      tsid: Math.floor(Math.random() * 65535),
      sid: Math.floor(Math.random() * 65535),
      enableStreamEvents: false,
      streamEvents: [],
    };
    await upsert(newChannel);
    setExpandedChannel(newChannel.id);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  return (
    <Panel
      title="Channels"
      actions={
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddChannel}>
          Add
        </Button>
      }
    >
      {!channels.length ? (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary" variant="body2">
            No channels configured.
          </Typography>
        </Box>
      ) : (
        <Stack gap={1}>
          {channels.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isExpanded={expandedChannel === channel.id}
              onToggleExpand={(expanded) => setExpandedChannel(expanded ? channel.id : null)}
            />
          ))}
        </Stack>
      )}
    </Panel>
  );
}

function ChannelItem({
  channel,
  isExpanded,
  onToggleExpand,
}: {
  channel: ChannelConfig;
  isExpanded: boolean;
  onToggleExpand: (expanded: boolean) => void;
}) {
  const isActive = true;
  const { upsert } = useChannelActions();
  const [localChannel, setLocalChannel] = useState(channel);

  useEffect(() => {
    setLocalChannel(channel);
  }, [channel]);

  const handleUpdate = async () => {
    await upsert(localChannel);
  };

  const handleBasicInfoChange = (field: "name" | "mp4Source", value: string) => {
    setLocalChannel((prev) => ({ ...prev, [field]: value }));
  };

  const handleTripletChange = (field: "onid" | "tsid" | "sid", value: number) => {
    setLocalChannel((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Accordion expanded={isExpanded} onChange={(_, expanded) => onToggleExpand(expanded)}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Stack direction="row" alignItems="center" gap={2} onClick={(e) => e.stopPropagation()}>
          {isActive && <Chip color="primary" label="Current" />}
          <Typography>{localChannel.name}</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack gap={2}>
          <ChannelBasicInfo
            name={localChannel.name}
            mp4Source={localChannel.mp4Source}
            onChange={handleBasicInfoChange}
          />
          <ChannelTimeline mp4Source={localChannel.mp4Source} streamEvents={localChannel.streamEvents || []} />
          <StreamEventsList
            streamEvents={localChannel.streamEvents || []}
            onChange={(events) => setLocalChannel((prev) => ({ ...prev, streamEvents: events }))}
          />
          <ChannelTriplet
            onid={localChannel.onid}
            tsid={localChannel.tsid}
            sid={localChannel.sid}
            onChange={handleTripletChange}
          />
          <Button variant="contained" onClick={handleUpdate} fullWidth sx={{ mt: 2 }}>
            Save Changes
          </Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
