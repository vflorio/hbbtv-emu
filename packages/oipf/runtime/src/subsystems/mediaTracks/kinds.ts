/**
 * The `kind` of an AudioTrack, a VideoTrack and a TextTrack presented from MPEG DASH,
 * as TS 102 796 A.2.12.3 replaces OIPF DAE §8.4.6: from the values of the
 * AdaptationSet's (or Preselection's) Roles of scheme `urn:mpeg:dash:role:2011`, and
 * for "main-desc" and "captions" its Accessibility descriptors of scheme
 * `urn:tva:metadata:cs:AudioPurposeCS:2007`.
 *
 * With no Role, the kind is "" for audio and video, "metadata" for text (A.2.12.3
 * says "otherwise").
 */

/** The AudioPurposeCS value of an audio description (TV-Anytime: "Audio description for the visually impaired"). */
const VISUALLY_IMPAIRED = "1";
/** The AudioPurposeCS value of subtitles for the hard of hearing (A.2.12.3: "[for the hard of hearing]"). */
const HARD_OF_HEARING = "2";

export const audioKind = (roles: ReadonlyArray<string>, audioPurposes: ReadonlyArray<string>): string => {
  const has = (role: string) => roles.includes(role);
  if ((has("main") && has("description")) || (has("alternate") && audioPurposes.includes(VISUALLY_IMPAIRED)))
    return "main-desc";
  if (has("description") && has("supplementary")) return "descriptions";
  if (has("dub") && has("main")) return "translation";
  if ((has("alternate") && !has("main") && !has("commentary")) || has("dub")) return "alternative";
  if (has("main") && !has("caption") && !has("subtitle") && !has("dub") && !has("description")) return "main";
  if (has("commentary") && !has("main")) return "commentary";
  return "";
};

export const videoKind = (roles: ReadonlyArray<string>): string => {
  const has = (role: string) => roles.includes(role);
  if (has("caption") && has("main")) return "captions";
  if (has("subtitle") && has("main")) return "subtitles";
  if ((has("alternate") && !has("main") && !has("commentary")) || has("dub")) return "alternative";
  if (has("main") && !has("caption") && !has("subtitle") && !has("dub")) return "main";
  if (has("commentary") && !has("main")) return "commentary";
  return "";
};

/** What A.2.12.3 looks at for a subtitle AdaptationSet, besides its Roles. */
export type TextKindContext = Readonly<{
  /** The values of its AudioPurposeCS Accessibility descriptors. */
  audioPurposes: ReadonlyArray<string>;
  /** Whether it has any Accessibility descriptor, of any scheme. */
  accessibility: boolean;
  /** Whether the Period has an audio AdaptationSet or Preselection of Role "main" in its language. */
  mainAudioInLanguage: boolean;
}>;

export const textKind = (
  roles: ReadonlyArray<string>,
  context: TextKindContext,
): "captions" | "subtitles" | "metadata" => {
  const has = (role: string) => roles.includes(role);
  if (
    (has("main") && context.mainAudioInLanguage && context.audioPurposes.includes(HARD_OF_HEARING)) ||
    has("commentary") ||
    has("caption")
  )
    return "captions";
  if (has("alternate") || (has("main") && !context.accessibility) || has("subtitle")) return "subtitles";
  return "metadata";
};
