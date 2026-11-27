import { describe, expect, it } from "vitest";
import { emulatorAsset, resolveEmulatorAsset } from "./emulatorAsset";

const assetUrl = (path: string) => `moz-extension://4b1e7c2a/${path}`;

describe("emulator assets", () => {
  it("are named by a URL of their own, which the host resolves to its own", () => {
    expect(emulatorAsset("broadcast/test-card.mp4")).toBe("hbbtv-emu:broadcast/test-card.mp4");
    expect(resolveEmulatorAsset("hbbtv-emu:broadcast/test-card.mp4", assetUrl)).toBe(
      "moz-extension://4b1e7c2a/broadcast/test-card.mp4",
    );
  });

  it("leave every other URL as it is", () => {
    expect(resolveEmulatorAsset("https://cdn.example/live.mpd", assetUrl)).toBe("https://cdn.example/live.mpd");
  });
});
