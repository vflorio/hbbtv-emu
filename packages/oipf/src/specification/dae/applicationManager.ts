/*
 * ----------------------------------------------------------------------
 * application/oipfApplicationManager
 * -------------------------------------------------------------------- */

import type { Channel } from "./videoBroadcast";

/** Application manager entry point (oipfApplicationManager object). */
export interface ApplicationManager {
  /** Return the currently running application (Application class). */
  getOwnerApplication(document?: Document): Application | null;

  /** Retrieve an application by identifier (availability varies). */
  getApplication(appId: string): Application | null;

  /** Control broadcast video transparency behind app UI. */
  setVideoTransparency?(transparent: boolean): void;

  /** Subscribe to application manager events. */
  addEventListener?(
    type: ApplicationManagerEventType,
    listener: EventListenerOrEventListenerObject,
    useCapture?: boolean,
  ): void;

  /** Unsubscribe from application manager events. */
  removeEventListener?(
    type: ApplicationManagerEventType,
    listener: EventListenerOrEventListenerObject,
    useCapture?: boolean,
  ): void;
}

/** Application object representing the running HbbTV app. */
export interface Application {
  privateData?: ApplicationPrivateData;
  getKeyset(): Keyset | null;
  show(): void;
  hide(): void;
  redraw?(): void;
  activate?(): void;
  deactivate?(): void;
  destroy?(): void;

  id?: string;
  name?: string;
  url?: string;

  addEventListener?(
    type: ApplicationEventType,
    listener: EventListenerOrEventListenerObject,
    useCapture?: boolean,
  ): void;
  removeEventListener?(
    type: ApplicationEventType,
    listener: EventListenerOrEventListenerObject,
    useCapture?: boolean,
  ): void;
}

/**
 * ApplicationPrivateData class
 *
 * Used to access the keyset used by the application and the current broadcast
 * channel of a broadcast-related application.
 */
export interface ApplicationPrivateData {
  /**
   * The object of class Keyset, representing the user input events
   * sent to the HbbTV application.
   */
  readonly keyset: Keyset;

  /**
   * For a broadcast-related application, the value of the property contains
   * the channel whose AIT is currently controlling the lifecycle of this
   * application. If no channel is being presented, or if the application
   * is not broadcast-related, the value of this property will be null.
   */
  readonly currentChannel: Channel | null;

  /**
   * Lets the application developer query information about the current memory
   * available to the application. This can be used during application development
   * to find application memory leaks and possibly allow an application to make
   * decisions related to its caching strategy (e.g. for images).
   *
   * @returns The available memory to the application or -1 if the information is not available.
   */
  getFreeMem(): number;
}

/** Keyset controls available remote-control keys. */
export interface Keyset {
  setValue(mask: number): void;
  getValue(): number;
  setKey?(keyCode: number, enabled: boolean): void;
}

export type ApplicationManagerEventType =
  | "ApplicationLoaded"
  | "ApplicationActivated"
  | "ApplicationDeactivated"
  | "ApplicationDestroyed"
  | "ApplicationError";

export type ApplicationEventType = "Activated" | "Deactivated" | "Destroyed" | "Hidden" | "Shown" | "Error";

/** Enum for remote-control key codes (VK_*). */
export enum KeyCodes {
  LEFT = 37,
  RIGHT = 39,
  UP = 38,
  DOWN = 40,
  ENTER = 13,
  BACK = 8,

  RED = 403,
  GREEN = 404,
  YELLOW = 405,
  BLUE = 406,

  PLAY = 415,
  PAUSE = 19,
  STOP = 413,
  FAST_FORWARD = 417,
  REWIND = 412,
}

/** Enum for keyset masks (bitfields). */
export enum KeysetMask {
  NAVIGATION = 0x01,
  NAVIGATION_AND_COLOR = 0x02,
  PLAYBACK = 0x04,
  ALL = 0xff,
}

export const MIME_TYPE = "application/oipfApplicationManager" as const;

export const isValidElement = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.type === MIME_TYPE;
