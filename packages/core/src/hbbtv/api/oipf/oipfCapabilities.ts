/* ----------------------------------------------------------------------
 * application/oipfCapabilities
 * -------------------------------------------------------------------- */

/** Capabilities object (oipfCapabilities) describing device features. */
export interface Capabilities {
  /** HbbTV version supported (e.g., "2.0.1"). */
  hbbtvVersion?: string;

  /** UI profile identifiers (text, video profiles). */
  uiProfiles?: string[];

  /** Supported DRM systems. */
  drmSystems?: string[];

  /** Supported media formats and codecs. */
  mediaFormats?: Array<{
    container?: string;
    videoCodecs?: string[];
    audioCodecs?: string[];
    subtitleFormats?: string[];
  }>;

  /** Query method for capability strings. */
  hasCapability?(capability: string): boolean;
}

export const MIME_TYPE = "application/oipfCapabilities" as const;

export const isValidElement = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.type === MIME_TYPE;
