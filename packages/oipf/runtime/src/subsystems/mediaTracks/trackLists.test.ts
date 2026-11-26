import { describe, expect, it, vi } from "vitest";
import { createTrackList, type TrackInit, type TrackType } from "./trackLists";

/** The tasks the list queued (its events). */
const tasks = () => new Promise((resolve) => setTimeout(resolve, 0));

const init = (key: string, on = false, language = ""): TrackInit => ({
  key,
  id: key,
  kind: "main",
  label: "",
  language,
  on,
});

const setUp = (type: TrackType) => {
  const select = vi.fn();
  const control = createTrackList(type, { window, select });
  const events: { type: string; track?: unknown }[] = [];
  for (const name of ["change", "addtrack", "removetrack"])
    control.list.addEventListener(name, (event) =>
      events.push({ type: event.type, track: (event as { track?: unknown }).track }),
    );
  return { ...control, select, events };
};

type Audio = { id: string; kind: string; label: string; language: string; enabled: boolean };
type Video = { id: string; selected: boolean };

describe("AudioTrackList and VideoTrackList, for DASH (HTML §4.8.11.10, TS 102 796 A.2.12.1)", () => {
  it("the tracks are its indices, with length and getTrackById(); each new one fires addtrack", async () => {
    const { list, set, events } = setUp("audio");

    set([init("a", true, "ger"), init("b")]);

    expect(list.length).toBe(2);
    expect(list[0]).toMatchObject({ id: "a", kind: "main", label: "", language: "ger", enabled: true });
    expect((list[1] as unknown as Audio).enabled).toBe(false);
    expect(list.getTrackById("b")).toBe(list[1]);
    expect(list.getTrackById("x")).toBeNull();
    expect(events).toEqual([]);
    await tasks();
    expect(events).toEqual([
      { type: "addtrack", track: list[0] },
      { type: "addtrack", track: list[1] },
    ]);
  });

  it("an update keeps the tracks that stay, removes the others (removetrack) and moves enabled with what is presented", async () => {
    const { list, set, events } = setUp("audio");
    set([init("a", true), init("b")]);
    const [a, b] = [list[0], list[1]];
    await tasks();
    events.length = 0;

    set([init("b", true), init("c")]);

    expect(list.length).toBe(2);
    expect(list[0]).toBe(b);
    expect((b as unknown as Audio).enabled).toBe(true);
    expect(list[2]).toBeUndefined();
    await tasks();
    expect(events).toEqual([
      { type: "removetrack", track: a },
      { type: "addtrack", track: list[1] },
    ]);
  });

  it("enabling an AudioTrack presents it, disables the others, and fires change once", async () => {
    const { list, set, select, events } = setUp("audio");
    set([init("a", true), init("b")]);
    await tasks();
    events.length = 0;

    (list[1] as unknown as Audio).enabled = true;
    (list[1] as unknown as Audio).enabled = true;

    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith("b");
    expect((list[0] as unknown as Audio).enabled).toBe(false);
    await tasks();
    expect(events).toEqual([{ type: "change", track: undefined }]);
  });

  it("onchange, onaddtrack and onremovetrack are its event handlers", async () => {
    const { list, set } = setUp("audio");
    const handler = vi.fn();
    (list as unknown as { onaddtrack: unknown }).onaddtrack = handler;

    set([init("a")]);
    await tasks();

    expect(handler).toHaveBeenCalledTimes(1);
    expect((list as unknown as { onaddtrack: unknown }).onaddtrack).toBe(handler);
  });

  it("one VideoTrack selected at most; selectedIndex is its position", () => {
    const { list, set, select } = setUp("video");
    set([init("a", true), init("b", true)]);

    expect([list[0], list[1]].map((track) => (track as unknown as Video).selected)).toEqual([true, false]);
    expect((list as unknown as { selectedIndex: number }).selectedIndex).toBe(0);

    (list[1] as unknown as Video).selected = true;
    expect(select).toHaveBeenCalledWith("b");
    expect((list as unknown as { selectedIndex: number }).selectedIndex).toBe(1);
  });

  it("clear() empties it with no event", async () => {
    const { list, set, clear, events } = setUp("audio");
    set([init("a")]);
    await tasks();
    events.length = 0;

    clear();

    expect(list.length).toBe(0);
    expect(list[0]).toBeUndefined();
    await tasks();
    expect(events).toEqual([]);
  });
});
