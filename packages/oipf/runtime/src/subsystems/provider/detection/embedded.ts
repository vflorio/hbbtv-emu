/**
 * Embedded visual attach: the emulated video is rendered *inside* the `<object>`.
 * For video/broadcast it is the TV's broadcast, which the object holds while it
 * controls it (`subsystems/broadcastLayer.ts`).
 *
 * An `<object>` whose type the browser cannot handle (e.g. `video/broadcast`)
 * renders its children as fallback content, inside the object's own box. So
 * whatever the application uses to lay out the object — inline style, stylesheet
 * rules, `width`/`height` attributes, positioning, z-index, `display: none` — applies
 * natively, exactly as on a TV where the object is a replaced element.
 * Verified on Chromium 155 and Firefox 158 (legacy engines still to verify).
 *
 * The video fills the object box; in full-screen it becomes `position: fixed`
 * over the viewport, which keeps the object's stacking context (and z-index).
 */

import type * as IO from "fp-ts/IO";

/** Marks the emulator's video element mounted inside an object. */
export const EMBEDDED_VIDEO_ATTRIBUTE = "data-hbbtv-emu-video";

/** Present on the object while it is in full-screen. */
export const FULLSCREEN_ATTRIBUTE = "data-hbbtv-emu-fullscreen";

/** Marks the emulator's stylesheet, so it is injected once per document. */
export const EMBEDDED_STYLES_ATTRIBUTE = "data-hbbtv-emu-styles";

/**
 * - The object behaves like a replaced element: `width`/`height` apply even when it
 *   would otherwise be inline. Application rules with an id or a class still win;
 *   a bare `object { display: … }` rule does not (attribute selector specificity).
 * - The video ignores application rules on `video` elements.
 */
export const EMBEDDED_STYLES = `
object[type="video/broadcast"] { display: inline-block; }
[${EMBEDDED_VIDEO_ATTRIBUTE}] {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: #000 !important;
  object-fit: contain;
}
[${FULLSCREEN_ATTRIBUTE}] > [${EMBEDDED_VIDEO_ATTRIBUTE}] {
  position: fixed !important;
  left: 0 !important;
  top: 0 !important;
}
`;

/**
 * Injects the emulator stylesheet once per document, before the application's
 * own stylesheets so that, at equal specificity, the application wins.
 */
export const ensureEmbeddedStyles =
  (document: Document): IO.IO<void> =>
  () => {
    if (document.querySelector(`style[${EMBEDDED_STYLES_ATTRIBUTE}]`)) return;

    const style = document.createElement("style");
    style.setAttribute(EMBEDDED_STYLES_ATTRIBUTE, "");
    style.textContent = EMBEDDED_STYLES;

    const parent = document.head ?? document.documentElement;
    parent.insertBefore(style, parent.firstChild);
  };
