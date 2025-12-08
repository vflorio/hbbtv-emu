import { buildDefaultUserAgent, createLogger, DEFAULT_HBBTV_VERSION } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

const logger = createLogger("UserAgent");

export const overrideUserAgent = (userAgent: string): IO.IO<void> =>
  pipe(
    logger.debug("Overriding navigator.userAgent:", userAgent),
    IO.flatMap(() => () => {
      Object.defineProperty(navigator, "userAgent", {
        get: () => userAgent,
        configurable: true,
      });

      Object.defineProperty(navigator, "appVersion", {
        get: () => userAgent.replace("Mozilla/", ""),
        configurable: true,
      });
    }),
    IO.tap(() => logger.debug("navigator.userAgent override complete")),
  );

export const initializeUserAgent = (userAgent: string | undefined, hbbtvVersion: string | undefined): IO.IO<void> =>
  pipe(IO.of(userAgent ?? buildDefaultUserAgent(hbbtvVersion || DEFAULT_HBBTV_VERSION)), IO.flatMap(overrideUserAgent));
