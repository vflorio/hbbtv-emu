/**
 *  Provide strategy
 *  DOM Matcher
 *
 *  oipfObjectFactory       -> WithInject (window.oipfObjectFactory)
 *  oipfApplicationManager  -> WithCopy <object type="oipfApplicationManager" />
 *  oipfConfiguration       -> WithCopy <object type="oipfConfiguration" />
 *  oipfCapabilities        -> WithCopy <object type="oipfCapabilities" />
 *  avVideoBroadcast        -> WithProxy <object type="video/broadcast" />          WithState, WithVideoBackend
 *  avVideoMp4              -> WithProxy <object type="video/mp4" />                WithState, WithVideoBackend
 *  avVideoDash             -> WithProxy <object type="application/dash+xml" />     WithState, WithVideoBackend
 *
 *  Inject (append window.[apiName])
 *
 *  Proxy (properties & methods interception)
 *      DomObserver
 *
 *  VideoBackend ("low-level" implementation of video playback)
 *     HTML5VideoElementBackend
 *     ObjectStyleMirror (<object> style interception)
 *
 *  BackendDash = VideoBackend + (HTML5VideoElementBackend + DashJS)
 *
 * StateProvider
 *
 * createHbbtvApi = (State, Backend) => ApiObject
 */

import { type ClassType, compose, createLogger, WithDomObserver } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { avVideoBroadcastMatcher } from "./apis/avVideoBroadcast";
import { avVideoDashMatcher } from "./apis/avVideoDash";
import { avVideoMp4Matcher } from "./apis/avVideoMp4";
import { oipfApplicationManagerMatcher } from "./apis/oipfApplicationManager";
import { oipfCapabilitiesMatcher } from "./apis/oipfCapabilities";
import { oipfConfigurationMatcher } from "./apis/oipfConfiguration";
import { initializeOipfObjectFactory } from "./apis/oipfObjectFactory";
import { WithElementMatcherRegistry } from "./elementMatcher";
import { WithAppState } from "./state";

// biome-ignore format: composition
export const App = compose(
  class {},
  WithAppState,
  WithDomObserver,
  WithElementMatcherRegistry
);

export type Instance = InstanceType<typeof App>;

const logger = createLogger("Provider");

export const initialize = (app: Instance): IO.IO<void> =>
  pipe(
    logger.info("Initializing"),
    IO.flatMap(() => initializeOipfObjectFactory()),
    IO.tap(() => app.registerMatcher(oipfApplicationManagerMatcher)),
    IO.tap(() => app.registerMatcher(oipfCapabilitiesMatcher)),
    IO.tap(() => app.registerMatcher(oipfConfigurationMatcher)),
    IO.tap(() => app.registerMatcher(avVideoBroadcastMatcher)),
    IO.tap(() => app.registerMatcher(avVideoMp4Matcher)),
    IO.tap(() => app.registerMatcher(avVideoDashMatcher)),
    IO.flatMap(() => app.initMatchers),
  );

interface State {
  a?: 1;
}

export const WithState = <T extends ClassType>(Base: T) => class extends Base {};

const WithHTML5VideoElementBackend = <T extends ClassType<State>>(Base: T) => class extends Base {};

const WithObjectStyleMirror = <T extends ClassType>(Base: T) => class extends Base {};

export const WithVideoBackend = <T extends ClassType>(Base: T) =>
  compose(Base, WithHTML5VideoElementBackend, WithObjectStyleMirror);

export const WithInject = <T extends ClassType>(Base: T) => class extends Base {};

export const WithProxy = <T extends ClassType>(Base: T) => class extends Base {};
