export * as ApplicationManager from "./applicationManager";
export * as Capabilities from "./capabilities";
export * as Configuration from "./configuration";
export * as ObjectFactory from "./objectFactory";
export * as Broadcast from "./videoBroadcast";

// ------------------------------------------------------------
// Declarative Application Environment (DAE)
// ------------------------------------------------------------

/**
 * MIME types for embedded objects.
 *
 * These MIME types can be used with `isObjectSupported()` to query
 * terminal capabilities.
 */
export type MimeType =
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
