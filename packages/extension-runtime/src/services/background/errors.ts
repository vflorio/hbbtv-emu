/**
 * Background Service Error Types
 */

export type BackgroundServiceError =
  | { readonly _tag: "StorageReadError"; readonly cause: unknown }
  | { readonly _tag: "StorageWriteError"; readonly cause: unknown }
  | { readonly _tag: "StateNotInitialized" }
  | { readonly _tag: "MessageForwardError"; readonly tabId: number; readonly cause: unknown };
