/**
 * The application starts another (`createApplication()`): the host's TV session
 * decides (ROADMAP D5). It loads the new application's page in the tab, which ends
 * this one, or answers that it cannot (`Host/ApplicationLoadError`).
 *
 * No timeout: a page that takes long to load is no error, and this one only ends
 * once the next one starts loading.
 */

import type { ApplicationLaunch } from "@hbb-emu/oipf-runtime";
import type { PageMessage } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import type * as IO from "fp-ts/IO";

export type HostApplicationLaunches = Readonly<{
  launch: ApplicationLaunch;
  /** The host could not start the application at `url`. */
  fail: (url: string, reason: string) => IO.IO<void>;
}>;

export const createHostApplicationLaunches = (send: (message: PageMessage) => IO.IO<void>): HostApplicationLaunches => {
  const pending = new Map<string, ReadonlyArray<(result: E.Either<string, void>) => void>>();
  return {
    launch: (url) => () =>
      new Promise((settle) => {
        pending.set(url, [...(pending.get(url) ?? []), settle]);
        send({ _tag: "Page/CreateApplication", url })();
      }),
    fail: (url, reason) => () => {
      const waiting = pending.get(url) ?? [];
      pending.delete(url);
      for (const settle of waiting) settle(E.left(reason));
    },
  };
};
