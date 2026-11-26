/**
 * `AudioTrackList`/`AudioTrack` and `VideoTrackList`/`VideoTrack` (HTML §4.8.11.10),
 * which an HbbTV 2 terminal has for its media elements (TS 102 796 A.2.12.1) and
 * Chromium and Firefox have only behind a flag. The page runtime keeps one list of each
 * per element, as HTML does, and fills it from what the element presents.
 *
 * As in HTML: the tracks are the list's indices, `length` and `getTrackById()`; a new
 * track fires `addtrack`, a track gone `removetrack`, with the track as the event's
 * `track`, and a change of `enabled`/`selected` fires `change` once, in a task of its
 * own; at most one VideoTrack is selected. A new source empties the lists with no event
 * (HTML's "forget the media element's media-resource-specific tracks").
 *
 * The emulator's: enabling an AudioTrack disables the others, since dash.js presents one
 * audio track at a time; disabling the enabled one, or deselecting the selected
 * VideoTrack, changes the flag but not what the element plays. The events are plain
 * `Event`s with a `track` (a `TrackEvent` takes only the browser's own tracks).
 */

export type TrackType = "audio" | "video";

/** A track as the page runtime gives it to a list. */
export type TrackInit = Readonly<{
  /** What makes it the same track in the next update. */
  key: string;
  id: string;
  kind: string;
  label: string;
  language: string;
  /** Enabled (audio) or selected (video). */
  on: boolean;
}>;

export type MediaTrack = Readonly<{ id: string; kind: string; label: string; language: string }>;

export type TrackList = EventTarget &
  Readonly<{ length: number; getTrackById: (id: string) => MediaTrack | null; [index: number]: MediaTrack }>;

export type TrackListControl = Readonly<{
  list: TrackList;
  /** Brings the list in line with what the element presents now; tracks that stay keep their object. */
  set: (tracks: ReadonlyArray<TrackInit>) => void;
  /** Empties the list, with no event. */
  clear: () => void;
}>;

export type TrackListEnv = Readonly<{
  window: Window & typeof globalThis;
  /** The application turned this track on: present it. */
  select: (key: string) => void;
}>;

const handlerAttribute = (target: EventTarget, type: string) => {
  let handler: ((event: Event) => unknown) | null = null;
  const listener = (event: Event) => handler?.call(target, event);
  Object.defineProperty(target, `on${type}`, {
    configurable: true,
    enumerable: true,
    get: () => handler,
    set: (value: unknown) => {
      const had = handler !== null;
      handler = typeof value === "function" ? (value as (event: Event) => unknown) : null;
      if (handler && !had) target.addEventListener(type, listener);
      if (!handler && had) target.removeEventListener(type, listener);
    },
  });
};

export const createTrackList = (type: TrackType, env: TrackListEnv): TrackListControl => {
  const { window } = env;
  const list = new window.EventTarget() as EventTarget & Record<string, unknown>;
  for (const event of ["change", "addtrack", "removetrack"]) handlerAttribute(list, event);

  type Entry = { init: TrackInit; on: boolean; track: MediaTrack };
  let entries: Entry[] = [];

  let changeQueued = false;
  const queueChange = () => {
    if (changeQueued) return;
    changeQueued = true;
    window.setTimeout(() => {
      changeQueued = false;
      list.dispatchEvent(new window.Event("change"));
    }, 0);
  };
  const queueTrackEvent = (name: "addtrack" | "removetrack", track: MediaTrack) =>
    window.setTimeout(() => {
      const event = new window.Event(name);
      Object.defineProperty(event, "track", { enumerable: true, value: track });
      list.dispatchEvent(event);
    }, 0);

  const toggle = (entry: Entry, on: boolean) => {
    if (entry.on === on) return;
    entry.on = on;
    if (on) {
      for (const other of entries) if (other !== entry) other.on = false;
      env.select(entry.init.key);
    }
    queueChange();
  };

  const flag = type === "audio" ? "enabled" : "selected";
  const makeTrack = (entry: Entry): MediaTrack => {
    const track = {} as MediaTrack;
    for (const name of ["id", "kind", "label", "language"] as const)
      Object.defineProperty(track, name, { enumerable: true, get: () => entry.init[name] });
    Object.defineProperty(track, flag, {
      enumerable: true,
      get: () => entry.on,
      set: (value: unknown) => toggle(entry, Boolean(value)),
    });
    return track;
  };

  const syncIndices = (previousLength: number) => {
    for (let index = 0; index < Math.max(previousLength, entries.length); index++) {
      if (index < entries.length)
        Object.defineProperty(list, String(index), {
          configurable: true,
          enumerable: true,
          value: entries[index]?.track,
        });
      else delete list[String(index)];
    }
  };

  Object.defineProperty(list, "length", { enumerable: true, get: () => entries.length });
  Object.defineProperty(list, "getTrackById", {
    value: (id: unknown) => entries.find((entry) => entry.init.id === String(id))?.track ?? null,
  });
  if (type === "video")
    Object.defineProperty(list, "selectedIndex", {
      enumerable: true,
      get: () => entries.findIndex((entry) => entry.on),
    });

  return {
    list: list as unknown as TrackList,
    set: (tracks) => {
      const previous = new Map(entries.map((entry) => [entry.init.key, entry]));
      const previousLength = entries.length;
      const next: Entry[] = [];
      const added: Entry[] = [];
      for (const init of tracks) {
        const kept = previous.get(init.key);
        if (kept) {
          kept.init = init;
          kept.on = init.on;
          previous.delete(init.key);
          next.push(kept);
        } else {
          const entry = { init, on: init.on } as Entry;
          entry.track = makeTrack(entry);
          next.push(entry);
          added.push(entry);
        }
      }
      if (type === "video") {
        const selected = next.findIndex((entry) => entry.on);
        next.forEach((entry, index) => {
          entry.on = index === selected;
        });
      }
      entries = next;
      syncIndices(previousLength);
      for (const removed of previous.values()) queueTrackEvent("removetrack", removed.track);
      for (const entry of added) queueTrackEvent("addtrack", entry.track);
    },
    clear: () => {
      const previousLength = entries.length;
      entries = [];
      syncIndices(previousLength);
    },
  };
};
