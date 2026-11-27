/**
 * The TV session of every tab (ROADMAP D5): created when an HbbTV page first starts
 * in a tab, kept across the navigations of that tab, dropped when the tab closes.
 *
 * Kept in memory and written through to the session storage, so that a restarted
 * MV3 service worker finds them again. Storage failures are logged, never fatal:
 * the pages keep working with what is in memory.
 */

import type { Logger } from "@hbb-emu/core";
import type { AitApplicationId } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import { IORef } from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { StorageAdapter } from "../../adapter";
import { DEFAULT_TV_VOLUME, type TvSession, type TvSessions } from "../../state";

export type Sessions = Readonly<{
  /** Loads the stored sessions, keeping only those of tabs still open. */
  load: (openTabIds: ReadonlyArray<number>) => T.Task<void>;
  get: (tabId: number) => IO.IO<O.Option<TvSession>>;
  all: IO.IO<TvSessions>;
  /** The tab's session, created with `initial` if the tab has none yet. */
  open: (tabId: number, initial: TvSession) => T.Task<TvSession>;
  /** Changes the tab's session; none if the tab has no session (it is not a TV). */
  update: (tabId: number, f: (session: TvSession) => TvSession) => T.Task<O.Option<TvSession>>;
  close: (tabId: number) => T.Task<void>;
}>;

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

const isApplicationId = (value: unknown): value is AitApplicationId => {
  if (typeof value !== "object" || value === null) return false;
  const { orgId, appId } = value as Record<string, unknown>;
  return typeof orgId === "number" && typeof appId === "number";
};

/** A stored session, as this version understands it; older ones had no `url`, `app` nor `volume`. */
const toTvSession = (value: unknown): O.Option<TvSession> => {
  if (typeof value !== "object" || value === null) return O.none;
  const { mode, channelId, url = null, app = null, volume = DEFAULT_TV_VOLUME } = value as Record<string, unknown>;
  return (mode === "app" || mode === "tv") &&
    isNullableString(channelId) &&
    isNullableString(url) &&
    (app === null || isApplicationId(app)) &&
    typeof volume === "number"
    ? O.some({ mode, channelId, url, app, volume })
    : O.none;
};

/** What the storage returns may come from another version: anything unexpected is dropped. */
const keepValid = (stored: unknown, openTabIds: ReadonlyArray<number>): TvSessions => {
  if (typeof stored !== "object" || stored === null) return {};
  const open = new Set(openTabIds.map(String));
  const valid: Record<string, TvSession> = {};
  for (const [tabId, value] of Object.entries(stored as Record<string, unknown>)) {
    const session = toTvSession(value);
    if (open.has(tabId) && O.isSome(session)) valid[tabId] = session.value;
  }
  return valid;
};

export const createSessions = (storage: StorageAdapter<TvSessions>, logger: Logger): Sessions => {
  const sessions = new IORef<TvSessions>({});

  const persist: T.Task<void> = pipe(
    T.fromIO(sessions.read),
    T.flatMap((all) => storage.write(all)),
    TE.getOrElseW((error) => T.fromIO(logger.warn("Could not store the TV sessions", error))),
  );

  /**
   * Reads, changes and writes the sessions in one step, then stores them: tabs that
   * open or change at the same time (pages ready together, a restored browser
   * session) all keep their change. `f` returns the new sessions (the same object
   * when nothing changes: nothing is stored) and a result.
   */
  const change = <A>(f: (all: TvSessions) => Readonly<{ all: TvSessions; result: A }>): T.Task<A> =>
    pipe(
      T.fromIO(() => {
        const current = sessions.read();
        const { all, result } = f(current);
        if (all !== current) sessions.write(all)();
        return { changed: all !== current, result };
      }),
      T.tap(({ changed }) => (changed ? persist : T.of(undefined))),
      T.map(({ result }) => result),
    );

  const get =
    (tabId: number): IO.IO<O.Option<TvSession>> =>
    () =>
      O.fromNullable(sessions.read()[String(tabId)]);

  return {
    load: (openTabIds) =>
      pipe(
        storage.read(),
        TE.getOrElseW((error) =>
          pipe(
            T.fromIO(logger.warn("Could not read the TV sessions", error)),
            T.map(() => O.none),
          ),
        ),
        T.map(O.getOrElseW(() => ({}))),
        T.flatMap((stored) => change(() => ({ all: keepValid(stored, openTabIds), result: undefined }))),
      ),

    get,

    all: sessions.read,

    open: (tabId, initial) =>
      pipe(
        change((all) => {
          const existing = all[String(tabId)];
          return existing === undefined
            ? { all: { ...all, [String(tabId)]: initial }, result: O.none }
            : { all, result: O.some(existing) };
        }),
        T.flatMap(
          O.match(
            () =>
              pipe(
                T.fromIO(logger.info(`TV session opened in tab ${tabId}`, initial)),
                T.map(() => initial),
              ),
            T.of,
          ),
        ),
      ),

    update: (tabId, f) =>
      change((all) => {
        const session = all[String(tabId)];
        if (session === undefined) return { all, result: O.none };
        const next = f(session);
        return { all: { ...all, [String(tabId)]: next }, result: O.some(next) };
      }),

    close: (tabId) =>
      pipe(
        change((all) => {
          const { [String(tabId)]: closed, ...rest } = all;
          return closed === undefined ? { all, result: false } : { all: rest, result: true };
        }),
        T.flatMap((closed) =>
          closed ? T.fromIO(logger.info(`TV session closed with tab ${tabId}`)) : T.of(undefined),
        ),
      ),
  };
};
