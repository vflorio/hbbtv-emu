import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";

export type ChannelTriplet = Readonly<{ onid: number; tsid: number; sid: number }>;

export type ChannelTripletInput = Readonly<{
  onid?: unknown;
  tsid?: unknown;
  sid?: unknown;
}>;

export const toChannelTriplet = (value: ChannelTripletInput): O.Option<ChannelTriplet> =>
  pipe(
    O.Do,
    O.bind("onid", () => (typeof value.onid === "number" ? O.some(value.onid) : O.none)),
    O.bind("tsid", () => (typeof value.tsid === "number" ? O.some(value.tsid) : O.none)),
    O.bind("sid", () => (typeof value.sid === "number" ? O.some(value.sid) : O.none)),
    O.map(({ onid, tsid, sid }) => ({ onid, tsid, sid })),
  );

export const matchesChannelTriplet =
  (triplet: ChannelTriplet) =>
  (value: ChannelTriplet): boolean =>
    value.onid === triplet.onid && value.tsid === triplet.tsid && value.sid === triplet.sid;
