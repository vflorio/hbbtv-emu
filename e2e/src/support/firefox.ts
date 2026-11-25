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

export type FirefoxWithExtension = Readonly<{
  browser: Browser;
  /** A new tab; page errors are collected in `errors`. */
  newPage: () => Promise<{ page: Page; errors: string[] }>;
  close: () => Promise<void>;
}>;

export const launchFirefoxWithExtension = async (extensionDir: string): Promise<FirefoxWithExtension> => {
  if (!existsSync(join(extensionDir, "manifest.json"))) {
    throw new Error(`No built extension in ${extensionDir}: run \`bun run extension:build\` first`);
  }

  const browser = await puppeteer.launch({ browser: "firefox", executablePath: findFirefox(), headless: true });
  await browser.installExtension(extensionDir);

  const newPage = async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error instanceof Error ? error.message : String(error)));
    return { page, errors };
  };

  return { browser, newPage, close: () => browser.close() };
};
