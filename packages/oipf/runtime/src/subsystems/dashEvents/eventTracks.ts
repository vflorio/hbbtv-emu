/**
 * The TextTracks of an element's DASH event streams (TS 102 796 §9.3.2.2): one per
 * event stream, of kind "metadata", with empty label, language and id, the stream's
 * scheme and value as `inBandMetadataTrackDispatchType`, in mode "hidden"; one DataCue
 * per event.
 *
 * Each MPD (the first, and every update of a dynamic one) brings the tracks in line:
 * new streams get a track (with an `addtrack` event, `addTextTrack()`'s own), the
 * streams of the MPD (`EventStream`) and of its segments (`InbandEventStream`) alike.
 *
 * - An `EventStream`'s cues are the complete list of its events as the MPD defines them
 *   now. A cue that is still in the MPD stays the same object, so that an active cue is
 *   not exited and entered again; an event with an `@id` is the same event as long as
 *   its id is (TS 103 285 §9.1.5: events with an id are repetitions of the same event).
 * - An inband stream's cues are its events as dash.js receives them (`addInband`): at
 *   least the active ones, as §9.3.2.2 asks. Past ones are dropped once they ended
 *   `PAST_INBAND_CUES` seconds before the element's current time, so that a long live
 *   stream does not grow its list for ever.
 * - A stream with the same scheme and value in both is one track, with both's cues.
 *
 * A stream no longer in the MPD, or the end of the presentation, leaves its track with
 * no cues, disabled: a track made with `addTextTrack()` cannot be removed, so the
 * application gets no `removetrack` (a limit of the emulator). The same stream again
 * finds its track again, hidden.
 */

import type { DashEvent, DashEventStream, InbandEventStream } from "./mpdEvents";
import { dispatchType, MINIMUM_CUE_DURATION } from "./mpdEvents";

export type DataCueConstructor = new (startTime: number, endTime: number, data: ArrayBuffer) => TextTrackCue;

/** An event of the segments, as the engine hands it over. */
export type ReceivedInbandEvent = InbandEventStream &
  Readonly<{ id: string; startTime: number; duration: number | null; data: ArrayBuffer }>;

/** How long an inband cue stays after it ended, in seconds. */
export const PAST_INBAND_CUES = 30;

export type EventTracks = Readonly<{
  /** Brings the tracks in line with the event streams of the MPD just loaded. */
  update: (streams: ReadonlyArray<DashEventStream>, inband: ReadonlyArray<InbandEventStream>) => void;
  /** An event of the segments, at the element's current time. */
  addInband: (event: ReceivedInbandEvent, currentTime: number) => void;
  /** The presentation ended: every track empty and disabled. */
  clear: () => void;
}>;

/** `retired`: emptied and disabled by the emulator (not by the application, whose mode stays). */
type Track = {
  track: TextTrack;
  /** The cues of the MPD's events, and of the segments' events, by what makes an event the same. */
  mpd: Map<string, TextTrackCue>;
  inband: Map<string, TextTrackCue>;
  retired: boolean;
};

const bytes = (data: ArrayBuffer): string => Array.from(new Uint8Array(data)).join(",");

/** What makes an event the same in the next MPD, or the next segment: its id, or everything about it. */
const eventKey = (event: Pick<DashEvent, "id" | "startTime" | "endTime" | "data">): string =>
  event.id !== "" ? `id:${event.id}` : `at:${event.startTime}:${event.endTime}:${bytes(event.data)}`;

export const createEventTracks = (element: HTMLMediaElement, DataCue: DataCueConstructor): EventTracks => {
  const tracks = new Map<string, Track>();

  const trackFor = (type: string): Track => {
    const existing = tracks.get(type);
    if (existing) {
      if (existing.retired) {
        existing.retired = false;
        existing.track.mode = "hidden";
      }
      return existing;
    }
    const track = element.addTextTrack("metadata", "", "");
    Object.defineProperty(track, "inBandMetadataTrackDispatchType", {
      configurable: true,
      enumerable: true,
      value: type,
    });
    track.mode = "hidden";
    const created: Track = { track, mpd: new Map(), inband: new Map(), retired: false };
    tracks.set(type, created);
    return created;
  };

  const addCue = (track: TextTrack, cues: Map<string, TextTrackCue>, key: string, event: DashEvent) => {
    const cue = new DataCue(event.startTime, event.endTime, event.data);
    cue.id = event.id;
    cue.pauseOnExit = false;
    track.addCue(cue);
    cues.set(key, cue);
  };

  const removeCues = (
    track: TextTrack,
    cues: Map<string, TextTrackCue>,
    keep: (key: string, cue: TextTrackCue) => boolean,
  ) => {
    for (const [key, cue] of cues) {
      if (keep(key, cue)) continue;
      track.removeCue(cue);
      cues.delete(key);
    }
  };

  const retire = (retiring: Track) => {
    if (retiring.retired) return;
    removeCues(retiring.track, retiring.mpd, () => false);
    removeCues(retiring.track, retiring.inband, () => false);
    retiring.track.mode = "disabled";
    retiring.retired = true;
  };

  return {
    update: (streams, inband) => {
      const ofMpd = new Set(streams.map(dispatchType));
      const ofSegments = new Set(inband.map(dispatchType));
      for (const stream of streams) {
        const { track, mpd } = trackFor(dispatchType(stream));
        const events = new Map(stream.events.map((event) => [eventKey(event), event]));
        removeCues(track, mpd, (key) => events.has(key));
        for (const [key, event] of events) if (!mpd.has(key)) addCue(track, mpd, key, event);
      }
      for (const type of ofSegments) trackFor(type);
      for (const [type, track] of tracks) {
        if (!ofMpd.has(type) && !ofSegments.has(type)) retire(track);
        // Still a stream of the segments, no more of the MPD: only its MPD cues go.
        else if (!ofMpd.has(type)) removeCues(track.track, track.mpd, () => false);
      }
    },
    addInband: (received, currentTime) => {
      const { track, inband } = trackFor(dispatchType(received));
      const event: DashEvent = {
        id: received.id,
        startTime: received.startTime,
        endTime:
          received.duration === null
            ? Number.MAX_VALUE
            : received.startTime + Math.max(received.duration, MINIMUM_CUE_DURATION),
        data: received.data,
      };
      const key = eventKey(event);
      if (!inband.has(key)) addCue(track, inband, key, event);
      for (const { track, inband } of tracks.values())
        removeCues(track, inband, (_, cue) => cue.endTime >= currentTime - PAST_INBAND_CUES);
    },
    clear: () => {
      for (const track of tracks.values()) retire(track);
    },
  };
};
