/**
 * The events of an MPD's EventStreams (MPEG DASH ISO/IEC 23009-1 §5.10.2), as TS 102
 * 796 §9.3.2.2 has the terminal give them to the application, one TextTrack per event
 * stream and one DataCue per event:
 *
 * - `startTime`: `@presentationTime` (0 if absent), less the EventStream's
 *   `@presentationTimeOffset`, on its `@timescale` (1 if absent), plus the start of its
 *   Period;
 * - `endTime`: `startTime` plus `@duration`, at least 250 ms; `Number.MAX_VALUE`
 *   without a duration;
 * - `id`: `@id`, "" if absent;
 * - `data`: the Event's character data, UTF-8 (decoded first if `@contentEncoding` is
 *   "base64"); when the Event has child elements or is empty, the Event element itself,
 *   serialized as XML (as SCTE 35 in MPD events, Signal.Binary included).
 *
 * The event streams of DASH itself (§5.10.4, schemes `urn:mpeg:dash:event:…`: MPD
 * validity, patch, callback) are dash.js's, not the application's. EventStreams of the
 * same scheme and value in more Periods are one stream, as an application follows them
 * (for example the ad breaks of a multi-period MPD).
 *
 * Times are on the element's timeline as dash.js presents it: the Period starts as the
 * MPD gives them (`@start`, or the previous Period's start plus its `@duration`).
 * A Period whose start cannot be known that way contributes no events.
 */

export type DashEvent = Readonly<{
  id: string;
  startTime: number;
  endTime: number;
  data: ArrayBuffer;
}>;

export type DashEventStream = Readonly<{
  schemeIdUri: string;
  value: string;
  events: ReadonlyArray<DashEvent>;
}>;

/** TS 102 796 §9.3.2.2: a DASH event of 250 ms or less lasts 250 ms, so that no cue is missed. */
export const MINIMUM_CUE_DURATION = 0.25;

const isDashOwnScheme = (schemeIdUri: string): boolean => schemeIdUri.startsWith("urn:mpeg:dash:event:");

/** The `inBandMetadataTrackDispatchType` of an event stream's TextTrack: scheme, a space, value. */
export const dispatchType = (stream: Pick<DashEventStream, "schemeIdUri" | "value">): string =>
  `${stream.schemeIdUri} ${stream.value}`;

/** An `xs:duration` in seconds (`P1DT2H3M4.5S`); `null` if it is not one, or has years or months. */
export const parseDuration = (value: string): number | null => {
  const match =
    /^(-)?P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      value.trim(),
    );
  if (!match || value.trim() === "P" || value.trim().endsWith("T")) return null;
  const [, sign, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  const total = Number(days) * 86_400 + Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds);
  return sign ? -total : total;
};

const numberAttribute = (element: Element, name: string, fallback: number): number => {
  const value = element.getAttribute(name);
  if (value === null || value.trim() === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const utf8 = (text: string): ArrayBuffer => {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

const base64 = (text: string): ArrayBuffer | null => {
  try {
    const binary = atob(text.replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  } catch {
    return null;
  }
};

const ELEMENT_NODE = 1;

const eventData = (event: Element, serialize: (node: Node) => string): ArrayBuffer => {
  const hasElements = Array.from(event.childNodes).some((node) => node.nodeType === ELEMENT_NODE);
  const text = event.textContent ?? "";
  if (hasElements || text === "") return utf8(serialize(event));
  if (event.getAttribute("contentEncoding") === "base64") return base64(text) ?? utf8(text);
  return utf8(text);
};

const children = (parent: Element, name: string): Element[] =>
  Array.from(parent.children).filter((child) => child.localName === name);

/** The event streams of an MPD for the application; none if the document is not an MPD. */
export const mpdEventStreams = (mpd: Document, serialize: (node: Node) => string): DashEventStream[] => {
  const root = mpd.documentElement;
  if (!root || root.localName !== "MPD") return [];

  const streams = new Map<string, { schemeIdUri: string; value: string; events: DashEvent[] }>();
  let previous: { start: number | null; duration: number | null } | null = null;
  for (const period of children(root, "Period")) {
    const startAttribute = period.getAttribute("start");
    const durationAttribute = period.getAttribute("duration");
    const start: number | null =
      startAttribute !== null
        ? parseDuration(startAttribute)
        : previous === null
          ? 0
          : previous.start !== null && previous.duration !== null
            ? previous.start + previous.duration
            : null;
    previous = { start, duration: durationAttribute !== null ? parseDuration(durationAttribute) : null };
    if (start === null) continue;

    for (const eventStream of children(period, "EventStream")) {
      const schemeIdUri = eventStream.getAttribute("schemeIdUri") ?? "";
      if (schemeIdUri === "" || isDashOwnScheme(schemeIdUri)) continue;
      const value = eventStream.getAttribute("value") ?? "";
      const timescale = numberAttribute(eventStream, "timescale", 1) || 1;
      const offset = numberAttribute(eventStream, "presentationTimeOffset", 0);
      const key = dispatchType({ schemeIdUri, value });
      const stream = streams.get(key) ?? { schemeIdUri, value, events: [] };
      streams.set(key, stream);

      for (const event of children(eventStream, "Event")) {
        const startTime = start + (numberAttribute(event, "presentationTime", 0) - offset) / timescale;
        const duration = event.getAttribute("duration");
        const endTime =
          duration === null
            ? Number.MAX_VALUE
            : startTime + Math.max(numberAttribute(event, "duration", 0) / timescale, MINIMUM_CUE_DURATION);
        stream.events.push({
          id: event.getAttribute("id") ?? "",
          startTime,
          endTime,
          data: eventData(event, serialize),
        });
      }
    }
  }
  return [...streams.values()];
};
