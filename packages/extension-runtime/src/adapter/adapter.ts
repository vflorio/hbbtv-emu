import {
  type BaseMessage,
  createMessagingAdapter,
  createStorageAdapter,
  createTabsAdapter,
  createWebRequestAdapter,
  type MessagingAdapter,
  type TabsAdapter,
  type WebRequestAdapter,
} from "..";
import type { StorageAdapter } from "./storage";

// Engines

export const ENGINE_CHROME = "chrome" as const;
export const ENGINE_FIREFOX = "firefox" as const;
export const ENGINE_SAFARI = "safari" as const;

export type Engine = "chrome" | "firefox" | "safari";

// Manifest versions

export const MANIFEST_VERSION_2 = 2 as const;
export const MANIFEST_VERSION_3 = 3 as const;

export type ManifestVersion = 2 | 3;

// ===========================================================================
// ADAPTER CONFIGURATION
// ===========================================================================

export type AdapterConfig = {
  readonly engine: Engine;
  readonly manifest: ManifestVersion;
  readonly storageKey: string;
};

export const defaultAdapterConfig: AdapterConfig = {
  engine: ENGINE_CHROME,
  manifest: MANIFEST_VERSION_3,
  storageKey: "hbbtv_emu",
};

// ===========================================================================
// ADAPTER ENVIRONMENT
// ===========================================================================

export type AdapterEnv<TState, TEvents extends BaseMessage> = {
  readonly storage: StorageAdapter<TState>;
  readonly messaging: MessagingAdapter<TEvents>;
  readonly webRequest: WebRequestAdapter;
  readonly tabs: TabsAdapter;
};

export const createAdapterEnv = <TState, TEvents extends BaseMessage>(
  config: AdapterConfig,
  env?: Partial<AdapterEnv<TState, TEvents>>,
): AdapterEnv<TState, TEvents> => ({
  storage: env?.storage ?? createStorageAdapter(config),
  messaging: env?.messaging ?? createMessagingAdapter(config),
  webRequest: env?.webRequest ?? createWebRequestAdapter(config),
  tabs: env?.tabs ?? createTabsAdapter(config),
});

// Errors

export type AdapterError =
  | { readonly _tag: "StorageReadError"; readonly cause: unknown }
  | { readonly _tag: "StorageWriteError"; readonly cause: unknown }
  | { readonly _tag: "MessageForwardError"; readonly tabId: number; readonly cause: unknown };
