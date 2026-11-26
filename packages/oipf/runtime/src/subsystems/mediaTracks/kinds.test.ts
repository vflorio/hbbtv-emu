import { describe, expect, it } from "vitest";
import { audioKind, videoKind } from "./kinds";

describe("the kind of a DASH AudioTrack (TS 102 796 A.2.12.3)", () => {
  it.each<[string[], string[], string]>([
    [["main"], [], "main"],
    [["main", "description"], [], "main-desc"],
    [["alternate"], ["1"], "main-desc"],
    [["description", "supplementary"], [], "descriptions"],
    [["dub", "main"], [], "translation"],
    [["alternate"], [], "alternative"],
    [["dub"], [], "alternative"],
    [["alternate", "main"], [], "main"],
    [["commentary"], [], "commentary"],
    [["main", "commentary"], [], "main"],
    [["main", "caption"], [], ""],
    [["supplementary"], [], ""],
    [[], [], ""],
  ])("roles %j, audio purposes %j → %j", (roles, purposes, kind) => {
    expect(audioKind(roles, purposes)).toBe(kind);
  });
});

describe("the kind of a DASH VideoTrack (TS 102 796 A.2.12.3)", () => {
  it.each<[string[], string]>([
    [["main"], "main"],
    [["caption", "main"], "captions"],
    [["subtitle", "main"], "subtitles"],
    [["alternate"], "alternative"],
    [["dub"], "alternative"],
    [["commentary"], "commentary"],
    [["main", "dub"], "alternative"],
    [["sign"], ""],
    [[], ""],
  ])("roles %j → %j", (roles, kind) => {
    expect(videoKind(roles)).toBe(kind);
  });
});
