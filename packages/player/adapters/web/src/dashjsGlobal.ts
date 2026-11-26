/**
 * dash.js's globals, kept out of the application's page.
 *
 * Evaluated in a window, the `dash.all` bundle publishes itself as `window.dashjs`
 * (adding to the object there, if any), and creates a player of its own at `load` for
 * every `[data-dashjs-player]` and every `<video>` with a `<source
 * type="application/dash+xml">`, unless `window.dashjs.skipAutoCreate` is set at that
 * moment. In the application's page those players would compete with the emulator's
 * (`installMediaElementDash`) for the same element, and the application would find a
 * `window.dashjs` it did not load. Imported before `dashjs` (`./dashjs`), this sets the
 * flag; `restoreDashGlobal()` then removes `window.dashjs`, flag and dash.js together.
 */

type DashGlobal = { dashjs?: unknown };

const target: DashGlobal | undefined = typeof window === "undefined" ? undefined : (window as DashGlobal);
const added = target !== undefined && target.dashjs === undefined;
if (added) target.dashjs = { skipAutoCreate: true };

export const restoreDashGlobal = (): void => {
  if (added) delete target?.dashjs;
};
