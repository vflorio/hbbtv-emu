/**
 * Keeps the page bootstrap (the configuration injected at `document_start`) in sync
 * with the configuration. When the host cannot inject it, pages still get the
 * configuration through messages, only later (after the first application scripts).
 */

import type { Logger } from "@hbb-emu/core";
import { configBootstrapScript, type PageConfig } from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import { IORef } from "fp-ts/IORef";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { PageBootstrapAdapter } from "../../adapter";

export type PageBootstrap = Readonly<{
  /** Publishes this configuration for the pages loaded from now on. */
  publish: (config: PageConfig) => T.Task<void>;
  /** Publishes again only if the last attempt failed (the user may have allowed it since). */
  retry: (config: PageConfig) => T.Task<void>;
}>;

type Status = "unknown" | "published" | "unavailable";

export const createPageBootstrap = (adapter: PageBootstrapAdapter, logger: Logger): PageBootstrap => {
  const status = new IORef<Status>("unknown");

  /** Logs only when the status changes, not on every page load. */
  const becomes =
    (next: Status, log: IO.IO<void>): IO.IO<void> =>
    () => {
      if (status.read() !== next) log();
      status.write(next)();
    };

  const publish = (config: PageConfig): T.Task<void> =>
    pipe(
      adapter.publish(configBootstrapScript(config)),
      TE.match(
        (error) =>
          becomes(
            "unavailable",
            logger.warn(
              "The configuration reaches pages only after their first scripts (no synchronous bootstrap)",
              error,
            ),
          ),
        () => becomes("published", logger.info("Configuration bootstrap published")),
      ),
      T.flatMap(T.fromIO),
    );

  return {
    publish,
    retry: (config) => (status.read() === "published" ? T.of(undefined) : publish(config)),
  };
};
