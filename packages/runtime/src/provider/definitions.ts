import {
  type ApplicationManagerState,
  OIPF,
  type OipfCapabilitiesState,
  type OipfConfigurationState,
  type VideoBroadcastState,
} from "@hbb-emu/oipf";
import type { AnyOipfDefinition, ObjectDefinition, VideoBroadcastPolyfillEnv } from "..";
import { OipfApplicationManager } from "../apis/dae/applicationManager";
import { OipfCapabilities } from "../apis/dae/capabilities";
import { OipfConfiguration } from "../apis/dae/configuration";
import { VideoBroadcast } from "../apis/dae/videoBroadcast";
import { createChannelVideoStreamEnv } from "../apis/dae/videoBroadcast/channel";

const oipfApplicationManagerDefinition: ObjectDefinition<
  OipfApplicationManager,
  ApplicationManagerState,
  "applicationManager"
> = {
  name: "OipfApplicationManager",
  selector: `object[type="${OIPF.DAE.ApplicationManager.MIME_TYPE}"]`,
  predicate: OIPF.DAE.ApplicationManager.isValidElement,
  factory: () => new OipfApplicationManager(),
  stateKey: "applicationManager",
  attachStrategy: "non-visual",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

const oipfCapabilitiesDefinition: ObjectDefinition<OipfCapabilities, OipfCapabilitiesState, "oipfCapabilities"> = {
  name: "OipfCapabilities",
  selector: `object[type="${OIPF.DAE.Capabilities.MIME_TYPE}"]`,
  predicate: OIPF.DAE.Capabilities.isValidElement,
  factory: () => new OipfCapabilities(),
  stateKey: "oipfCapabilities",
  attachStrategy: "non-visual",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

const oipfConfigurationDefinition: ObjectDefinition<OipfConfiguration, OipfConfigurationState, "oipfConfiguration"> = {
  name: "OipfConfiguration",
  selector: `object[type="${OIPF.DAE.Configuration.MIME_TYPE}"]`,
  predicate: OIPF.DAE.Configuration.isValidElement,
  factory: () => new OipfConfiguration(),
  stateKey: "oipfConfiguration",
  attachStrategy: "non-visual",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

const createVideoBroadcastDefinition = (
  env: VideoBroadcastPolyfillEnv,
): ObjectDefinition<VideoBroadcast, VideoBroadcastState, "videoBroadcast"> => ({
  name: "VideoBroadcast",
  selector: `object[type="${OIPF.DAE.Broadcast.MIME_TYPE}"]`,
  predicate: OIPF.DAE.Broadcast.isValidElement,
  factory: () =>
    new VideoBroadcast({
      channelRegistry: env.channelRegistry,
      videoStream: createChannelVideoStreamEnv(env.createVideoStreamEnv()),
    }),
  stateKey: "videoBroadcast",
  attachStrategy: "visual",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
});

// TODO: AVControlVideo
// const createAvControlDefinitions = (env: FactoryEnv) => [...]

const staticDefinitions: ReadonlyArray<AnyOipfDefinition> = [
  oipfApplicationManagerDefinition,
  oipfCapabilitiesDefinition,
  oipfConfigurationDefinition,
];

export const createObjectDefinitions = (env: VideoBroadcastPolyfillEnv): ReadonlyArray<AnyOipfDefinition> => [
  ...staticDefinitions,
  createVideoBroadcastDefinition(env),
  // TODO: ...createAvControlDefinitions(env),
];
