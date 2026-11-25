import type { OIPF } from "@hbb-emu/oipf-api";
import { describe, expect, it } from "vitest";
import {
  addStreamEventListener,
  createStreamEventEnv,
  readStreamEventListeners,
  removeStreamEventListener,
  type StreamEventEnv,
} from "./streamEvent";

type Listener = OIPF.DAE.Broadcast.StreamEventListener;

const setup = () => {
  const subscribed: string[] = [];
  const unsubscribed: string[] = [];
  const scheduler: StreamEventEnv["scheduler"] = {
    addListener: (targetURL, eventName) => () => {
      const id = `${targetURL}#${eventName}#${subscribed.length}`;
      subscribed.push(id);
      return {
        unsubscribe: () => {
          unsubscribed.push(id);
        },
      };
    },
  };
  return { env: createStreamEventEnv(scheduler)(), subscribed, unsubscribed };
};

const listener: Listener = () => {};
const other: Listener = () => {};

describe("stream event listeners", () => {
  it("each addition subscribes to the scheduler, even of the same listener", () => {
    const { env, subscribed } = setup();

    addStreamEventListener("dvb://1", "now", listener)(env)();
    addStreamEventListener("dvb://1", "now", listener)(env)();

    expect(subscribed).toHaveLength(2);
    expect(readStreamEventListeners(env)()).toEqual([
      { targetURL: "dvb://1", eventName: "now" },
      { targetURL: "dvb://1", eventName: "now" },
    ]);
  });

  it("removing takes away one subscription with that URL, name and listener", () => {
    const { env, unsubscribed } = setup();
    addStreamEventListener("dvb://1", "now", listener)(env)();
    addStreamEventListener("dvb://1", "now", other)(env)();
    addStreamEventListener("dvb://1", "now", listener)(env)();

    removeStreamEventListener("dvb://1", "now", listener)(env)();

    expect(unsubscribed).toEqual(["dvb://1#now#0"]);
    expect(readStreamEventListeners(env)()).toHaveLength(2);
  });

  it("removing what was never added changes nothing", () => {
    const { env, unsubscribed } = setup();
    addStreamEventListener("dvb://1", "now", listener)(env)();

    removeStreamEventListener("dvb://1", "later", listener)(env)();
    removeStreamEventListener("dvb://1", "now", other)(env)();

    expect(unsubscribed).toEqual([]);
    expect(readStreamEventListeners(env)()).toHaveLength(1);
  });
});
