/**
 * The A/V Control scenario both hosts run on `av-app/index.xhtml`: a VOD player that
 * plays, seeks, pauses, stops and plays to the end of a 3 s clip, as an
 * application drives it.
 */

import { expect } from "vitest";

export type AvAppState = {
  initError: string | null;
  dataAtFirstScript: string;
  playStateAtFirstScript: number;
  playStates: number[];
  speeds: number[];
  positions: number[];
  /** What the application's DOM listeners on the object received. */
  dom: { playStates: number; speeds: number[]; positions: number[] };
};

type AvPlayer = HTMLObjectElement & {
  play: (speed?: number) => boolean;
  stop: () => boolean;
  seek: (position: number) => boolean;
  queue: (url: string | null) => boolean;
  readonly data: string;
  readonly playState: number;
  readonly playPosition: number | undefined;
  readonly playTime: number | undefined;
  readonly speed: number;
};

/** Runs a function in the page (Playwright and Puppeteer agree on this much). */
export type Evaluate = <T>(fn: () => T) => Promise<T>;

const STOPPED = 0;
const PLAYING = 1;
const PAUSED = 2;
const CONNECTING = 3;
const FINISHED = 5;

const until = async (evaluate: Evaluate, fn: () => boolean, what: string, timeout = 10_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(fn)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${what}`);
};

const app = (evaluate: Evaluate) => evaluate(() => (window as unknown as { __e2e: AvAppState }).__e2e);

export const runAvControlScenario = async (evaluate: Evaluate) => {
  const start = await app(evaluate);
  expect(start).toMatchObject({ initError: null, dataAtFirstScript: "clip.mp4", playStateAtFirstScript: 0 });

  // play(1): connecting, then playing; the video fills the object's box.
  expect(await evaluate(() => (document.getElementById("player") as AvPlayer).play(1))).toBe(true);
  await until(evaluate, () => (document.getElementById("player") as AvPlayer).playState === 1, "playing");
  const playing = await evaluate(() => {
    const player = document.getElementById("player") as AvPlayer;
    const rect = document.querySelector("video")?.getBoundingClientRect();
    return { playTime: player.playTime, speed: player.speed, rect: rect && { width: rect.width, height: rect.height } };
  });
  expect(playing).toEqual({ playTime: 3000, speed: 1, rect: { width: 640, height: 360 } });
  const afterPlay = await app(evaluate);
  expect(afterPlay.playStates[0]).toBe(CONNECTING);
  expect(afterPlay.playStates[afterPlay.playStates.length - 1]).toBe(PLAYING);
  expect(afterPlay.speeds).toEqual([1]);

  // seek(): the position is the target as soon as it returns.
  const seeked = await evaluate(() => {
    const player = document.getElementById("player") as AvPlayer;
    return { result: player.seek(1000), position: player.playPosition };
  });
  expect(seeked).toEqual({ result: true, position: 1000 });
  expect((await app(evaluate)).positions).toEqual([1000]);

  // play(0) pauses; stop() is stopped, back at 0.
  const paused = await evaluate(() => {
    const player = document.getElementById("player") as AvPlayer;
    player.play(0);
    return { playState: player.playState, speed: player.speed };
  });
  expect(paused).toEqual({ playState: PAUSED, speed: 0 });
  const stopped = await evaluate(() => {
    const player = document.getElementById("player") as AvPlayer;
    player.stop();
    return { playState: player.playState, position: player.playPosition };
  });
  expect(stopped).toEqual({ playState: 0, position: 0 });

  // Played to the end: finished, at speed 0, with no pause on the way.
  const before = (await app(evaluate)).playStates.length;
  await evaluate(() => (document.getElementById("player") as AvPlayer).play(1));
  await until(evaluate, () => (document.getElementById("player") as AvPlayer).playState === 5, "finished");
  const end = await app(evaluate);
  const lastRun = end.playStates.slice(before);
  expect(lastRun[0]).toBe(CONNECTING);
  expect(lastRun).not.toContain(PAUSED);
  expect(lastRun[lastRun.length - 1]).toBe(FINISHED);
  expect(end.speeds).toEqual([1, 0, 1, 0]);

  // OIPF DAE §7.14.9, §7.14.3.2: each intrinsic event is a DOM event of the object too.
  expect(end.dom).toEqual({ playStates: end.playStates.length, speeds: end.speeds, positions: end.positions });
};

const ERROR = 6;
/** A/V Control `error` 1 (`ErrorCode.CONNECTION_ERROR`): cannot connect to server or connection lost. */
const CONNECTION_ERROR = 1;

/**
 * A stream that cannot be reached (`start` sets a source that is not there, then
 * plays it): once the player gives up, the application gets ERROR and why, and
 * nothing more happens.
 */
export const runUnreachableStreamScenario = async (evaluate: Evaluate, start: () => boolean) => {
  expect(await evaluate(start)).toBe(true);
  await until(evaluate, () => (document.getElementById("player") as AvPlayer).playState === 6, "error", 20_000);

  const failed = async () => ({
    playStates: (await app(evaluate)).playStates,
    error: await evaluate(() => (document.getElementById("player") as unknown as { error: number }).error),
  });
  expect(await failed()).toEqual({ playStates: [CONNECTING, ERROR], error: CONNECTION_ERROR });
  // The player does not try again behind the application's back.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  expect(await failed()).toEqual({ playStates: [CONNECTING, ERROR], error: CONNECTION_ERROR });
};

type AudioAppState = {
  initError: string | null;
  bound: Record<string, boolean>;
  playStates: { mp3: number[]; aac: number[] };
  speeds: { mp3: number[]; aac: number[] };
};

const audioApp = (evaluate: Evaluate) => evaluate(() => (window as unknown as { __e2e: AudioAppState }).__e2e);

/**
 * `audio-app/index.xhtml`: A/V Control objects of the audio types of TS 102 796
 * Table 9 (`audio/mpeg`, `audio/mp4`) are bound, and play a 1 s clip to the end.
 */
export const runAudioScenario = async (evaluate: Evaluate) => {
  expect(await audioApp(evaluate)).toMatchObject({ initError: null, bound: { mp3: true, aac: true } });

  expect(await evaluate(() => ["mp3", "aac"].map((id) => (document.getElementById(id) as AvPlayer).play(1)))).toEqual([
    true,
    true,
  ]);
  await until(
    evaluate,
    () => ["mp3", "aac"].every((id) => (document.getElementById(id) as AvPlayer).playState === 5),
    "both finished",
  );

  const { playStates } = await audioApp(evaluate);
  for (const states of [playStates.mp3, playStates.aac]) {
    expect(states[0]).toBe(CONNECTING);
    expect(states).toContain(PLAYING);
    expect(states[states.length - 1]).toBe(FINISHED);
  }
};

/**
 * `audio-app/index.xhtml`, HbbTV's `queue()` (TS 102 796 A.2.5.1): a jingle queued
 * after the radio clip plays by itself when the clip ends, with no stop between and
 * the speed unchanged. A second item while one is queued is refused.
 */
export const runQueueScenario = async (evaluate: Evaluate) => {
  expect(await audioApp(evaluate)).toMatchObject({ initError: null, bound: { mp3: true } });

  expect(
    await evaluate(() => {
      const player = document.getElementById("mp3") as AvPlayer;
      return [player.play(1), player.queue("chime.mp3"), player.queue("tone.m4a")];
    }),
  ).toEqual([true, true, false]);
  await until(
    evaluate,
    () => {
      const player = document.getElementById("mp3") as AvPlayer;
      return player.data === "chime.mp3" && player.playState === 5;
    },
    "the queued item finished",
  );

  const { playStates, speeds } = await audioApp(evaluate);
  const first = playStates.mp3.indexOf(FINISHED);
  const [clip, jingle] = [playStates.mp3.slice(0, first + 1), playStates.mp3.slice(first + 1)];
  expect(clip[0]).toBe(CONNECTING);
  expect(clip).toContain(PLAYING);
  expect(jingle[0]).toBe(CONNECTING);
  expect(jingle).toContain(PLAYING);
  expect(jingle[jingle.length - 1]).toBe(FINISHED);
  expect(playStates.mp3).not.toContain(STOPPED);
  expect(speeds.mp3).toEqual([1, 0]);
};
