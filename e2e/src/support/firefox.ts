/**
 * Launches Firefox with a built extension installed (as a temporary add-on).
 *
 * Playwright cannot load extensions in Firefox; Puppeteer can, through WebDriver
 * BiDi (`webExtension.install`). Uses the system Firefox by default; override with
 * `HBB_EMU_FIREFOX=/path/to/firefox`.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

const FIREFOX_CANDIDATES = ["/usr/bin/firefox", "/usr/bin/firefox-esr", "/snap/bin/firefox"];

const findFirefox = (): string => {
  const fromEnv = process.env.HBB_EMU_FIREFOX;
  if (fromEnv) return fromEnv;
  const found = FIREFOX_CANDIDATES.find(existsSync);
  if (!found) throw new Error(`Firefox not found; set HBB_EMU_FIREFOX (looked in ${FIREFOX_CANDIDATES.join(", ")})`);
  return found;
};

/** Must match `browser_specific_settings.gecko.id` in the manifest. */
const ADDON_ID = "hbbtv-emulator@example.com";
/** Firefox picks a random internal UUID per install: pinned, so tests can open extension pages. */
const ADDON_UUID = "7d1f3c9a-2b4e-4c8d-9f0a-1e2d3c4b5a69";

export type FirefoxWithExtension = Readonly<{
  browser: Browser;
  /** URL of an extension page, e.g. `extensionUrl("index.html")` (the settings UI). */
  extensionUrl: (path: string) => string;
  /** Opens an extension page (e.g. the settings UI) in a new tab. */
  openExtensionPage: (path: string) => Promise<{ page: Page; errors: string[] }>;
  /** A new tab; page errors are collected in `errors`. */
  newPage: () => Promise<{ page: Page; errors: string[] }>;
  close: () => Promise<void>;
}>;

export const launchFirefoxWithExtension = async (extensionDir: string): Promise<FirefoxWithExtension> => {
  if (!existsSync(join(extensionDir, "manifest.json"))) {
    throw new Error(`No built extension in ${extensionDir}: run \`bun run extension:build\` first`);
  }

  const browser = await puppeteer.launch({
    browser: "firefox",
    executablePath: findFirefox(),
    headless: true,
    // Lets tests open and script extension pages, which are privileged.
    args: ["-remote-allow-system-access"],
    extraPrefsFirefox: { "extensions.webextensions.uuids": JSON.stringify({ [ADDON_ID]: ADDON_UUID }) },
  });
  await browser.installExtension(extensionDir);

  const newPage = async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error instanceof Error ? error.message : String(error)));
    return { page, errors };
  };

  const extensionUrl = (path: string) => `moz-extension://${ADDON_UUID}/${path}`;

  /**
   * The navigation works, but Puppeteer never sees the load of a privileged page:
   * the test waits for it from inside the page instead.
   */
  const openExtensionPage = async (path: string) => {
    const opened = await newPage();
    const target = extensionUrl(path);
    void opened.page.goto(target).catch(() => {});
    await opened.page.waitForFunction((url) => location.href === url && document.readyState === "complete", {}, target);
    return opened;
  };

  return {
    browser,
    extensionUrl,
    openExtensionPage,
    newPage,
    close: () => browser.close(),
  };
};
