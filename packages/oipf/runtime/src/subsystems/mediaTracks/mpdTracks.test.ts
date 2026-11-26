import { expect, it } from "vitest";
import { mpdTracks } from "./mpdTracks";

const document = new DOMParser().parseFromString(
  `<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
    <Period id="first"><AdaptationSet lang="ger"/></Period>
    <Period id="second">
      <AdaptationSet id="v" contentType="video"/>
      <Preselection id="p1" lang="en-GB" preselectionComponents="a1"/>
      <AdaptationSet id="a1" lang="ger"/>
      <AdaptationSet id="a2"/>
    </Period>
  </MPD>`,
  "application/xml",
);

it("the AdaptationSets and Preselections of a Period, in their order, with @lang as the MPD has it", () => {
  expect(mpdTracks(document, 1)).toEqual([
    { ref: "adaptation:0", lang: null },
    { ref: "preselection:p1", lang: "en-GB" },
    { ref: "adaptation:1", lang: "ger" },
    { ref: "adaptation:2", lang: null },
  ]);
  expect(mpdTracks(document, 0)).toEqual([{ ref: "adaptation:0", lang: "ger" }]);
  expect(mpdTracks(document, 2)).toEqual([]);
});
