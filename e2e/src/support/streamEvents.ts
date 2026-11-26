/**
 * The stream event scenario both hosts run on `basic-app/index.xhtml` (TS 102 796 §8.2.1):
 * the application listens for events described by XML files over HTTP, served from
 * another origin without CORS headers, as broadcasters' files often are. A TV fetches them
 * anyway; so must the emulator.
 *
 * - an event the file describes, and the channel's schedule sends: the listener gets it;
 * - an event the file does not describe, and a file that is not there: an error event each;
 * - `release()` (the unrealized state) drops the listeners: no more events after it.
 */

import { expect } from "vitest";

export const STREAM_EVENT_PAYLOAD = "ad break: 30s";

const toHex = (text: string) =>
  Array.from(new TextEncoder().encode(text), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

/** A channel of the lineup that sends `sevent`, as `descriptionUrl` describes it, every second. */
export const streamEventChannel = <C extends { id: string; sid: number }>(channel: C, descriptionUrl: string) => ({
  ...channel,
  id: "e2e-events",
  name: "e2e events",
  sid: channel.sid + 4000,
  ait: undefined,
  enableStreamEvents: true,
  streamEvents: [
    {
      id: "e2e-sevent",
      enabled: true,
      label: "e2e",
      scheduleMode: "interval",
      intervalSeconds: 1,
      offsetSeconds: 0,
      eventName: "sevent",
      targetURL: descriptionUrl,
      text: STREAM_EVENT_PAYLOAD,
      data: toHex(STREAM_EVENT_PAYLOAD),
      status: "trigger",
    },
  ],
});

type Seen = { name: string; data: string; text: string; status: string };
type Urls = { described: string; missing: string };
type Outcome = { described: Seen[]; undescribed: Seen[]; missing: Seen[]; afterRelease: Seen[] };

/** `page.evaluate(fn, urls)`, of Playwright or Puppeteer. */
export type EvaluateWithUrls = (fn: (urls: Urls) => Promise<Outcome>, urls: Urls) => Promise<Outcome>;

/** Runs in the page: listens, waits for what each listener should get, releases, waits again. */
const listenThenRelease = async ({ described, missing }: Urls): Promise<Outcome> => {
  type Listener = (event: Seen) => void;
  const video = document.getElementById("video") as unknown as {
    addStreamEventListener: (url: string, name: string, listener: Listener) => void;
    release: () => void;
  };
  const record =
    (into: Seen[]): Listener =>
    (event) => {
      into.push({ name: event.name, data: event.data, text: event.text, status: event.status });
    };
  const outcome: Outcome = { described: [], undescribed: [], missing: [], afterRelease: [] };
  video.addStreamEventListener(described, "sevent", record(outcome.described));
  video.addStreamEventListener(described, "elsewhere", record(outcome.undescribed));
  video.addStreamEventListener(missing, "sevent", record(outcome.missing));

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let waited = 0; waited < 10_000; waited += 100) {
    if (outcome.described.length > 0 && outcome.undescribed.length > 0 && outcome.missing.length > 0) break;
    await wait(100);
  }
  video.release();
  const count = outcome.described.length;
  await wait(2_500);
  outcome.afterRelease = outcome.described.slice(count);
  return outcome;
};

export const runStreamEventScenario = async (evaluate: EvaluateWithUrls, urls: Urls) => {
  const outcome = await evaluate(listenThenRelease, urls);

  expect(outcome.described.length).toBeGreaterThan(0);
  expect(outcome.described[0]).toEqual({
    name: "sevent",
    data: toHex(STREAM_EVENT_PAYLOAD),
    text: STREAM_EVENT_PAYLOAD,
    status: "trigger",
  });
  const error = (name: string) => [{ name, data: "", text: "", status: "error" }];
  expect(outcome.undescribed).toEqual(error("elsewhere"));
  expect(outcome.missing).toEqual(error("sevent"));
  expect(outcome.afterRelease).toEqual([]);
};
