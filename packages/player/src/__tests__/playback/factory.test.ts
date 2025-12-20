/**
 * Tests for playback factory
 */

import * as E from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { DASHPlayback } from "../../playback/engines/dash";
import { HLSPlayback } from "../../playback/engines/hls";
import { NativePlayback } from "../../playback/engines/native";
import { Playback } from "../../playback/factory";

describe("Playback Factory", () => {
  describe("detectType", () => {
    it("should detect HLS from .m3u8 extension", () => {
      const type = Playback.detectType("https://example.com/stream.m3u8");
      expect(type).toBe("hls");
    });

    it("should detect HLS from .m3u8 with query params", () => {
      const type = Playback.detectType("https://example.com/stream.m3u8?token=abc");
      expect(type).toBe("hls");
    });

    it("should detect DASH from .mpd extension", () => {
      const type = Playback.detectType("https://example.com/stream.mpd");
      expect(type).toBe("dash");
    });

    it("should detect DASH from .mpd with query params", () => {
      const type = Playback.detectType("https://example.com/stream.mpd?token=abc");
      expect(type).toBe("dash");
    });

    it("should detect native from .mp4 extension", () => {
      const type = Playback.detectType("https://example.com/video.mp4");
      expect(type).toBe("native");
    });

    it("should detect native from .webm extension", () => {
      const type = Playback.detectType("https://example.com/video.webm");
      expect(type).toBe("native");
    });

    it("should detect native from .ogg extension", () => {
      const type = Playback.detectType("https://example.com/video.ogg");
      expect(type).toBe("native");
    });

    it("should default to native for unknown extensions", () => {
      const type = Playback.detectType("https://example.com/video.unknown");
      expect(type).toBe("native");
    });

    it("should default to native for URLs without extension", () => {
      const type = Playback.detectType("https://example.com/video");
      expect(type).toBe("native");
    });
  });

  describe("create", () => {
    it("should create NativePlayback for MP4 source", async () => {
      const result = await Playback.create("https://example.com/video.mp4")();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(NativePlayback);
        expect(result.right._tag).toBe("native");
        expect(result.right.source).toBe("https://example.com/video.mp4");
      }
    });

    it("should create HLSPlayback for M3U8 source", async () => {
      const result = await Playback.create("https://example.com/stream.m3u8")();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(HLSPlayback);
        expect(result.right._tag).toBe("hls");
        expect(result.right.source).toBe("https://example.com/stream.m3u8");
      }
    });

    it("should create DASHPlayback for MPD source", async () => {
      const result = await Playback.create("https://example.com/stream.mpd")();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(DASHPlayback);
        expect(result.right._tag).toBe("dash");
        expect(result.right.source).toBe("https://example.com/stream.mpd");
      }
    });

    it("should respect forceType parameter", async () => {
      // Force HLS even though source looks like MP4
      const result = await Playback.create("https://example.com/video.mp4", undefined, "hls")();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(HLSPlayback);
        expect(result.right._tag).toBe("hls");
      }
    });

    it("should merge custom config with defaults", async () => {
      const customConfig = {
        native: { preload: "auto" as const },
      };

      const result = await Playback.create("https://example.com/video.mp4", customConfig)();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        const native = result.right as NativePlayback;
        expect(native.source).toBe("https://example.com/video.mp4");
      }
    });
  });

  describe("createNative", () => {
    it("should create NativePlayback instance", () => {
      const result = Playback.createNative("https://example.com/video.mp4", {
        preload: "metadata",
        autoplay: false,
      });

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(NativePlayback);
        expect(result.right.source).toBe("https://example.com/video.mp4");
        expect(result.right._tag).toBe("native");
        expect(result.right.name).toBe("Native HTML5");
      }
    });

    it("should use provided configuration", () => {
      const result = Playback.createNative("https://example.com/video.mp4", {
        preload: "auto",
        autoplay: true,
      });

      expect(E.isRight(result)).toBe(true);
    });
  });

  describe("createHLS", () => {
    it("should create HLSPlayback instance", () => {
      const result = Playback.createHLS("https://example.com/stream.m3u8", {
        autoStartLoad: true,
        startLevel: -1,
        debug: false,
      });

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(HLSPlayback);
        expect(result.right.source).toBe("https://example.com/stream.m3u8");
        expect(result.right._tag).toBe("hls");
        expect(result.right.name).toBe("HLS.js");
      }
    });

    it("should use provided configuration", () => {
      const result = Playback.createHLS("https://example.com/stream.m3u8", {
        autoStartLoad: false,
        startLevel: 2,
        debug: true,
      });

      expect(E.isRight(result)).toBe(true);
    });
  });

  describe("createDASH", () => {
    it("should create DASHPlayback instance", () => {
      const result = Playback.createDASH("https://example.com/stream.mpd", {
        debug: false,
        streaming: {
          bufferTimeDefault: 12,
          bufferTimeMax: 20,
        },
      });

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(DASHPlayback);
        expect(result.right.source).toBe("https://example.com/stream.mpd");
        expect(result.right._tag).toBe("dash");
        expect(result.right.name).toBe("dash.js");
      }
    });
  });

  describe("createWithDefaults", () => {
    it("should create playback with default config", async () => {
      const result = await Playback.createWithDefaults("https://example.com/video.mp4")();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(NativePlayback);
      }
    });

    it("should merge overrides with defaults", async () => {
      const overrides = {
        native: { preload: "auto" as const },
        hls: { debug: true },
      };

      const result = await Playback.createWithDefaults("https://example.com/video.mp4", overrides)();

      expect(E.isRight(result)).toBe(true);
    });

    it("should work for HLS sources", async () => {
      const result = await Playback.createWithDefaults("https://example.com/stream.m3u8")();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right).toBeInstanceOf(HLSPlayback);
      }
    });
  });

  describe("defaultConfig", () => {
    it("should have sensible defaults for native", () => {
      expect(Playback.defaultConfig.native.preload).toBe("metadata");
      expect(Playback.defaultConfig.native.autoplay).toBe(false);
    });

    it("should have sensible defaults for HLS", () => {
      expect(Playback.defaultConfig.hls.autoStartLoad).toBe(true);
      expect(Playback.defaultConfig.hls.startLevel).toBe(-1);
      expect(Playback.defaultConfig.hls.debug).toBe(false);
    });

    it("should have sensible defaults for DASH", () => {
      expect(Playback.defaultConfig.dash.debug).toBe(false);
      expect(Playback.defaultConfig.dash.streaming?.bufferTimeDefault).toBe(12);
      expect(Playback.defaultConfig.dash.streaming?.bufferTimeMax).toBe(20);
    });
  });
});
