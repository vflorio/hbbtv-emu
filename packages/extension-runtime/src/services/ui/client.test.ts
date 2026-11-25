import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import type { UiRequest } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { createFakeExtensionChannel } from "../../__tests__/fakes";
import { createUiClient } from "./client";

const state = DEFAULT_EXTENSION_STATE;

const setup = () => {
  const channel = createFakeExtensionChannel<UiRequest>();
  return { channel, client: createUiClient(channel.channel) };
};

describe("UI client", () => {
  it("loads the state from the background", async () => {
    const { channel, client } = setup();
    channel.respondWith(() => ({ _tag: "UI/State", state }));

    expect(await client.getState()()).toEqual(E.right(state));
    expect(channel.sent).toEqual([{ _tag: "UI/GetState" }]);
  });

  it("sends saves, keys and channels as typed requests", async () => {
    const { channel, client } = setup();
    channel.respondWith(() => ({ _tag: "UI/Done" }));

    await client.saveState(state)();
    await client.dispatchKey(403)();
    await client.playChannel(state.channels[0]!)();
    await client.turnOnTv("channel-1")();

    expect(channel.sent.map((m) => m._tag)).toEqual([
      "UI/SaveState",
      "UI/DispatchKey",
      "UI/PlayChannel",
      "UI/TurnOnTv",
    ]);
  });

  it("turns a background failure into an error the UI can show", async () => {
    const { channel, client } = setup();
    channel.respondWith(() => ({ _tag: "UI/Failed", reason: "No active tab" }));

    expect(await client.dispatchKey(403)()).toEqual(E.left({ _tag: "UiClientError", reason: "No active tab" }));
  });

  it("rejects responses it does not understand", async () => {
    const { channel, client } = setup();
    channel.respondWith(() => undefined);

    expect(E.isLeft(await client.getState()())).toBe(true);
  });

  it("delivers state notifications to subscribers, and nothing else", () => {
    const { channel, client } = setup();
    const received: unknown[] = [];
    const unsubscribe = client.subscribe((s) => received.push(s));

    channel.receive({ _tag: "UI/StateChanged", state });
    channel.receive({ _tag: "Host/DispatchKey", keyCode: 403 });
    unsubscribe();
    channel.receive({ _tag: "UI/StateChanged", state });

    expect(received).toEqual([state]);
  });
});
