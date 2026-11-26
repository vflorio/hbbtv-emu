/**
 * Stream event descriptions over broadband (TS 102 796 §8.2.1.1, §9.3.1; TS 102 809 §8.2).
 *
 * `addStreamEventListener()` takes either the URL of a DSM-CC StreamEvent object (in the
 * carousel) or an HTTP(S) URL of an XML file that describes the event:
 *
 *   <dsmcc xmlns="urn:dvb:mis:dsmcc:2009">
 *     <dsmcc_object component_tag="2">
 *       <stream_event stream_event_id="1" stream_event_name="sevent"/>
 *     </dsmcc_object>
 *   </dsmcc>
 *
 * The terminal fetches the file and looks the event up by name; the events themselves come
 * from the elementary stream the component tag points to, i.e. from the broadcast (here, the
 * scenario's schedule). A file that cannot be fetched or read, or that does not describe the
 * event, makes the terminal dispatch an event with status "error" (§8.2.1.2).
 *
 * §9.3.1 restricts the file: `stream_event_id` is an unsigned short, `component_tag` an
 * unsigned byte, and the file is served as `application/vnd.dvb.streamevent+xml`. These are
 * rules for whoever serves it: an entry that breaks them does not describe an event, and a
 * wrong content type is only reported (in the log), since terminals are not required to check it.
 */

import { createLogger } from "@hbb-emu/core";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";

const logger = createLogger("StreamEventDescription");

export const STREAM_EVENT_DESCRIPTION_MIME_TYPE = "application/vnd.dvb.streamevent+xml";

/** A description file as fetched: its content type (if any) and its text. */
export type StreamEventDescriptionFile = Readonly<{ contentType: string | null; body: string }>;

/**
 * Fetches a description file. A TV does it natively (no CORS): the host's fetch where there
 * is one, the page's otherwise. The error is a reason, for the log.
 */
export type FetchStreamEventDescription = (url: string) => TE.TaskEither<string, StreamEventDescriptionFile>;

/** An event the description names. */
export type DescribedStreamEvent = Readonly<{ name: string; id: number; componentTag: number }>;

/**
 * The absolute URL of a description fetched over broadband, if `targetURL` is one: an HTTP(S)
 * URL, or a relative one in a document loaded over HTTP(S). Anything else is a DSM-CC object.
 */
export const broadbandDescriptionUrl = (targetURL: string, baseURI: string): O.Option<string> => {
  try {
    const url = new URL(targetURL, baseURI);
    return url.protocol === "http:" || url.protocol === "https:" ? O.some(url.href) : O.none;
  } catch {
    return O.none;
  }
};

const unsignedInteger = (value: string | null, max: number): O.Option<number> =>
  value !== null && /^\s*\d+\s*$/.test(value) && Number(value) <= max ? O.some(Number(value)) : O.none;

/** The elements of the document with that local name, whatever their namespace. */
const elements = (parent: Document | Element, localName: string): ReadonlyArray<Element> =>
  Array.from(parent.getElementsByTagNameNS("*", localName));

/**
 * The events a description names. Fails if it is not XML, or not a `dsmcc` document. Entries
 * whose id or component tag break §9.3.1 are left out.
 */
export const parseStreamEventDescription = (xml: string): E.Either<string, ReadonlyArray<DescribedStreamEvent>> => {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (elements(document, "parsererror").length > 0) return E.left("it is not well-formed XML");
  if (document.documentElement.localName !== "dsmcc") {
    return E.left(`its root is <${document.documentElement.localName}>, not <dsmcc>`);
  }
  return E.right(
    elements(document, "dsmcc_object").flatMap((object) =>
      elements(object, "stream_event").flatMap((event) =>
        pipe(
          O.Do,
          O.bind("componentTag", () => unsignedInteger(object.getAttribute("component_tag"), 255)),
          O.bind("id", () => unsignedInteger(event.getAttribute("stream_event_id"), 65535)),
          O.bind("name", () => O.fromNullable(event.getAttribute("stream_event_name"))),
          O.match(
            () => [],
            (described) => [described],
          ),
        ),
      ),
    ),
  );
};

const mediaType = (contentType: string | null): string | null =>
  contentType === null ? null : (contentType.split(";")[0]?.trim().toLowerCase() ?? null);

/**
 * The event named `eventName` in the description at `url` (absolute). Fails, with the reason,
 * when the file cannot be fetched or read, or does not describe the event.
 */
export const describeStreamEvent =
  (fetchDescription: FetchStreamEventDescription) =>
  (url: string, eventName: string): TE.TaskEither<string, DescribedStreamEvent> =>
    pipe(
      fetchDescription(url),
      TE.tapIO(({ contentType }) =>
        mediaType(contentType) === STREAM_EVENT_DESCRIPTION_MIME_TYPE
          ? logger.debug("Fetched", url)
          : logger.warn(
              `${url} is served as ${contentType ?? "no content type"}, not ${STREAM_EVENT_DESCRIPTION_MIME_TYPE} (TS 102 796 §9.3.1)`,
            ),
      ),
      TE.flatMapEither(({ body }) => parseStreamEventDescription(body)),
      TE.flatMap((events) =>
        pipe(
          events.find((event) => event.name === eventName),
          TE.fromNullable(`it does not describe an event named "${eventName}"`),
        ),
      ),
      TE.mapLeft((reason) => `${url}: ${reason}`),
    );

/** The page fetches the file itself: subject to CORS, unlike a TV. Used without a host. */
export const fetchFromPage: FetchStreamEventDescription = (url) =>
  TE.tryCatch(
    async () => {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { contentType: response.headers.get("content-type"), body: await response.text() };
    },
    (error) => (error instanceof Error ? error.message : String(error)),
  );
