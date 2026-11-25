/**
 * Application Information Table (AIT): which applications a broadcast service
 * signals, and how the terminal treats each of them.
 *
 * ETSI TS 102 809 §5.3 (AIT), HbbTV TS 102 796 §7.2.3 (its use in HbbTV).
 * The emulator keeps one AIT per channel, already decoded: the fields that decide
 * which application runs and where it is loaded from. More of the table
 * (visibility, service_bound_flag, boundary descriptors, version) comes with the
 * application lifecycle on channel change.
 */

import * as t from "io-ts";

// ─────────────────────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `application_control_code` for HbbTV applications (TS 102 796 §7.2.3.1, Table 7),
 * named as in the XML AIT (TS 102 809 §5.4): 0x01 AUTOSTART, 0x02 PRESENT,
 * 0x04 KILL, 0x07 DISABLED.
 */
export const AitControlCodeCodec = t.union([
  /** Started by the terminal when the service is selected. */
  t.literal("AUTOSTART"),
  /** Runnable, but only started on request (another application, the user). */
  t.literal("PRESENT"),
  /** To be stopped if running. */
  t.literal("KILL"),
  /** Neither started nor allowed to start. */
  t.literal("DISABLED"),
]);

export type AitControlCode = t.TypeOf<typeof AitControlCodeCodec>;

export const AitApplicationCodec = t.intersection([
  t.type({
    /** `organisation_id` (32 bits): who the application belongs to. */
    orgId: t.number,
    /** `application_id` (16 bits): the application, within its organisation. */
    appId: t.number,
    controlCode: AitControlCodeCodec,
    /**
     * Where the application is loaded from: the transport protocol descriptor's URL
     * base joined with the simple application location descriptor.
     */
    url: t.string,
  }),
  t.partial({
    /** `application_name_descriptor`. */
    name: t.string,
    /** `application_priority` (0–255) of the application descriptor. Default 0. */
    priority: t.number,
  }),
]);

export type AitApplication = t.TypeOf<typeof AitApplicationCodec>;

export const AitCodec = t.type({
  applications: t.array(AitApplicationCodec),
});

export type Ait = t.TypeOf<typeof AitCodec>;

/** Anything that carries an AIT, e.g. a channel of the lineup. */
export type WithAit = Readonly<{ ait?: Ait }>;

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/** Applications the terminal may run: signalled as AUTOSTART or PRESENT. */
const isRunnable = (application: AitApplication): boolean =>
  application.controlCode === "AUTOSTART" || application.controlCode === "PRESENT";

const priorityOf = (application: AitApplication): number => application.priority ?? 0;

/** What identifies an application across services: its organisation and application ids. */
export type AitApplicationId = Readonly<{ orgId: number; appId: number }>;

export const applicationIdOf = ({ orgId, appId }: AitApplication): AitApplicationId => ({ orgId, appId });

/**
 * Whether the AIT signals this application as runnable (AUTOSTART or PRESENT).
 * On a channel change, a running broadcast-related application the new service
 * signals keeps running; any other is stopped (TS 102 796 §6.2.2.2, assuming
 * `service_bound_flag` = 0, which the emulator does not model yet).
 */
export const signalsApplication = (ait: Ait | undefined, id: AitApplicationId): boolean =>
  (ait?.applications ?? []).some(
    (application) => isRunnable(application) && application.orgId === id.orgId && application.appId === id.appId,
  );

/**
 * The application the terminal starts when the service is selected: the AUTOSTART
 * one with the highest priority (the first signalled among equals). `null` when the
 * service signals none: the TV then shows the broadcast alone.
 */
export const autostartApplication = (ait: Ait | undefined): AitApplication | null =>
  (ait?.applications ?? [])
    .filter((application) => application.controlCode === "AUTOSTART")
    .reduce<AitApplication | null>(
      (best, application) => (best === null || priorityOf(application) > priorityOf(best) ? application : best),
      null,
    );

const parse = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

/** A URL without its fragment: a page and its anchors are the same document. */
const documentUrl = (url: URL): string => url.href.slice(0, url.href.length - url.hash.length);

/**
 * How a page relates to a signalled application:
 * - `entry`: it is the application's own URL (fragment aside);
 * - `boundary`: same origin, i.e. inside the application boundary, which by default
 *   is the origin of the application's URL (TS 102 796 §6.3.1, without the extra
 *   origins of a simple_application_boundary_descriptor).
 */
type Match = "entry" | "boundary";

const matchOf = (application: AitApplication, page: URL): Match | null => {
  const entry = parse(application.url);
  if (entry === null) return null;
  if (documentUrl(entry) === documentUrl(page)) return "entry";
  return entry.origin === page.origin ? "boundary" : null;
};

/**
 * The channel whose AIT signals the application a page belongs to, i.e. the service
 * the application is broadcast-related to. A channel signalling the page's own URL
 * wins over one whose application only shares its origin; the first of the lineup
 * among equals. `null` when no channel signals a runnable application for it.
 */
export const channelSignalling = <Channel extends WithAit>(
  channels: ReadonlyArray<Channel>,
  pageUrl: string,
): Channel | null => {
  const page = parse(pageUrl);
  if (page === null) return null;

  let boundaryMatch: Channel | null = null;
  for (const channel of channels) {
    for (const application of channel.ait?.applications ?? []) {
      if (!isRunnable(application)) continue;
      const match = matchOf(application, page);
      if (match === "entry") return channel;
      if (match === "boundary" && boundaryMatch === null) boundaryMatch = channel;
    }
  }
  return boundaryMatch;
};
