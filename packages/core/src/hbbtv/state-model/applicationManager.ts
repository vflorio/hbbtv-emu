/**
 * Application Manager State
 *
 * State for the OIPF ApplicationManager and Application objects.
 *
 * @module hbbtv/state-model/applicationManager
 */

import * as t from "io-ts";

// ─────────────────────────────────────────────────────────────────────────────
// Keyset State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keyset mask values (bitfields).
 */
export const KeysetMaskCodec = t.union([
  t.literal(0x00), // NONE
  t.literal(0x01), // NAVIGATION
  t.literal(0x02), // NAVIGATION_AND_COLOR
  t.literal(0x04), // PLAYBACK
  t.literal(0xff), // ALL
  t.number, // Custom mask combinations
]);

export type KeysetMask = t.TypeOf<typeof KeysetMaskCodec>;

/**
 * Keyset state.
 *
 * Controls which remote-control keys are captured by the HbbTV application.
 */
export const KeysetStateCodec = t.partial({
  /** Current keyset mask value */
  value: t.number,
});

export type KeysetState = t.TypeOf<typeof KeysetStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Application State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Application visibility state.
 */
export const ApplicationVisibilityCodec = t.union([t.literal("visible"), t.literal("hidden")]);

export type ApplicationVisibility = t.TypeOf<typeof ApplicationVisibilityCodec>;

/**
 * Application lifecycle state.
 */
export const ApplicationLifecycleCodec = t.union([t.literal("active"), t.literal("inactive"), t.literal("destroyed")]);

export type ApplicationLifecycle = t.TypeOf<typeof ApplicationLifecycleCodec>;

/**
 * Single application state.
 *
 * Represents the state of an HbbTV application instance.
 */
export const ApplicationStateCodec = t.partial({
  /** Application identifier */
  id: t.string,

  /** Application name */
  name: t.string,

  /** Application URL */
  url: t.string,

  /** Visibility state */
  visibility: ApplicationVisibilityCodec,

  /** Lifecycle state */
  lifecycle: ApplicationLifecycleCodec,

  /** Keyset configuration */
  keyset: KeysetStateCodec,

  /** Private data store (key-value pairs) */
  privateData: t.record(t.string, t.unknown),
});

export type ApplicationState = t.TypeOf<typeof ApplicationStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Application Manager State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Application Manager state.
 *
 * Contains all application instances and manager-level settings.
 */
export const ApplicationManagerStateCodec = t.partial({
  /** Currently active (owner) application */
  ownerApplication: ApplicationStateCodec,

  /** All registered applications (keyed by app ID) */
  applications: t.record(t.string, ApplicationStateCodec),

  /** Video transparency setting */
  videoTransparency: t.boolean,
});

export type ApplicationManagerState = t.TypeOf<typeof ApplicationManagerStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_KEYSET_VALUE = 0x00; // No keys captured by default

export const DEFAULT_KEYSET: NonNullable<KeysetState> = {
  value: DEFAULT_KEYSET_VALUE,
};

export const DEFAULT_VISIBILITY: NonNullable<ApplicationState["visibility"]> = "visible";

export const DEFAULT_LIFECYCLE: NonNullable<ApplicationState["lifecycle"]> = "active";

export const DEFAULT_PRIVATE_DATA: NonNullable<ApplicationState["privateData"]> = {};

export const DEFAULT_APPLICATION: NonNullable<ApplicationState> = {
  visibility: DEFAULT_VISIBILITY,
  lifecycle: DEFAULT_LIFECYCLE,
  keyset: DEFAULT_KEYSET,
  privateData: DEFAULT_PRIVATE_DATA,
};

export const DEFAULT_APPLICATIONS: NonNullable<ApplicationManagerState["applications"]> = {};

export const DEFAULT_VIDEO_TRANSPARENCY: NonNullable<ApplicationManagerState["videoTransparency"]> = false;

export const DEFAULT_APPLICATION_MANAGER: NonNullable<ApplicationManagerState> = {
  ownerApplication: DEFAULT_APPLICATION,
  applications: DEFAULT_APPLICATIONS,
  videoTransparency: DEFAULT_VIDEO_TRANSPARENCY,
};
