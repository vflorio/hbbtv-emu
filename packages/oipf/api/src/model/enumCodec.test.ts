import { isLeft, isRight } from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { ErrorCode } from "../specification/av/control/control";
import { ChannelIdType } from "../specification/dae/videoBroadcast/channel";
import { AVControlErrorCodeCodec } from "./av/control";
import { ChannelIdTypeCodec, ChannelStateCodec } from "./dae/videoBroadcast/channel";
import { BroadcastPlayStateCodec } from "./dae/videoBroadcast/videoBroadcast";
import { enumCodec } from "./enumCodec";

enum Sample {
  A = 0,
  B = 10,
}

describe("enumCodec", () => {
  it("accepts exactly the enum's numeric values", () => {
    const codec = enumCodec<Sample>("Sample", Sample);

    expect(isRight(codec.decode(0))).toBe(true);
    expect(isRight(codec.decode(10))).toBe(true);
    expect(isLeft(codec.decode(1))).toBe(true);
    expect(isLeft(codec.decode("A"))).toBe(true);
  });
});

describe("state codecs follow the spec's enums", () => {
  it("a DVB-T channel is idType 12, as the runtime makes it", () => {
    expect(isRight(ChannelIdTypeCodec.decode(ChannelIdType.ID_DVB_T))).toBe(true);
    expect(isRight(ChannelStateCodec.decode({ idType: 12, onid: 318, tsid: 1, sid: 52 }))).toBe(true);
    // The value the hand-written codec used to call ID_DVB_T.
    expect(isLeft(ChannelIdTypeCodec.decode(2))).toBe(true);
  });

  it("A/V Control errors go up to 'content not available at given position' (6), and HbbTV's 7", () => {
    expect(isRight(AVControlErrorCodeCodec.decode(ErrorCode.CONTENT_NOT_AVAILABLE_AT_POSITION))).toBe(true);
    expect(isRight(AVControlErrorCodeCodec.decode(ErrorCode.PARENTAL_CONTROL_BLOCKED))).toBe(true);
  });

  it("video/broadcast play states are 0 to 3", () => {
    expect([0, 1, 2, 3, 4].map((value) => isRight(BroadcastPlayStateCodec.decode(value)))).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });
});
