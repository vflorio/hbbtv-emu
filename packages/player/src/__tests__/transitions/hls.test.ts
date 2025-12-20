/**
 * Tests for HLS-specific transition functions
 */

import * as E from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { type HLSVariant, PlayerState } from "../../state";
import * as HLSTransitions from "../../transitions/hls";

describe("Transitions - HLS", () => {
  describe("parseHLSManifest", () => {
    it("should parse HLS manifest and return ManifestParsed state", async () => {
      const manifestLoading = new PlayerState.Source.HLS.ManifestLoading("https://example.com/stream.m3u8");

      const result = await HLSTransitions.parseHLSManifest(manifestLoading)();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        const parsed = result.right;
        expect(parsed).toBeInstanceOf(PlayerState.Source.HLS.ManifestParsed);
        expect(parsed.url).toBe("https://example.com/stream.m3u8");
        expect(parsed.variants).toHaveLength(2);
        expect(parsed.duration).toBeGreaterThan(0);
      }
    });

    it("should include quality variants with different resolutions", async () => {
      const manifestLoading = new PlayerState.Source.HLS.ManifestLoading("https://example.com/stream.m3u8");

      const result = await HLSTransitions.parseHLSManifest(manifestLoading)();

      if (E.isRight(result)) {
        const variants = result.right.variants;

        // Should have 1080p variant
        const variant1080 = variants.find((v) => v.resolution.height === 1080);
        expect(variant1080).toBeDefined();
        expect(variant1080?.bandwidth).toBe(5000000);
        expect(variant1080?.resolution).toEqual({ width: 1920, height: 1080 });

        // Should have 720p variant
        const variant720 = variants.find((v) => v.resolution.height === 720);
        expect(variant720).toBeDefined();
        expect(variant720?.bandwidth).toBe(2500000);
        expect(variant720?.resolution).toEqual({ width: 1280, height: 720 });
      }
    });

    it("should include variant URLs based on base URL", async () => {
      const manifestLoading = new PlayerState.Source.HLS.ManifestLoading("https://cdn.example.com/video");

      const result = await HLSTransitions.parseHLSManifest(manifestLoading)();

      if (E.isRight(result)) {
        const variants = result.right.variants;
        expect(variants[0].url).toContain("https://cdn.example.com/video");
        expect(variants[0].url).toContain("variant-1080p.m3u8");
        expect(variants[1].url).toContain("variant-720p.m3u8");
      }
    });

    it("should include codec information", async () => {
      const manifestLoading = new PlayerState.Source.HLS.ManifestLoading("https://example.com/stream.m3u8");

      const result = await HLSTransitions.parseHLSManifest(manifestLoading)();

      if (E.isRight(result)) {
        result.right.variants.forEach((variant) => {
          expect(variant.codecs).toBeTruthy();
          expect(variant.codecs).toContain("avc1");
          expect(variant.codecs).toContain("mp4a");
        });
      }
    });
  });

  describe("selectHLSVariant", () => {
    const createManifestParsed = () => {
      const variants: HLSVariant[] = [
        {
          bandwidth: 5000000,
          resolution: { width: 1920, height: 1080 },
          codecs: "avc1.42E01E, mp4a.40.2",
          url: "https://example.com/variant-1080p.m3u8",
        },
        {
          bandwidth: 2500000,
          resolution: { width: 1280, height: 720 },
          codecs: "avc1.42E01E, mp4a.40.2",
          url: "https://example.com/variant-720p.m3u8",
        },
        {
          bandwidth: 800000,
          resolution: { width: 640, height: 480 },
          codecs: "avc1.42E01E, mp4a.40.2",
          url: "https://example.com/variant-480p.m3u8",
        },
      ];

      return new PlayerState.Source.HLS.ManifestParsed("https://example.com/stream.m3u8", variants, 120);
    };

    it("should select valid variant from manifest", () => {
      const manifestParsed = createManifestParsed();
      const variantToSelect = manifestParsed.variants[0];

      const result = HLSTransitions.selectHLSVariant(manifestParsed, {
        variant: variantToSelect,
        reason: "bandwidth",
      });

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        const selected = result.right;
        expect(selected).toBeInstanceOf(PlayerState.Source.HLS.VariantSelected);
        expect(selected.variant).toEqual(variantToSelect);
        expect(selected.bandwidth).toBe(5000000);
        expect(selected.resolution).toEqual({ width: 1920, height: 1080 });
      }
    });

    it("should select 720p variant", () => {
      const manifestParsed = createManifestParsed();
      const variant720p = manifestParsed.variants[1];

      const result = HLSTransitions.selectHLSVariant(manifestParsed, {
        variant: variant720p,
        reason: "manual",
      });

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right.variant.resolution.height).toBe(720);
        expect(result.right.bandwidth).toBe(2500000);
      }
    });

    it("should fail when variant does not exist in manifest", () => {
      const manifestParsed = createManifestParsed();

      const nonExistentVariant: HLSVariant = {
        bandwidth: 10000000,
        resolution: { width: 3840, height: 2160 },
        codecs: "avc1.42E01E, mp4a.40.2",
        url: "https://example.com/variant-4k.m3u8",
      };

      const result = HLSTransitions.selectHLSVariant(manifestParsed, {
        variant: nonExistentVariant,
        reason: "manual",
      });

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.left).toBeInstanceOf(Error);
        expect(result.left.message).toContain("not found");
      }
    });

    it("should handle both bandwidth and manual selection reasons", () => {
      const manifestParsed = createManifestParsed();
      const variant = manifestParsed.variants[0];

      const bandwidthResult = HLSTransitions.selectHLSVariant(manifestParsed, {
        variant,
        reason: "bandwidth",
      });
      expect(E.isRight(bandwidthResult)).toBe(true);

      const manualResult = HLSTransitions.selectHLSVariant(manifestParsed, {
        variant,
        reason: "manual",
      });
      expect(E.isRight(manualResult)).toBe(true);
    });
  });

  describe("switchHLSVariant", () => {
    const createVariantSelected = (): PlayerState.Source.HLS.VariantSelected => {
      const variant: HLSVariant = {
        bandwidth: 2500000,
        resolution: { width: 1280, height: 720 },
        codecs: "avc1.42E01E, mp4a.40.2",
        url: "https://example.com/variant-720p.m3u8",
      };

      return new PlayerState.Source.HLS.VariantSelected(variant, variant.bandwidth, variant.resolution);
    };

    it("should switch to higher quality variant (upscaling)", () => {
      const currentVariant = createVariantSelected();

      const newVariant: HLSVariant = {
        bandwidth: 5000000,
        resolution: { width: 1920, height: 1080 },
        codecs: "avc1.42E01E, mp4a.40.2",
        url: "https://example.com/variant-1080p.m3u8",
      };

      const result = HLSTransitions.switchHLSVariant(currentVariant, newVariant, "bandwidth");

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        const switching = result.right;
        expect(switching).toBeInstanceOf(PlayerState.Source.HLS.AdaptiveSwitching);
        expect(switching.fromVariant).toEqual(currentVariant.variant);
        expect(switching.toVariant).toEqual(newVariant);
        expect(switching.reason).toBe("bandwidth");
      }
    });

    it("should switch to lower quality variant (downscaling)", () => {
      const currentVariant = createVariantSelected();

      const newVariant: HLSVariant = {
        bandwidth: 800000,
        resolution: { width: 640, height: 480 },
        codecs: "avc1.42E01E, mp4a.40.2",
        url: "https://example.com/variant-480p.m3u8",
      };

      const result = HLSTransitions.switchHLSVariant(currentVariant, newVariant, "bandwidth");

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right.fromVariant.resolution.height).toBe(720);
        expect(result.right.toVariant.resolution.height).toBe(480);
        expect(result.right.reason).toBe("bandwidth");
      }
    });

    it("should support manual quality switching", () => {
      const currentVariant = createVariantSelected();

      const newVariant: HLSVariant = {
        bandwidth: 5000000,
        resolution: { width: 1920, height: 1080 },
        codecs: "avc1.42E01E, mp4a.40.2",
        url: "https://example.com/variant-1080p.m3u8",
      };

      const result = HLSTransitions.switchHLSVariant(currentVariant, newVariant, "manual");

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right.reason).toBe("manual");
      }
    });

    it("should never fail (always returns Right)", () => {
      const currentVariant = createVariantSelected();

      const newVariant: HLSVariant = {
        bandwidth: 1000,
        resolution: { width: 320, height: 240 },
        codecs: "unknown",
        url: "test.m3u8",
      };

      const result = HLSTransitions.switchHLSVariant(currentVariant, newVariant, "bandwidth");

      // Should always succeed (E.Either<never, ...>)
      expect(E.isRight(result)).toBe(true);
    });

    it("should preserve variant details during switch", () => {
      const currentVariant = createVariantSelected();

      const newVariant: HLSVariant = {
        bandwidth: 5000000,
        resolution: { width: 1920, height: 1080 },
        codecs: "avc1.640028, mp4a.40.2",
        url: "https://example.com/variant-1080p.m3u8",
      };

      const result = HLSTransitions.switchHLSVariant(currentVariant, newVariant, "bandwidth");

      if (E.isRight(result)) {
        const switching = result.right;

        // Check from variant
        expect(switching.fromVariant.bandwidth).toBe(2500000);
        expect(switching.fromVariant.codecs).toBe("avc1.42E01E, mp4a.40.2");

        // Check to variant
        expect(switching.toVariant.bandwidth).toBe(5000000);
        expect(switching.toVariant.codecs).toBe("avc1.640028, mp4a.40.2");
      }
    });
  });

  describe("HLS Workflow Integration", () => {
    it("should handle complete HLS loading workflow", async () => {
      // Step 1: Start manifest loading
      const manifestLoading = new PlayerState.Source.HLS.ManifestLoading("https://example.com/stream.m3u8");

      // Step 2: Parse manifest
      const parseResult = await HLSTransitions.parseHLSManifest(manifestLoading)();
      expect(E.isRight(parseResult)).toBe(true);

      if (!E.isRight(parseResult)) return;

      const manifestParsed = parseResult.right;

      // Step 3: Select initial variant (auto-select highest quality)
      const highestQualityVariant = manifestParsed.variants.reduce((prev, current) =>
        current.bandwidth > prev.bandwidth ? current : prev,
      );

      const selectResult = HLSTransitions.selectHLSVariant(manifestParsed, {
        variant: highestQualityVariant,
        reason: "bandwidth",
      });

      expect(E.isRight(selectResult)).toBe(true);

      if (!E.isRight(selectResult)) return;

      const variantSelected = selectResult.right;
      expect(variantSelected.bandwidth).toBe(5000000);

      // Step 4: Simulate bandwidth drop, switch to lower quality
      const lowerQualityVariant = manifestParsed.variants.find((v) => v.bandwidth === 2500000);
      expect(lowerQualityVariant).toBeDefined();

      if (lowerQualityVariant) {
        const switchResult = HLSTransitions.switchHLSVariant(variantSelected, lowerQualityVariant, "bandwidth");

        expect(E.isRight(switchResult)).toBe(true);

        if (E.isRight(switchResult)) {
          expect(switchResult.right.fromVariant.bandwidth).toBe(5000000);
          expect(switchResult.right.toVariant.bandwidth).toBe(2500000);
        }
      }
    });
  });
});
