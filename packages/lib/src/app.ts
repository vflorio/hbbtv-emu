import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";

export interface App {
  init: IO.IO<void>;
}

export const initApp = (app: App): IO.IO<void> => {
  const runInit: IO.IO<void> = app.init;

  const initOnDomReady: IO.IO<void> = () => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runInit);
    } else {
      runInit();
    }
  };

  return pipe(
    O.fromNullable(typeof document !== "undefined" ? document : null),
    O.fold(
      () => runInit,
      () => initOnDomReady,
    ),
  );
};
