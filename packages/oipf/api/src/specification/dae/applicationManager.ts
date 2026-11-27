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

  /**
   * Called when the first page of an application started with `createApplication()`
   * cannot be loaded (OIPF DAE §7.2.1.3); also the DOM event `ApplicationLoadError`.
   */
  onApplicationLoadError?: ((application: Application) => void) | null;

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
  /**
   * Terminates the application (OIPF DAE §7.2.2.2). In HbbTV, the terminal then
   * starts the autostart application of the current service (TS 102 796 §6.2.2.3).
   */
  destroyApplication?(): void;
  /**
   * Starts another application (OIPF DAE §7.2.2.2); HbbTV has only `createChild`
   * false (TS 102 796 Annex A). `null` if it cannot be created.
   */
  createApplication?(uri: string, createChild?: boolean): Application | null;

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

/**
 * Keyset: the remote-control keys the application wants to receive (OIPF DAE §7.2.5),
 * as HbbTV profiles it (TS 102 796 Annex A): without `otherKeys`/`maximumOtherKeys`
 * on a terminal that does not offer VK_RECORD, and without `getKeyLabel()`.
 */
export interface Keyset {
  readonly RED: 0x1;
  readonly GREEN: 0x2;
  readonly YELLOW: 0x4;
  readonly BLUE: 0x8;
  readonly NAVIGATION: 0x10;
  readonly VCR: 0x20;
  readonly SCROLL: 0x40;
  readonly INFO: 0x80;
  readonly NUMERIC: 0x100;
  readonly ALPHA: 0x200;
  readonly OTHER: 0x400;
  /** The keys this application will receive (bitmask of the constants above). */
  readonly value: number;
  /** A bit at 0: those key events are never available to the browser. */
  readonly maximumValue: number;
  /** Set by the application if it supports a pointer based interaction model. */
  supportsPointer: boolean;
  /** Requests keys; returns those that will actually be delivered (a mask of the constants above). */
  setValue(value: number, otherKeys?: ReadonlyArray<number>): number;
  /** URI of the icon of the physical key generating `code` (a VK_ constant); `null` if none. */
  getKeyIcon(code: number): string | null;
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
  BACK = 461,

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

/** Keyset bits (same values as the Keyset constants). */
export enum KeysetMask {
  RED = 0x1,
  GREEN = 0x2,
  YELLOW = 0x4,
  BLUE = 0x8,
  NAVIGATION = 0x10,
  VCR = 0x20,
  SCROLL = 0x40,
  INFO = 0x80,
  NUMERIC = 0x100,
  ALPHA = 0x200,
  OTHER = 0x400,
}

export const MIME_TYPE = "application/oipfApplicationManager" as const;

export const isValidElement = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.type === MIME_TYPE;
