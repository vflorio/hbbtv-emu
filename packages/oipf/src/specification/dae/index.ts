export * as ApplicationManager from "./applicationManager";
export * as Capabilities from "./capabilities";
export * as Configuration from "./configuration";
export * as VideoBroadcast from "./videoBroadcast";

/**
 * DAE-defined MIME types for embedded objects.
 *
 * These MIME types can be used with `isObjectSupported()` to query
 * terminal capabilities.
 */
export type DAEMimeType =
  | "application/notifsocket"
  | "application/oipfApplicationManager"
  | "application/oipfCapabilities"
  | "application/oipfCodManager"
  | "application/oipfCommunicationServices"
  | "application/oipfConfiguration"
  | "application/oipfDownloadManager"
  | "application/oipfDownloadTrigger"
  | "application/oipfDrmAgent"
  | "application/oipfGatewayInfo"
  | "application/oipfMDTF"
  | "application/oipfParentalControlManager"
  | "application/oipfRecordingScheduler"
  | "application/oipfRemoteControlFunction"
  | "application/oipfRemoteManagement"
  | "application/oipfSearchManager"
  | "application/oipfStatusView"
  | "video/broadcast";
