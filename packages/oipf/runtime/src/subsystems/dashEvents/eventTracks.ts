/**
 * The TextTracks of an element's DASH event streams (TS 102 796 §9.3.2.2): one per
 * event stream, of kind "metadata", with empty label, language and id, the stream's
 * scheme and value as `inBandMetadataTrackDispatchType`, in mode "hidden"; one DataCue
 * per event, the complete list of the stream's events as the MPD defines them now.
 *
 * Each MPD (the first, and every update of a dynamic one) brings the tracks in line:
 * new streams get a track (with an `addtrack` event, `addTextTrack()`'s own); a cue that
 * is still in the MPD stays the same object, so that an active cue is not exited and
 * entered again; an event with an `@id` is the same event as long as its id is
 * (TS 103 285 §9.1.5: events with an id are repetitions of the same event).
 *
 * A stream no longer in the MPD, or the end of the presentation, leaves its track with
 * no cues, disabled: a track made with `addTextTrack()` cannot be removed, so the
 * application gets no `removetrack` (a limit of the emulator). The same stream again
 * finds its track again, hidden.
 */

import type { DashEvent, DashEventStream } from "./mpdEvents";
import { dispatchType } from "./mpdEvents";

export type DataCueConstructor = new (startTime: number, endTime: number, data: ArrayBuffer) => TextTrackCue;

export type EventTracks = Readonly<{
  /** Brings the tracks in line with the event streams of the MPD just loaded. */
  update: (streams: ReadonlyArray<DashEventStream>) => void;
  /** The presentation ended: every track empty and disabled. */
  clear: () => void;
}>;

/** `retired`: emptied and disabled by the emulator (not by the application, whose mode stays). */
type Track = { track: TextTrack; cues: Map<string, TextTrackCue>; retired: boolean };

const bytes = (data: ArrayBuffer): string => Array.from(new Uint8Array(data)).join(",");

/** What makes an event the same in the next MPD: its id, or everything about it. */
const eventKey = (event: DashEvent): string =>
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
    const created: Track = { track, cues: new Map(), retired: false };
    tracks.set(type, created);
    return created;
  };

  const retire = (retiring: Track) => {
    if (retiring.retired) return;
    for (const cue of retiring.cues.values()) retiring.track.removeCue(cue);
    retiring.cues.clear();
    retiring.track.mode = "disabled";
    retiring.retired = true;
  };

  return {
    update: (streams) => {
      const current = new Set<string>();
      for (const stream of streams) {
        const type = dispatchType(stream);
        current.add(type);
        const { track, cues } = trackFor(type);
        const events = new Map(stream.events.map((event) => [eventKey(event), event]));
        for (const [key, cue] of cues) {
          if (events.has(key)) continue;
          track.removeCue(cue);
          cues.delete(key);
        }
        for (const [key, event] of events) {
          if (cues.has(key)) continue;
          const cue = new DataCue(event.startTime, event.endTime, event.data);
          cue.id = event.id;
          cue.pauseOnExit = false;
          track.addCue(cue);
          cues.set(key, cue);
        }
      }
      for (const [type, track] of tracks) if (!current.has(type)) retire(track);
    },
    clear: () => {
      for (const track of tracks.values()) retire(track);
    },
  };
};
