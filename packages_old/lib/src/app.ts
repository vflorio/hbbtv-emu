import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";

export interface App {
  init: IO.IO<void>;
}

export const initApp = (app: App): IO.IO<void> => {
  // biome-ignore format: ack
  const initOnDomReady: IO.IO<void> = () =>
    document.readyState === "loading" 
      ? document.addEventListener("DOMContentLoaded", app.init) 
      : app.init();

  return pipe(
    O.fromNullable(typeof document !== "undefined" ? document : null),
    O.match(
      () => app.init,
      () => initOnDomReady,
    ),
  );
};
