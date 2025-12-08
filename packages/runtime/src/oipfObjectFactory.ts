import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { OipfObjectFactory } from "./apis/oipfObjectFactory";
import { injectStrategy } from "./providers/object/attachStrategy";

const WINDOW_KEY = "oipfObjectFactory" as const;

export const initializeOipfObjectFactory: IO.IO<void> = pipe(
  IO.of(new OipfObjectFactory()),
  IO.flatMap((factory) => injectStrategy(factory, WINDOW_KEY)),
);
