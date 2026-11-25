/**
 * The whole page side, as hosts load it: start the runtime (HbbTV documents only),
 * then connect it to the host through the DOM channel.
 */

import { createPageChannel } from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import { bootPageRuntime } from "./boot";
import { connectToHost } from "./host";
import { controlRuntime, startRuntime } from "./runtime";

export const startPage = (window: Window, document: Document): IO.IO<void> =>
  pipe(
    bootPageRuntime({ window, document, startRuntime: startRuntime() }),
    IO.flatMap(
      O.match(
        () => IO.of(undefined),
        (handle) =>
          pipe(
            connectToHost({ channel: createPageChannel(document), control: controlRuntime(handle), url: document.URL }),
            IO.asUnit,
          ),
      ),
    ),
  );
