/**
 * Video MP4 A/V Control Object
 *
 * Type definitions and validators for <object type="video/mp4"> embedded objects.
 */

export const MIME_TYPE = "video/mp4" as const;

export const isValidElement = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.type === MIME_TYPE;
