/**
 * Tests for DASH-specific transition functions
 */

import * as E from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { type DASHRepresentation, PlayerState } from "../../state";
import * as DASHTransitions from "../../transitions/dash";

describe("Transitions - DASH", () => {
  describe("parseDASHMPD", () => {
    it("should parse DASH MPD and return MPDParsed state", async () => {
      const mpdLoading = new PlayerState.Source.DASH.MPDLoading("https://example.com/stream.mpd");

      const result = await DASHTransitions.parseDASHMPD(mpdLoading)();

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        const parsed = result.right;
        expect(parsed).toBeInstanceOf(PlayerState.Source.DASH.MPDParsed);
        expect(parsed.url).toBe("https://example.com/stream.mpd");
        expect(parsed.adaptationSets).toHaveLength(1);
        expect(parsed.duration).toBeGreaterThan(0);
        expect(parsed.isDynamic).toBe(false);
      }
    });

    it("should include adaptation sets with representations", async () => {
      const mpdLoading = new PlayerState.Source.DASH.MPDLoading("https://example.com/stream.mpd");

      const result = await DASHTransitions.parseDASHMPD(mpdLoading)();

      if (E.isRight(result)) {
        const adaptationSets = result.right.adaptationSets;

        expect(adaptationSets).toHaveLength(1);

        const videoSet = adaptationSets[0];
        expect(videoSet.id).toBe("video");
        expect(videoSet.contentType).toBe("video");
        expect(videoSet.mimeType).toBe("video/mp4");
        expect(videoSet.representations).toHaveLength(2);
      }
    });

    it("should include multiple quality representations", async () => {
      const mpdLoading = new PlayerState.Source.DASH.MPDLoading("https://example.com/stream.mpd");

      const result = await DASHTransitions.parseDASHMPD(mpdLoading)();

      if (E.isRight(result)) {
        const representations = result.right.adaptationSets[0].representations;

        // Should have 1080p representation
        const repr1080 = representations.find((r) => r.id === "video-1080p");
        expect(repr1080).toBeDefined();
        expect(repr1080?.bandwidth).toBe(5000000);
        expect(repr1080?.resolution).toEqual({ width: 1920, height: 1080 });
        expect(repr1080?.codecs).toBe("avc1.42E01E");

        // Should have 720p representation
        const repr720 = representations.find((r) => r.id === "video-720p");
        expect(repr720).toBeDefined();
        expect(repr720?.bandwidth).toBe(2500000);
        expect(repr720?.resolution).toEqual({ width: 1280, height: 720 });
      }
    });

    it("should set isDynamic to false for static content", async () => {
      const mpdLoading = new PlayerState.Source.DASH.MPDLoading("https://example.com/vod.mpd");

      const result = await DASHTransitions.parseDASHMPD(mpdLoading)();

      if (E.isRight(result)) {
        expect(result.right.isDynamic).toBe(false);
      }
    });

    it("should preserve the MPD URL", async () => {
      const url = "https://cdn.example.com/content/stream.mpd";
      const mpdLoading = new PlayerState.Source.DASH.MPDLoading(url);

      const result = await DASHTransitions.parseDASHMPD(mpdLoading)();

      if (E.isRight(result)) {
        expect(result.right.url).toBe(url);
      }
    });
  });

  describe("selectDASHRepresentation", () => {
    const createMPDParsed = () => {
      const adaptationSets = [
        {
          id: "video",
          contentType: "video" as const,
          mimeType: "video/mp4",
          representations: [
            {
              id: "video-1080p",
              bandwidth: 5000000,
              codecs: "avc1.42E01E",
              resolution: { width: 1920, height: 1080 },
            },
            {
              id: "video-720p",
              bandwidth: 2500000,
              codecs: "avc1.42E01E",
              resolution: { width: 1280, height: 720 },
            },
            {
              id: "video-480p",
              bandwidth: 800000,
              codecs: "avc1.42E01E",
              resolution: { width: 640, height: 480 },
            },
          ],
        },
      ];

      return new PlayerState.Source.DASH.MPDParsed("https://example.com/stream.mpd", adaptationSets, 120, false);
    };

    it("should select valid representation from MPD", () => {
      const mpdParsed = createMPDParsed();
      const reprToSelect = mpdParsed.adaptationSets[0].representations[0];

      const result = DASHTransitions.selectDASHRepresentation(mpdParsed, {
        representation: reprToSelect,
        reason: "abr",
      });

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        const selected = result.right;
        expect(selected).toBeInstanceOf(PlayerState.Source.DASH.RepresentationSelected);
        expect(selected.representation).toEqual(reprToSelect);
        expect(selected.bandwidth).toBe(5000000);
        expect(selected.resolution).toEqual({ width: 1920, height: 1080 });
      }
    });

    it("should select 720p representation", () => {
      const mpdParsed = createMPDParsed();
      const repr720p = mpdParsed.adaptationSets[0].representations[1];

      const result = DASHTransitions.selectDASHRepresentation(mpdParsed, {
        representation: repr720p,
        reason: "manual",
      });

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right.representation.id).toBe("video-720p");
        expect(result.right.bandwidth).toBe(2500000);
      }
    });

    it("should fail when representation does not exist in MPD", () => {
      const mpdParsed = createMPDParsed();

      const nonExistentRepr: DASHRepresentation = {
        id: "video-4k",
        bandwidth: 10000000,
        codecs: "avc1.640028",
        resolution: { width: 3840, height: 2160 },
      };

      const result = DASHTransitions.selectDASHRepresentation(mpdParsed, {
        representation: nonExistentRepr,
        reason: "manual",
      });

      expect(E.isLeft(result)).toBe(true);

      if (E.isLeft(result)) {
        expect(result.left).toBeInstanceOf(Error);
        expect(result.left.message).toContain("not found");
      }
    });

    it("should handle all selection reasons: abr, manual, constraint", () => {
      const mpdParsed = createMPDParsed();
      const repr = mpdParsed.adaptationSets[0].representations[0];

      const abrResult = DASHTransitions.selectDASHRepresentation(mpdParsed, {
        representation: repr,
        reason: "abr",
      });
      expect(E.isRight(abrResult)).toBe(true);

      const manualResult = DASHTransitions.selectDASHRepresentation(mpdParsed, {
        representation: repr,
        reason: "manual",
      });
      expect(E.isRight(manualResult)).toBe(true);

      const constraintResult = DASHTransitions.selectDASHRepresentation(mpdParsed, {
        representation: repr,
        reason: "constraint",
      });
      expect(E.isRight(constraintResult)).toBe(true);
    });

    it("should handle representation without explicit resolution", () => {
      const mpdParsed = createMPDParsed();
      const reprWithoutResolution: DASHRepresentation = {
        id: "audio-high",
        bandwidth: 128000,
        codecs: "mp4a.40.2",
      };

      // Manually add to MPD
      const modifiedMPD = new PlayerState.Source.DASH.MPDParsed(
        mpdParsed.url,
        [
          {
            ...mpdParsed.adaptationSets[0],
            representations: [...mpdParsed.adaptationSets[0].representations, reprWithoutResolution],
          },
        ],
        mpdParsed.duration,
        mpdParsed.isDynamic,
      );

      const result = DASHTransitions.selectDASHRepresentation(modifiedMPD, {
        representation: reprWithoutResolution,
        reason: "abr",
      });

      if (E.isRight(result)) {
        // Should default to {width: 0, height: 0} for audio-only
        expect(result.right.resolution).toEqual({ width: 0, height: 0 });
      }
    });
  });

  describe("switchDASHRepresentation", () => {
    const createRepresentationSelected = (): PlayerState.Source.DASH.RepresentationSelected => {
      const representation: DASHRepresentation = {
        id: "video-720p",
        bandwidth: 2500000,
        codecs: "avc1.42E01E",
        resolution: { width: 1280, height: 720 },
      };

      return new PlayerState.Source.DASH.RepresentationSelected(
        representation,
        representation.bandwidth,
        representation.resolution || { width: 0, height: 0 },
      );
    };

    it("should switch to higher quality representation", () => {
      const currentRepresentation = createRepresentationSelected();

      const newRepresentation: DASHRepresentation = {
        id: "video-1080p",
        bandwidth: 5000000,
        codecs: "avc1.42E01E",
        resolution: { width: 1920, height: 1080 },
      };

      const result = DASHTransitions.switchDASHRepresentation(currentRepresentation, newRepresentation, "abr");

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        const switching = result.right;
        expect(switching).toBeInstanceOf(PlayerState.Source.DASH.QualitySwitching);
        expect(switching.fromRepresentation).toEqual(currentRepresentation.representation);
        expect(switching.toRepresentation).toEqual(newRepresentation);
        expect(switching.reason).toBe("abr");
      }
    });

    it("should switch to lower quality representation", () => {
      const currentRepresentation = createRepresentationSelected();

      const newRepresentation: DASHRepresentation = {
        id: "video-480p",
        bandwidth: 800000,
        codecs: "avc1.42E01E",
        resolution: { width: 640, height: 480 },
      };

      const result = DASHTransitions.switchDASHRepresentation(currentRepresentation, newRepresentation, "abr");

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right.fromRepresentation.id).toBe("video-720p");
        expect(result.right.toRepresentation.id).toBe("video-480p");
      }
    });

    it("should support manual quality switching", () => {
      const currentRepresentation = createRepresentationSelected();

      const newRepresentation: DASHRepresentation = {
        id: "video-1080p",
        bandwidth: 5000000,
        codecs: "avc1.42E01E",
        resolution: { width: 1920, height: 1080 },
      };

      const result = DASHTransitions.switchDASHRepresentation(currentRepresentation, newRepresentation, "manual");

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right.reason).toBe("manual");
      }
    });

    it("should support constraint-based quality switching", () => {
      const currentRepresentation = createRepresentationSelected();

      const newRepresentation: DASHRepresentation = {
        id: "video-480p",
        bandwidth: 800000,
        codecs: "avc1.42E01E",
        resolution: { width: 640, height: 480 },
      };

      const result = DASHTransitions.switchDASHRepresentation(currentRepresentation, newRepresentation, "constraint");

      expect(E.isRight(result)).toBe(true);

      if (E.isRight(result)) {
        expect(result.right.reason).toBe("constraint");
      }
    });

    it("should never fail (always returns Right)", () => {
      const currentRepresentation = createRepresentationSelected();

      const newRepresentation: DASHRepresentation = {
        id: "test",
        bandwidth: 1000,
        codecs: "unknown",
      };

      const result = DASHTransitions.switchDASHRepresentation(currentRepresentation, newRepresentation, "abr");

      // Should always succeed (E.Either<never, ...>)
      expect(E.isRight(result)).toBe(true);
    });

    it("should preserve representation details during switch", () => {
      const currentRepresentation = createRepresentationSelected();

      const newRepresentation: DASHRepresentation = {
        id: "video-1080p",
        bandwidth: 5000000,
        codecs: "avc1.640028",
        resolution: { width: 1920, height: 1080 },
      };

      const result = DASHTransitions.switchDASHRepresentation(currentRepresentation, newRepresentation, "abr");

      if (E.isRight(result)) {
        const switching = result.right;

        // Check from representation
        expect(switching.fromRepresentation.bandwidth).toBe(2500000);
        expect(switching.fromRepresentation.codecs).toBe("avc1.42E01E");

        // Check to representation
        expect(switching.toRepresentation.bandwidth).toBe(5000000);
        expect(switching.toRepresentation.codecs).toBe("avc1.640028");
      }
    });
  });

  describe("DASH Workflow Integration", () => {
    it("should handle complete DASH loading workflow", async () => {
      // Step 1: Start MPD loading
      const mpdLoading = new PlayerState.Source.DASH.MPDLoading("https://example.com/stream.mpd");

      // Step 2: Parse MPD
      const parseResult = await DASHTransitions.parseDASHMPD(mpdLoading)();
      expect(E.isRight(parseResult)).toBe(true);

      if (!E.isRight(parseResult)) return;

      const mpdParsed = parseResult.right;

      // Step 3: Select initial representation (auto-select highest quality)
      const representations = mpdParsed.adaptationSets[0].representations;
      const highestQuality = representations.reduce((prev, current) =>
        current.bandwidth > prev.bandwidth ? current : prev,
      );

      const selectResult = DASHTransitions.selectDASHRepresentation(mpdParsed, {
        representation: highestQuality,
        reason: "abr",
      });

      expect(E.isRight(selectResult)).toBe(true);

      if (!E.isRight(selectResult)) return;

      const representationSelected = selectResult.right;
      expect(representationSelected.bandwidth).toBe(5000000);

      // Step 4: Simulate ABR switch to lower quality
      const lowerQuality = representations.find((r) => r.bandwidth === 2500000);
      expect(lowerQuality).toBeDefined();

      if (lowerQuality) {
        const switchResult = DASHTransitions.switchDASHRepresentation(representationSelected, lowerQuality, "abr");

        expect(E.isRight(switchResult)).toBe(true);

        if (E.isRight(switchResult)) {
          expect(switchResult.right.fromRepresentation.bandwidth).toBe(5000000);
          expect(switchResult.right.toRepresentation.bandwidth).toBe(2500000);
          expect(switchResult.right.reason).toBe("abr");
        }
      }
    });

    it("should handle manual quality selection workflow", async () => {
      // Parse MPD
      const mpdLoading = new PlayerState.Source.DASH.MPDLoading("https://example.com/stream.mpd");
      const parseResult = await DASHTransitions.parseDASHMPD(mpdLoading)();

      if (!E.isRight(parseResult)) return;

      // User manually selects 720p (the default mock MPD has 1080p and 720p)
      const repr720p = parseResult.right.adaptationSets[0].representations.find((r) => r.id === "video-720p");
      expect(repr720p).toBeDefined();

      if (repr720p) {
        const selectResult = DASHTransitions.selectDASHRepresentation(parseResult.right, {
          representation: repr720p,
          reason: "manual",
        });

        expect(E.isRight(selectResult)).toBe(true);

        if (E.isRight(selectResult)) {
          expect(selectResult.right.representation.id).toBe("video-720p");
          expect(selectResult.right.bandwidth).toBe(2500000);
        }
      }
    });
  });

  describe("DASH vs HLS Comparison", () => {
    it("should have similar workflow structure to HLS", async () => {
      // Both HLS and DASH follow: Load → Parse → Select → Switch pattern
      const mpdLoading = new PlayerState.Source.DASH.MPDLoading("https://example.com/stream.mpd");
      const parseResult = await DASHTransitions.parseDASHMPD(mpdLoading)();

      expect(E.isRight(parseResult)).toBe(true);

      // Similar to HLS manifest parsing
      if (E.isRight(parseResult)) {
        expect(parseResult.right).toHaveProperty("url");
        expect(parseResult.right).toHaveProperty("duration");
        expect(parseResult.right.adaptationSets).toBeDefined();
      }
    });
  });
});
