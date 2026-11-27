import { describe, expect, it } from "vitest";
import { createFakeStorage, flushPromises, silentLogger } from "../../__tests__/fakes";
import type { TvSession, TvSessions } from "../../state";
import { createSessions } from "./sessions";

const session = (channelId: string): TvSession => ({
  mode: "app",
  channelId,
  serviceSelected: true,
  url: null,
  app: null,
  volume: 100,
});

const setup = () => {
  const storage = createFakeStorage<TvSessions>();
  return { storage, sessions: createSessions(storage.storage, silentLogger().create("Sessions")) };
};

describe("createSessions", () => {
  it("tabs that open their session at the same time all keep it (pages ready together)", async () => {
    const { sessions } = setup();

    await Promise.all([sessions.open(1, session("a"))(), sessions.open(2, session("b"))()]);

    expect(sessions.all()).toEqual({ "1": session("a"), "2": session("b") });
  });

  it("changes made at the same time to different tabs all stay, and are stored", async () => {
    const { sessions, storage } = setup();
    await sessions.open(1, session("a"))();
    await sessions.open(2, session("b"))();

    await Promise.all([
      sessions.update(1, (s) => ({ ...s, volume: 10 }))(),
      sessions.update(2, (s) => ({ ...s, volume: 20 }))(),
      sessions.close(3)(),
    ]);
    await flushPromises();

    const expected = { "1": { ...session("a"), volume: 10 }, "2": { ...session("b"), volume: 20 } };
    expect(sessions.all()).toEqual(expected);
    expect(await storage.storage.read()()).toEqual({ _tag: "Right", right: { _tag: "Some", value: expected } });
  });

  it("an open session is kept as it is: opening it again gives it back", async () => {
    const { sessions } = setup();
    await sessions.open(1, session("a"))();

    expect(await sessions.open(1, session("b"))()).toEqual(session("a"));
  });
});
