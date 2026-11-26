/**
 * The `kind` of an AudioTrack and of a VideoTrack presented from MPEG DASH, as TS 102
 * 796 A.2.12.3 replaces OIPF DAE §8.4.6: from the values of the AdaptationSet's (or
 * Preselection's) Roles of scheme `urn:mpeg:dash:role:2011`, and for "main-desc" its
 * Accessibility descriptors of scheme `urn:tva:metadata:cs:AudioPurposeCS:2007`.
 *
 * With no Role, the kind is "" (A.2.12.3 says "otherwise").
 */

/** The AudioPurposeCS value of an audio description (TV-Anytime: "Audio description for the visually impaired"). */
const VISUALLY_IMPAIRED = "1";

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
