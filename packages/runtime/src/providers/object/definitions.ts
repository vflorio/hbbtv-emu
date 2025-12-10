import {
  type ApplicationManagerState,
  AV_CONTROL_DASH_MIME_TYPE,
  AV_CONTROL_VIDEO_MP4_MIME_TYPE,
  type AVControlState,
  isValidAvControlDash,
  isValidAvControlVideoMp4,
  OIPF,
  type OipfCapabilitiesState,
  type OipfConfigurationState,
  type VideoBroadcastState,
} from "@hbb-emu/oipf";
import { AVControlVideo } from "../../av";
import { OipfApplicationManager } from "../../dae/applicationManager";
import { OipfCapabilities } from "../../dae/capabilities";
import { OipfConfiguration } from "../../dae/configuration";
import { VideoBroadcast } from "../../dae/videoBroadcast";
import type { ObjectDefinition } from "../../types";

// DAE Object Definitions

export const oipfApplicationManagerDefinition: ObjectDefinition<
  OipfApplicationManager,
  ApplicationManagerState,
  "applicationManager"
> = {
  name: "OipfApplicationManager",
  selector: `object[type="${OIPF.DAE.ApplicationManager.MIME_TYPE}"]`,
  predicate: OIPF.DAE.ApplicationManager.isValidElement,
  factory: () => new OipfApplicationManager(),
  stateKey: "applicationManager",
  attachStrategy: "copy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

export const oipfCapabilitiesDefinition: ObjectDefinition<OipfCapabilities, OipfCapabilitiesState, "oipfCapabilities"> =
  {
    name: "OipfCapabilities",
    selector: `object[type="${OIPF.DAE.Capabilities.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Capabilities.isValidElement,
    factory: () => new OipfCapabilities(),
    stateKey: "oipfCapabilities",
    attachStrategy: "copy",
    applyState: (instance, state) => instance.applyState(state ?? {}),
    getState: (instance) => instance.getState(),
    subscribe: (instance, callback) => instance.subscribe(callback),
  };

export const oipfConfigurationDefinition: ObjectDefinition<
  OipfConfiguration,
  OipfConfigurationState,
  "oipfConfiguration"
> = {
  name: "OipfConfiguration",
  selector: `object[type="${OIPF.DAE.Configuration.MIME_TYPE}"]`,
  predicate: OIPF.DAE.Configuration.isValidElement,
  factory: () => new OipfConfiguration(),
  stateKey: "oipfConfiguration",
  attachStrategy: "copy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

export const videoBroadcastDefinition: ObjectDefinition<VideoBroadcast, VideoBroadcastState, "videoBroadcast"> = {
  name: "VideoBroadcast",
  selector: `object[type="${OIPF.DAE.Broadcast.MIME_TYPE}"]`,
  predicate: OIPF.DAE.Broadcast.isValidElement,
  factory: () => new VideoBroadcast(),
  stateKey: "videoBroadcast",
  attachStrategy: "proxy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

// A/V Control Definitions

export const avVideoMp4Definition: ObjectDefinition<AVControlVideo, AVControlState, "avControls"> = {
  name: "AvVideoMp4",
  selector: `object[type="${AV_CONTROL_VIDEO_MP4_MIME_TYPE}"]`,
  predicate: isValidAvControlVideoMp4,
  factory: () => new AVControlVideo(),
  stateKey: "avControls",
  attachStrategy: "proxy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

export const avVideoDashDefinition: ObjectDefinition<AVControlVideo, AVControlState, "avControls"> = {
  name: "AvVideoDash",
  selector: `object[type="${AV_CONTROL_DASH_MIME_TYPE}"]`,
  predicate: isValidAvControlDash,
  factory: () => new AVControlVideo(),
  stateKey: "avControls",
  attachStrategy: "proxy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

export const oipfObjectDefinitions = [
  oipfApplicationManagerDefinition,
  oipfCapabilitiesDefinition,
  oipfConfigurationDefinition,
  videoBroadcastDefinition,
  avVideoMp4Definition,
  avVideoDashDefinition,
];
