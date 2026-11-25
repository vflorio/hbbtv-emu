/**
 * Keeps the page bootstrap (the data injected at `document_start`) in sync with the
 * configuration and the TV sessions. When the host cannot inject it, pages still get
 * the configuration and their session through messages, only later (after the first
 * application scripts).
 */

import type { Logger } from "@hbb-emu/core";
import { type BootstrapData, configBootstrapScript } from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import { IORef } from "fp-ts/IORef";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { PageBootstrapAdapter } from "../../adapter";

export type PageBootstrap = Readonly<{
  /**
   * Publishes this data for the pages loaded from now on. Nothing if it is what they
   * already get; again if the last attempt failed (the user may have allowed it since).
   */
  publish: (data: BootstrapData) => T.Task<void>;
}>;

type Status = "unknown" | "published" | "unavailable";

export const createPageBootstrap = (adapter: PageBootstrapAdapter, logger: Logger): PageBootstrap => {
  const status = new IORef<Status>("unknown");
  /** The code pages get now, once published. */
  const current = new IORef<string | null>(null);

  /** Logs only when the status changes, not on every page load. */
  const becomes =
    (next: Status, log: IO.IO<void>): IO.IO<void> =>
    () => {
      if (status.read() !== next) log();
      status.write(next)();
    };

  const publishCode = (code: string): T.Task<void> =>
    pipe(
      adapter.publish(code),
      TE.match(
        (error) =>
          becomes(
            "unavailable",
            logger.warn(
              "The configuration reaches pages only after their first scripts (no synchronous bootstrap)",
              error,
            ),
          ),
        () => () => {
          current.write(code)();
          becomes("published", logger.info("Configuration bootstrap published"))();
        },
      ),
      T.flatMap(T.fromIO),
    );

  /**
   * One publish at a time, in order: they come from page loads, the UI and closed tabs,
   * and overlapping ones could leave older data in place (or register the script twice).
   */
  const queue = new IORef<Promise<void>>(Promise.resolve());
  const serially =
    (task: T.Task<void>): T.Task<void> =>
    () => {
      const next = queue.read().then(task);
      queue.write(next)();
      return next;
    };

  const publish = (data: BootstrapData): T.Task<void> =>
    serially(() => {
      const code = configBootstrapScript(data);
      return status.read() === "published" && current.read() === code ? Promise.resolve() : publishCode(code)();
    });

  return { publish };
};
