/**
 * Connects the page runtime to its host (the bridge, then the background).
 *
 * The runtime has already started with the default configuration: it never waits
 * for the host, so the OIPF APIs exist before the first application script. The
 * host configuration is applied whenever it arrives.
 */

import type { HbbTVState } from "@hbb-emu/oipf-api";
import type {
  DomChannel,
  HostMessage,
  PageConfig,
  PageMessage,
  PageSession,
  StreamEventDescriptionResult,
} from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";

/** What the host can ask of the running runtime. */
export type PageRuntimeControl = Readonly<{
  applyConfig: (config: PageConfig) => IO.IO<void>;
  dispatchKey: (keyCode: number) => IO.IO<void>;
  /** An explicit edit of OIPF object state: only the given fields change. */
  applyState: (patch: Partial<HbbTVState>) => IO.IO<void>;
  /** The tab's TV session (e.g. the channel the TV is tuned to). */
  applySession: (session: PageSession) => IO.IO<void>;
  /** The TV did not change to the channel the application asked for. */
  channelChangeFailed: (channelId: string, error: number) => IO.IO<void>;
  /** The host fetched (or could not fetch) a stream event description. */
  streamEventDescriptionFetched: (url: string, result: StreamEventDescriptionResult) => IO.IO<void>;
  /** The TV could not start the application the page asked for (`createApplication()`). */
  applicationLoadFailed: (url: string, reason: string) => IO.IO<void>;
}>;

export type HostEnv = Readonly<{
  channel: DomChannel<PageMessage, HostMessage>;
  control: PageRuntimeControl;
  url: string;
}>;

const announce: RIO.ReaderIO<HostEnv, void> = ({ channel, url }) => channel.send({ _tag: "Page/Ready", url });

const handle =
  (message: HostMessage): RIO.ReaderIO<HostEnv, void> =>
  (env) => {
    switch (message._tag) {
      case "Host/Hello":
        return announce(env);
      case "Host/Config":
        return env.control.applyConfig(message.config);
      case "Host/DispatchKey":
        return env.control.dispatchKey(message.keyCode);
      case "Host/ApplyState":
        return env.control.applyState(message.patch);
      case "Host/Session":
        return env.control.applySession(message.session);
      case "Host/ChannelChangeError":
        return env.control.channelChangeFailed(message.channelId, message.error);
      case "Host/StreamEventDescription":
        return env.control.streamEventDescriptionFetched(message.url, message.result);
      case "Host/ApplicationLoadError":
        return env.control.applicationLoadFailed(message.url, message.reason);
    }
  };

/** Subscribes to host messages and announces the page. Returns the disconnect effect. */
export const connectToHost: RIO.ReaderIO<HostEnv, IO.IO<void>> = (env) =>
  pipe(
    env.channel.subscribe((message) => handle(message)(env)),
    IO.tap(() => announce(env)),
  );
