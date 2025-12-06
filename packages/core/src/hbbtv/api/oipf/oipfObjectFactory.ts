/**
 * OIPF Object Factory API
 *
 * The oipfObjectFactory is a global object available on `window` that provides
 * methods for creating embedded objects (both visual and non-visual) in HbbTV applications.
 *
 * Unlike other OIPF objects, the Object Factory is accessed directly from the
 * global scope without requiring an `<object>` element.
 *
 * Objects can also be created using:
 * - The `<object>` element in HTML
 * - The DOM `createElement()` method
 *
 * @example
 * ```typescript
 * // Access the factory directly from window
 * const factory = window.oipfObjectFactory;
 *
 * // Check support and create objects
 * if (factory.isObjectSupported('video/broadcast')) {
 *   const vb = factory.createVideoBroadcastObject();
 *   document.body.appendChild(vb);
 * }
 *
 * // Create non-visual objects
 * const appMgr = factory.createApplicationManagerObject();
 * const config = factory.createConfigurationObject();
 * ```
 *
 * @see OIPF DAE Specification Clause 7.1
 * @see HbbTV 1.0 (ETSI TS 102 796 V1.1.1)
 * @since HbbTV 1.0
 * @module hbbtv/api/oipf/objectFactory
 */

import type { ChannelConfig } from "../avBroadcast/channel";

// ============================================================================
// MIME Types
// ============================================================================

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

/**
 * HbbTV-specific MIME types for embedded objects.
 *
 * @since HbbTV 2.0
 */
export type HbbTVMimeType = "application/hbbtvMediaSynchroniser" | "application/hbbtvCSManager";

/**
 * All supported MIME types for object factory queries.
 */
export type ObjectFactoryMimeType = DAEMimeType | HbbTVMimeType;

// ============================================================================
// Allocation Method
// ============================================================================

/**
 * Resource allocation method for visual objects.
 */
export enum AllocationMethod {
  /**
   * Dynamic allocation - resources claimed when needed.
   * Used when `requiredCapabilities` is omitted.
   */
  DYNAMIC_ALLOCATION = 0,

  /**
   * Static allocation - resources claimed at instantiation.
   * Used when `requiredCapabilities` is provided.
   */
  STATIC_ALLOCATION = 1,
}

// ============================================================================
// MediaSynchroniser Interface
// ============================================================================

/**
 * MediaSynchroniser embedded object.
 *
 * Provides multi-stream synchronization capabilities for HbbTV applications.
 *
 * @see HbbTV Clause A.2.7
 * @since HbbTV 2.0
 */
export type MediaSynchroniser = {};

// ============================================================================
// CSManager Interface
// ============================================================================

/**
 * HbbTV Companion Screen Manager embedded object.
 *
 * Provides companion screen functionality for HbbTV applications.
 *
 * @see HbbTV Clause A.2.7
 * @since HbbTV 2.0
 */
export type HbbTVCSManager = {};

// ============================================================================
// Object Factory Interface
// ============================================================================

/**
 * OIPF Object Factory Interface.
 *
 * The oipfObjectFactory is a global object accessible via `window.oipfObjectFactory`
 * that provides methods for creating HbbTV/OIPF embedded objects.
 *
 * Objects can be either:
 * - **Visual** (HTMLObjectElement) - insertable into DOM for rendering
 * - **Non-visual** (JavaScript objects) - implementing specific interfaces
 *
 * @example
 * ```typescript
 * // Access directly from window (no <object> element needed)
 * const factory = window.oipfObjectFactory;
 *
 * // Check if video/broadcast is supported
 * if (factory.isObjectSupported('video/broadcast')) {
 *   const vb = factory.createVideoBroadcastObject();
 *   document.body.appendChild(vb);
 * }
 *
 * // Create non-visual objects
 * const appMgr = factory.createApplicationManagerObject();
 * const config = factory.createConfigurationObject();
 * ```
 *
 * @see OIPF DAE Specification Clause 7.1
 */
export interface OipfObjectFactory {
  // ==========================================================================
  // Object Support Query
  // ==========================================================================

  /**
   * Checks if an object of the specified MIME type is supported.
   *
   * Returns `true` if the terminal supports creating objects of the
   * specified type, `false` otherwise.
   *
   * For MIME types defined in OIPF_MEDIA2 tables 1-4 or DAE-defined types,
   * an accurate indication of support SHALL be returned.
   *
   * @param mimeType - The MIME type to check support for
   * @returns `true` if the object type is supported
   */
  isObjectSupported(mimeType: ObjectFactoryMimeType | string): boolean;

  // ==========================================================================
  // Visual Objects (HTMLObjectElement)
  // ==========================================================================

  /**
   * Creates a video/broadcast embedded object.
   *
   * The returned HTMLObjectElement can be inserted into the DOM tree.
   * The `type` attribute will be set to "video/broadcast".
   *
   * Since objects do not claim scarce resources when instantiated,
   * instantiation shall never fail if the object type is supported.
   *
   * @param requiredCapabilities - Optional formats to be supported.
   *        If provided, resources are claimed at instantiation (STATIC_ALLOCATION).
   *        If omitted, resources are claimed dynamically (DYNAMIC_ALLOCATION).
   *        Note: This argument shall not be used in HbbTV and can be ignored.
   *
   * @returns An HTMLObjectElement for video/broadcast, or null if
   *          requiredCapabilities cannot be satisfied
   * @throws {TypeError} If the method is not supported
   */
  createVideoBroadcastObject(requiredCapabilities?: readonly string[]): HTMLObjectElement | null;

  /**
   * Creates a video/mpeg embedded object (A/V Control object).
   *
   * The returned HTMLObjectElement can be inserted into the DOM tree.
   *
   * @param requiredCapabilities - Optional formats to be supported.
   *        Note: This argument shall not be used in HbbTV and can be ignored.
   *
   * @returns An HTMLObjectElement for video playback, or null if
   *          requiredCapabilities cannot be satisfied
   * @throws {TypeError} If the method is not supported
   */
  createVideoMpegObject(requiredCapabilities?: readonly string[]): HTMLObjectElement | null;

  /**
   * Creates a status view embedded object.
   *
   * @returns An HTMLObjectElement for the status view
   * @throws {TypeError} If the method is not supported
   */
  createStatusViewObject(): HTMLObjectElement;

  // ==========================================================================
  // HbbTV-specific Visual Objects
  // ==========================================================================

  /**
   * Creates a MediaSynchroniser embedded object.
   *
   * Provides multi-stream synchronization capabilities.
   *
   * @returns A new MediaSynchroniser object
   * @throws {TypeError} If the method is not supported
   *
   * @see HbbTV Clause A.2.7
   * @since HbbTV 2.0
   */
  createMediaSynchroniser(): MediaSynchroniser;

  /**
   * Creates an HbbTV Companion Screen Manager embedded object.
   *
   * Provides companion screen functionality.
   *
   * @returns A new HbbTVCSManager object
   * @throws {TypeError} If the method is not supported
   *
   * @see HbbTV Clause A.2.7
   * @since HbbTV 2.0
   */
  createCSManager(): HbbTVCSManager;

  // ==========================================================================
  // Non-Visual Objects (JavaScript Objects)
  // ==========================================================================

  /**
   * Creates an Application Manager object.
   *
   * @returns An object implementing the ApplicationManager interface
   * @throws {TypeError} If the method is not supported
   */
  createApplicationManagerObject(): object;

  /**
   * Creates a Capabilities object.
   *
   * @returns An object implementing the Capabilities interface
   * @throws {TypeError} If the method is not supported
   */
  createCapabilitiesObject(): object;

  /**
   * Creates a Channel Configuration object.
   *
   * @returns A ChannelConfig object
   * @throws {TypeError} If the method is not supported
   */
  createChannelConfig(): ChannelConfig;

  /**
   * Creates a COD (Content on Demand) Manager object.
   *
   * @returns An object implementing the CodManager interface
   * @throws {TypeError} If the method is not supported
   */
  createCodManagerObject(): object;

  /**
   * Creates a Configuration object.
   *
   * @returns An object implementing the Configuration interface
   * @throws {TypeError} If the method is not supported
   */
  createConfigurationObject(): object;

  /**
   * Creates a Download Manager object.
   *
   * @returns An object implementing the DownloadManager interface
   * @throws {TypeError} If the method is not supported
   */
  createDownloadManagerObject(): object;

  /**
   * Creates a Download Trigger object.
   *
   * @returns An object implementing the DownloadTrigger interface
   * @throws {TypeError} If the method is not supported
   */
  createDownloadTriggerObject(): object;

  /**
   * Creates a DRM Agent object.
   *
   * @returns An object implementing the DrmAgent interface
   * @throws {TypeError} If the method is not supported
   */
  createDrmAgentObject(): object;

  /**
   * Creates a Gateway Info object.
   *
   * @returns An object implementing the GatewayInfo interface
   * @throws {TypeError} If the method is not supported
   */
  createGatewayInfoObject(): object;

  /**
   * Creates an IMS (IP Multimedia Subsystem) object.
   *
   * @returns An object implementing the IMS interface
   * @throws {TypeError} If the method is not supported
   */
  createIMSObject(): object;

  /**
   * Creates an MDTF (Metadata Transfer) object.
   *
   * @returns An object implementing the MDTF interface
   * @throws {TypeError} If the method is not supported
   */
  createMDTFObject(): object;

  /**
   * Creates a Notification Socket object.
   *
   * @returns An object implementing the NotifSocket interface
   * @throws {TypeError} If the method is not supported
   */
  createNotifSocketObject(): object;

  /**
   * Creates a Parental Control Manager object.
   *
   * @returns An object implementing the ParentalControlManager interface
   * @throws {TypeError} If the method is not supported
   */
  createParentalControlManagerObject(): object;

  /**
   * Creates a Recording Scheduler object.
   *
   * @returns An object implementing the RecordingScheduler interface
   * @throws {TypeError} If the method is not supported
   */
  createRecordingSchedulerObject(): object;

  /**
   * Creates a Remote Control Function object.
   *
   * @returns An object implementing the RemoteControlFunction interface
   * @throws {TypeError} If the method is not supported
   */
  createRemoteControlFunctionObject(): object;

  /**
   * Creates a Remote Management object.
   *
   * @returns An object implementing the RemoteManagement interface
   * @throws {TypeError} If the method is not supported
   */
  createRemoteManagementObject(): object;

  /**
   * Creates a Search Manager object.
   *
   * @returns An object implementing the SearchManager interface
   * @throws {TypeError} If the method is not supported
   */
  createSearchManagerObject(): object;
}
