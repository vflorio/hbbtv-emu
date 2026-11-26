import { expect, it } from "vitest";
import { dashjs } from "./dashjs";

// That no player is created at `load` is seen in e2e (`dash-app`): jsdom's document is
// already complete when dash.js is evaluated, and dash.js does not wait for `load` then.
it("dash.js leaves the application no window.dashjs", () => {
  expect(dashjs.MediaPlayer).toBeTypeOf("function");
  expect("dashjs" in window).toBe(false);
});
