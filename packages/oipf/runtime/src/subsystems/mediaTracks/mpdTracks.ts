/**
 * What the tracks of a DASH presentation take from the MPD as it came, not as dash.js
 * read it: the `@lang` of an AdaptationSet or Preselection (TS 102 796 A.2.12.3: "the
 * value of the lang attribute in the MPD"; dash.js normalizes it, "ger" to "de"), and
 * the order of the AdaptationSets and Preselections in their Period (A.2.12.1: the
 * order of the tracks is theirs).
 *
 * A track is named as the engine names it (`DashTrack.ref`): `adaptation:<index of the
 * AdaptationSet in the Period>` or `preselection:<@id>`.
 */

export type MpdTrack = Readonly<{ ref: string; lang: string | null }>;

/** The AdaptationSets and Preselections of the MPD's Period at `period`, in their order; none if there is no such. */
export const mpdTracks = (mpd: Document, period: number): MpdTrack[] => {
  const root = mpd.documentElement;
  if (!root || root.localName !== "MPD") return [];
  const periods = Array.from(root.children).filter((child) => child.localName === "Period");
  const chosen = periods[period];
  if (!chosen) return [];
  const tracks: MpdTrack[] = [];
  let adaptation = 0;
  for (const child of Array.from(chosen.children)) {
    if (child.localName === "AdaptationSet") {
      tracks.push({ ref: `adaptation:${adaptation}`, lang: child.getAttribute("lang") });
      adaptation++;
    } else if (child.localName === "Preselection") {
      tracks.push({ ref: `preselection:${child.getAttribute("id") ?? ""}`, lang: child.getAttribute("lang") });
    }
  }
  return tracks;
};
