/**
 * Video Player State Management System (Class Discriminated Unions ADT)
 */

export { FatalError, PlayableState, RecoverableError } from "./base";

export * as Control from "./control";
export * as Error from "./error";
export * as Source from "./source";

import type { Any as ControlAny } from "./control";
import type { Any as ErrorAny } from "./error";
import type { Any as SourceAny } from "./source";

// --------------------------------------------------------------------------
// Top-Level Union Types
// --------------------------------------------------------------------------

/**
 * Complete union of all possible player states
 */
export type PlayerStateAny = ControlAny | SourceAny | ErrorAny;

/**
 * Union of all playable states
 */
export type PlayerStatePlayable = Extract<PlayerStateAny, { _tagGroup: "Playable" }>;

/**
 * Union of all error states
 */
export type PlayerStateErrors = Extract<PlayerStateAny, { isError: true }>;

/**
 * Union of all recoverable error states
 */
export type PlayerStateRecoverableErrors = Extract<PlayerStateAny, { _tagGroup: "RecoverableError" }>;

/**
 * Union of all fatal error states
 */
export type PlayerStateFatalErrors = Extract<PlayerStateAny, { _tagGroup: "FatalError" }>;
