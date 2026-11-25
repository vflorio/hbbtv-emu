import { randomUUID } from "@hbb-emu/core";
import type { ChannelConfig } from "@hbb-emu/extension-common";
import { Add as AddIcon, ExpandMore, PlayArrow, Tv } from "@mui/icons-material";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useEffect, useState } from "react";
import { ChannelAit, ChannelBasicInfo, ChannelTimeline, ChannelTriplet } from "../components/channel";
import Panel from "../components/Panel";
import { StreamEventsList } from "../components/streamEvent";
import { useAppState, useChannelActions } from "../hooks";

export default function ChannelList() {
  const { upsert } = useChannelActions();
  const {
    isLoading,
    config: { channels, currentChannel },
  } = useAppState();
  const [expandedChannel, setExpandedChannel] = useState<string | null>(currentChannel?.id ?? channels[0]?.id ?? null);

  const handleAddChannel = pipe(
    TE.of({
      id: randomUUID(),
      name: "New Channel",
      mp4Source: "",
      onid: Math.floor(Math.random() * 65535),
      tsid: Math.floor(Math.random() * 65535),
      sid: Math.floor(Math.random() * 65535),
      enableStreamEvents: false,
      streamEvents: [],
    }),
    TE.tapIO((newChannel) => () => {
      setExpandedChannel(newChannel.id);
    }),
    TE.flatMap((newChannel) => upsert(newChannel)),
    TE.match(
      (error) => console.error("Failed to add channel:", error),
      () => console.log("Channel added successfully"),
    ),
  );

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
  const { upsert, play, turnOnTv } = useChannelActions();
  const [localChannel, setLocalChannel] = useState(channel);

  const run = (label: string, action: TE.TaskEither<unknown, void>) =>
    void pipe(
      action,
      TE.match(
        (error) => console.error(`${label} failed:`, error),
        () => undefined,
      ),
    )();

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
          <Stack direction="row" gap={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PlayArrow />}
              onClick={() => run("Play", play(channel))}
            >
              Play here
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Tv />}
              onClick={() => run("Turn on", turnOnTv(channel))}
            >
              Turn on the TV
            </Button>
          </Stack>
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
          <ChannelAit channel={localChannel} onSave={upsert} />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
