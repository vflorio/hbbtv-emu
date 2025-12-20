/**
 * Transition Error Types
 */

import type { PlayerState } from "../state";

export class TransitionError extends Error {
  constructor(
    message: string,
    readonly fromState: PlayerState.Any,
    readonly attemptedTransition: string,
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

export class LoadError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly sourceType: string,
  ) {
    super(message);
    this.name = "LoadError";
  }
}
