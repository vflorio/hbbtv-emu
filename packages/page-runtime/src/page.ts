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
import { connectToHost, type PageRuntimeControl } from "./host";
import { controlRuntime, startRuntime } from "./runtime";

export const startPage = (window: Window, document: Document): IO.IO<void> => {
  const control = new IORef<O.Option<PageRuntimeControl>>(O.none);

  // A bootstrap script injected after this one runs only once this whole startup is
  // done (scripts do not interleave), so the control is always there by then.
  const onLateConfig = (config: PageConfig) =>
    pipe(
      control.read(),
      O.map((c) => c.applyConfig(config)()),
    );

  return pipe(
    bootPageRuntime({
      window,
      document,
      startRuntime: pipe(receiveBootstrapConfig(window, onLateConfig), IO.flatMap(startRuntime)),
    }),
    IO.flatMap(
      O.match(
        () => IO.of(undefined),
        (handle) =>
          pipe(
            IO.of(controlRuntime(handle)),
            IO.tap((c) => control.write(O.some(c))),
            IO.flatMap((c) => connectToHost({ channel: createPageChannel(document), control: c, url: document.URL })),
            IO.asUnit,
          ),
      ),
    ),
  );
};
