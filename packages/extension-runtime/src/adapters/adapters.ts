import type { ExtensionState } from "../services/background/state";

export type ManifestVersion = 2 | 3;

export type TabStatus = "unloaded" | "loading" | "complete";

export type UnsubscribeFn = () => void;

/**
 * Messages that can be forwarded between extension scripts
 */
export type ForwardableMessage =
  | { readonly _tag: "Settings/Updated"; readonly settings: ExtensionState["globalSettings"] }
  | { readonly _tag: "Tab/StateChanged"; readonly tabId: number; readonly enabled: boolean }
  | { readonly _tag: "OIPF/RuntimeReady"; readonly tabId: number }
  | { readonly _tag: "UI/Opened"; readonly tabId: number }
  | { readonly _tag: "UI/Closed"; readonly tabId: number };
