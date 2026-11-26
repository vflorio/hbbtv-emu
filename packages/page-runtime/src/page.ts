/**
 * The whole page side, as hosts load it: start the runtime (HbbTV documents only),
 * then connect it to the host through the DOM channel.
 */

import { type BootstrapData, createPageChannel, receiveBootstrap } from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { IORef } from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import { bootPageRuntime } from "./boot";
import { createHostChannelChanges } from "./channelChange";
import { connectToHost } from "./host";
import { applyBootstrap, controlRuntime, startRuntime } from "./runtime";
import { createHostStreamEventDescriptions } from "./streamEventDescriptions";

export const startPage = (window: Window, document: Document): IO.IO<void> => {
  const url = document.URL;
  const channel = createPageChannel(document);
  // Created before the runtime: the application may change channel in its first script.
  const changes = createHostChannelChanges(channel.send);
  const descriptions = createHostStreamEventDescriptions(channel.send);
  const applyLate = new IORef<O.Option<(data: BootstrapData) => IO.IO<void>>>(O.none);

  // A bootstrap script injected after this one runs only once this whole startup is
  // done (scripts do not interleave), so the runtime is always there by then.
  const onLateBootstrap = (data: BootstrapData) =>
    pipe(
      applyLate.read(),
      O.map((apply) => apply(data)()),
    );

  return pipe(
    bootPageRuntime({
      window,
      document,
      startRuntime: pipe(
        receiveBootstrap(window, onLateBootstrap),
        IO.flatMap(
          startRuntime(url, {
            requestChannelChange: changes.request,
            pressTvKey: (keyCode) => channel.send({ _tag: "Page/TvKey", keyCode }),
            fetchStreamEventDescription: descriptions.fetch,
          }),
        ),
      ),
    }),
    IO.flatMap(
      O.match(
        () => IO.of(undefined),
        (handle) =>
          pipe(
            applyLate.write(O.some(applyBootstrap(handle, url))),
            IO.flatMap(() => connectToHost({ channel, control: controlRuntime(handle, changes, descriptions), url })),
            IO.asUnit,
          ),
      ),
    ),
  );
};
