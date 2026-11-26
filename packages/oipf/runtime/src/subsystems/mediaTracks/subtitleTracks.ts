/**
 * The TextTracks of an element's DASH subtitles (TS 102 796 A.2.12.1): one per subtitle
 * AdaptationSet dash.js offers, made with `addTextTrack()`, with the kind A.2.12.3
 * derives from the Roles (`textKind`), label "" and the MPD's language as OIPF DAE
 * §8.4.6 maps them, and the AdaptationSet's `@id` as `id`. They start disabled, as HTML
 * has the tracks of a media resource when no preference of the user enables one (the
 * emulator has none). dash.js fills them with cues.
 *
 * The application's `mode` chooses what dash.js fetches, and dash.js fetches one
 * subtitle track at a time: the first one "showing" in the order they were made, the
 * first one "hidden" otherwise, none if all are disabled (`select`). Another track
 * that is not disabled gets no cues (a limit of the emulator).
 *
 * A track made with `addTextTrack()` cannot be removed, so the application gets no
 * `removetrack` (a limit of the emulator): the end of the presentation, or a new
 * source, leaves every track empty and disabled, and a track of the same kind,
 * language and id finds it again.
 */

export type SubtitleTrackInit = Readonly<{
  /** The engine's ref for it, in the Period dash.js starts. */
  ref: string;
  id: string;
  kind: TextTrackKind;
  language: string;
}>;

export type SubtitleTracks = Readonly<{
  /** The TextTrack of a subtitle track dash.js offers in the Period it starts. */
  track: (init: SubtitleTrackInit) => TextTrack;
  /** The presentation ended, or starts over: every track empty and disabled. */
  clear: () => void;
}>;

/** `ref`: what dash.js knows it by now, `null` once the presentation let it go. */
type Entry = { track: TextTrack; ref: string | null };

export const createSubtitleTracks = (
  element: HTMLMediaElement,
  select: (ref: string | null) => void,
): SubtitleTracks => {
  const entries = new Map<string, Entry>();
  let selected: string | null = null;

  const review = () => {
    const current = [...entries.values()].filter((entry) => entry.ref !== null);
    const chosen =
      current.find((entry) => entry.track.mode === "showing") ?? current.find((entry) => entry.track.mode === "hidden");
    const ref = chosen?.ref ?? null;
    if (ref === selected) return;
    selected = ref;
    select(ref);
  };

  return {
    track: (init) => {
      const key = `${init.kind}\n${init.language}\n${init.id}`;
      let entry = entries.get(key);
      if (entry) {
        entry.ref = init.ref;
      } else {
        const track = element.addTextTrack(init.kind, "", init.language);
        Object.defineProperty(track, "id", { configurable: true, enumerable: true, value: init.id });
        track.mode = "disabled";
        entry = { track, ref: init.ref };
        const list: Partial<TextTrackList> | undefined = element.textTracks;
        if (entries.size === 0 && typeof list?.addEventListener === "function") list.addEventListener("change", review);
        entries.set(key, entry);
      }
      review();
      return entry.track;
    },
    clear: () => {
      for (const entry of entries.values()) {
        if (entry.ref === null) continue;
        entry.ref = null;
        for (const cue of Array.from(entry.track.cues ?? [])) entry.track.removeCue(cue);
        entry.track.mode = "disabled";
      }
      review();
    },
  };
};
