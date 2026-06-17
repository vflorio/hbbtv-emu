import * as ControlModule from "./control";
import * as ErrorModule from "./error";
import * as SourceModule from "./source";

export * from "./base";

export namespace PlayerState {
  export import Control = ControlModule;

  export import Source = SourceModule;

  // biome-ignore lint/suspicious/noShadowRestrictedNames: PlayerState.Error namespace
  export import Error = ErrorModule;

  export type Any = Control.Any | Source.Any | Error.Any;
  export type Playable = Extract<Any, { _tagGroup: "Playable" }>;
  export type Errors = Extract<Any, { isError: true }>;
  export type RecoverableErrors = Extract<Any, { _tagGroup: "RecoverableError" }>;
  export type FatalErrors = Extract<Any, { _tagGroup: "FatalError" }>;
}
