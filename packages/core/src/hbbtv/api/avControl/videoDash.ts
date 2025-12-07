/**
 * Video DASH A/V Control Object
 *
 * Type definitions and validators for <object type="application/dash+xml"> embedded objects.
 */

export const MIME_TYPE = "application/dash+xml" as const;

export const isValidElement = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.type === MIME_TYPE;
