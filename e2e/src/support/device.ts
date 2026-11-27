/**
 * A TV of the e2e tests, as the settings UI saves it (`device.terminal`, TS 102 796
 * §7.3.2.4). HbbTV 1.5: its User-Agent has no family, which the state keeps anyway.
 */
export const E2E_TERMINAL = {
  hbbtvVersion: "1.5",
  options: ["+DRM"],
  vendorName: "e2e",
  modelName: "TV",
  softwareVersion: "1.0",
  familyName: "org.hbbtv-emu.e2e",
  browser: "Mozilla/5.0 (Linux; e2e) e2e-TV",
};
