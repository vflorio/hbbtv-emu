/**
 * The files the emulator ships with the extension (the broadcast's test card), as pages
 * load them: web accessible resources at the extension's URL, which differs from one
 * install to another (Firefox's `moz-extension://` UUID is random).
 */
export interface AssetsAdapter {
  /** The URL of the file at `path` in the extension. */
  readonly url: (path: string) => string;
}

/** @since Chrome 58 / Firefox 45 (`runtime.getURL`) */
export const createAssetsAdapter = (): AssetsAdapter => ({
  url: (path) => chrome.runtime.getURL(path),
});
