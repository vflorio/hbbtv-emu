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
    config: { channels, currentChannel },
  } = useAppState();
  const [expandedChannel, setExpandedChannel] = useState<string | null>(currentChannel?.id ?? null);

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
              isActive={currentChannel?.id === channel.id}
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
  isActive,
  isExpanded,
  onToggleExpand,
}: {
  channel: ChannelConfig;
  isActive: boolean;
  isExpanded: boolean;
  onToggleExpand: (expanded: boolean) => void;
}) {
  const { upsert } = useChannelActions();
  const [localChannel, setLocalChannel] = useState(channel);

  useEffect(() => {
    setLocalChannel(channel);
  }, [channel]);

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
            channel={localChannel}
            onChange={handleBasicInfoChange}
            onSave={upsert}
          />
          <ChannelTimeline mp4Source={localChannel.mp4Source} streamEvents={localChannel.streamEvents || []} />
          <StreamEventsList
            streamEvents={localChannel.streamEvents || []}
            channel={localChannel}
            onChange={(events) => setLocalChannel((prev) => ({ ...prev, streamEvents: events }))}
            onSave={upsert}
          />
          <ChannelTriplet
            onid={localChannel.onid}
            tsid={localChannel.tsid}
            sid={localChannel.sid}
            channel={localChannel}
            onChange={handleTripletChange}
            onSave={upsert}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
