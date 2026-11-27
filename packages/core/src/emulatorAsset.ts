/**
 * Files the emulator ships with (the broadcast's test card, for one), named in the state
 * by a URL of their own: `hbbtv-emu:broadcast/test-card.mp4`. Their real URL is the host's,
 * and an extension's differs from one install to another (Firefox's `moz-extension://`
 * UUID is random): the host resolves them where the configuration leaves it.
 */

export const EMULATOR_ASSET_SCHEME = "hbbtv-emu:";

/** The URL, in the state, of a file the emulator ships at `path`. */
export const emulatorAsset = (path: string): string => `${EMULATOR_ASSET_SCHEME}${path}`;

/** Whether `url` names a file the emulator ships, not yet at its URL on the host. */
export const isEmulatorAsset = (url: string): boolean => url.startsWith(EMULATOR_ASSET_SCHEME);

/** `url`, or, for a file the emulator ships, its URL on the host (`assetUrl` of its path). */
export const resolveEmulatorAsset = (url: string, assetUrl: (path: string) => string): string =>
  url.startsWith(EMULATOR_ASSET_SCHEME) ? assetUrl(url.slice(EMULATOR_ASSET_SCHEME.length)) : url;
