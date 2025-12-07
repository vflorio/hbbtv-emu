import {
  createLogger,
  DEFAULT_DRM_SYSTEMS,
  DEFAULT_HBBTV_VERSION,
  DEFAULT_MEDIA_FORMATS,
  DEFAULT_UI_PROFILES,
  type OIPF,
} from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RA from "fp-ts/ReadonlyArray";

const logger = createLogger("OipfCapabilities");

// ─────────────────────────────────────────────────────────────────────────────
// Capability Strings
// ─────────────────────────────────────────────────────────────────────────────

/** Known capability strings that can be queried via hasCapability() */
const KNOWN_CAPABILITIES: ReadonlySet<string> = new Set([
  "video/broadcast",
  "video/mpeg",
  "video/mp4",
  "video/webm",
  "application/dash+xml",
  "application/oipfApplicationManager",
  "application/oipfCapabilities",
  "application/oipfConfiguration",
  "+DVB_T",
  "+DVB_T2",
  "+DVB_C",
  "+DVB_C2",
  "+DVB_S",
  "+DVB_S2",
  "+TRICKMODE",
]);

const isKnownCapability = (capability: string): boolean => KNOWN_CAPABILITIES.has(capability);

// ─────────────────────────────────────────────────────────────────────────────
// Capabilities Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class OipfCapabilities implements OIPF.Capabilities.Capabilities {
  hbbtvVersion = DEFAULT_HBBTV_VERSION;
  uiProfiles = [...DEFAULT_UI_PROFILES];
  drmSystems = [...DEFAULT_DRM_SYSTEMS];
  mediaFormats = [...DEFAULT_MEDIA_FORMATS];

  hasCapability = (capability: string): boolean =>
    pipe(
      logger.debug("hasCapability:", capability),
      IO.map(() => {
        // Check in known capabilities
        if (isKnownCapability(capability)) {
          return true;
        }

        // Check in UI profiles
        if (
          pipe(
            this.uiProfiles,
            RA.some((p) => p === capability),
          )
        ) {
          return true;
        }

        // Check in DRM systems
        if (
          pipe(
            this.drmSystems,
            RA.some((d) => d === capability),
          )
        ) {
          return true;
        }

        // Check in media formats (container or codec)
        const hasInMediaFormats = pipe(
          this.mediaFormats,
          RA.some(
            (format) =>
              format.container === capability ||
              (format.videoCodecs?.includes(capability) ?? false) ||
              (format.audioCodecs?.includes(capability) ?? false),
          ),
        );

        return hasInMediaFormats;
      }),
    )();
}
