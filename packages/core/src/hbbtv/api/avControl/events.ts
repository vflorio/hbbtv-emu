/**
 * A/V Control Object Event Types
 *
 * Event handler type aliases for the A/V Control object.
 *
 * @see OIPF DAE V1.1 Clause 7.14
 * @see HbbTV Specification
 * @module hbbtv/api/avControl/events
 */

import type { PlayState } from "./constants";

/**
 * Play state change event handler.
 *
 * Called when the play state of the A/V control object changes for any reason.
 *
 * @param state - The new state of the A/V control object (see PlayState enum)
 */
export type OnPlayStateChangeHandler = (state: PlayState) => void;

/**
 * Play position change event handler.
 *
 * Called when a change occurs in the play position due to random access (seek).
 *
 * @param position - The new play position in milliseconds
 */
export type OnPlayPositionChangedHandler = (position: number) => void;

/**
 * Play speed change event handler.
 *
 * Called when the play speed changes. An event SHALL be generated for all calls
 * to the play() method regardless of whether the play speed actually changes.
 *
 * @param speed - The new play speed relative to real-time
 */
export type OnPlaySpeedChangedHandler = (speed: number) => void;

/**
 * Full screen change event handler.
 *
 * Called when the fullScreen property value changes.
 *
 * @param fullScreen - Whether the object is now in full screen mode
 */
export type OnFullScreenChangeHandler = (fullScreen: boolean) => void;
