/* ----------------------------------------------------------------------
 * application/oipfCapabilities
 * -------------------------------------------------------------------- */

/**
 * The application/oipfCapabilities object (OIPF DAE §7.15.3), as HbbTV profiles it
 * (TS 102 796 Annex A, A.2.30). `extraSDVideoDecodes`, `extraHDVideoDecodes` and
 * `extraUHDVideoDecodes` are not there yet.
 */
export interface Capabilities {
  /**
   * The terminal's capability description (§7.15.3.1): an XML document whose root is
   * `<profilelist>` (TS 102 796 §10.2.4), with no document type (§10.2.4.6).
   */
  readonly xmlCapabilities: Document;

  /** Whether the terminal supports a profile: an option string, a UI profile name (§7.15.3.2). */
  hasCapability(profileName: string): boolean;
}

export const MIME_TYPE = "application/oipfCapabilities" as const;

export const isValidElement = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.type === MIME_TYPE;
