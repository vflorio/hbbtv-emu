export * as applicationManager from "./applicationManager";
export * as capabilities from "./capabilities";
export * as configuration from "./configuration";
export * as objectFactory from "./objectFactory";
export * as broadcast from "./videoBroadcast";

/**
 * DAE-defined MIME types for embedded objects.
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
