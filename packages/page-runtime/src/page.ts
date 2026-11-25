/**
 * The whole page side, as hosts load it: start the runtime (HbbTV documents only),
 * then connect it to the host through the DOM channel.
 */

import { createPageChannel, type PageConfig, receiveBootstrapConfig } from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { IORef } from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import { bootPageRuntime } from "./boot";
import { connectToHost } from "./host";
import { applyBootstrapConfig, controlRuntime, startRuntime } from "./runtime";

export const startPage = (window: Window, document: Document): IO.IO<void> => {
  const url = document.URL;
  const applyLate = new IORef<O.Option<(config: PageConfig) => IO.IO<void>>>(O.none);

  // A bootstrap script injected after this one runs only once this whole startup is
  // done (scripts do not interleave), so the runtime is always there by then.
  const onLateConfig = (config: PageConfig) =>
    pipe(
      applyLate.read(),
      O.map((apply) => apply(config)()),
    );

  return pipe(
    bootPageRuntime({
      window,
      document,
      startRuntime: pipe(receiveBootstrapConfig(window, onLateConfig), IO.flatMap(startRuntime(url))),
    }),
    IO.flatMap(
      O.match(
        () => IO.of(undefined),
        (handle) =>
          pipe(
            applyLate.write(O.some(applyBootstrapConfig(handle, url))),
            IO.flatMap(() =>
              connectToHost({ channel: createPageChannel(document), control: controlRuntime(handle), url }),
            ),
            IO.asUnit,
          ),
      ),
    ),
  );
};
