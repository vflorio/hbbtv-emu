/**
 * Launches Chromium with a built extension loaded.
 *
 * Uses the system Chromium by default (no browser download); override with
 * `HBB_EMU_CHROMIUM=/path/to/chromium`. Branded Google Chrome ignores
 * `--load-extension` since v137, so it has to be Chromium.
 */

import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BrowserContext, chromium } from "playwright";

const CHROMIUM_CANDIDATES = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"];

const findChromium = (): string => {
  const fromEnv = process.env.HBB_EMU_CHROMIUM;
  if (fromEnv) return fromEnv;
  const found = CHROMIUM_CANDIDATES.find(existsSync);
  if (!found) throw new Error(`Chromium not found; set HBB_EMU_CHROMIUM (looked in ${CHROMIUM_CANDIDATES.join(", ")})`);
  return found;
};

export type ExtensionBrowser = Readonly<{
  context: BrowserContext;
  close: () => Promise<void>;
}>;

export const launchWithExtension = async (extensionDir: string): Promise<ExtensionBrowser> => {
  if (!existsSync(join(extensionDir, "manifest.json"))) {
    throw new Error(`No built extension in ${extensionDir}: run \`bun run extension:build\` first`);
  }

  const userDataDir = await mkdtemp(join(tmpdir(), "hbb-emu-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: findChromium(),
    headless: true,
    viewport: { width: 1280, height: 720 },
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });

  // The MV3 service worker starts asynchronously; wait for it so the
  // declarativeNetRequest rules are active before the first navigation.
  if (context.serviceWorkers().length === 0) await context.waitForEvent("serviceworker");

  return {
    context,
    close: async () => {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
};
