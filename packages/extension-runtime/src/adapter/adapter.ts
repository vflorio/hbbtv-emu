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
import type { TvSessions } from "../state";
import { type BroadbandAdapter, createBroadbandAdapter } from "./broadband";
import { createPageBootstrapAdapter, type PageBootstrapAdapter } from "./pageBootstrap";
import { createSessionStorageAdapter, type StorageAdapter } from "./storage";
import { createUiAdapter, type UiAdapter } from "./ui";
import { createUserAgentAdapter, type UserAgentAdapter } from "./userAgent";

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
  /** The TV session of every tab: as long as the browser session, not across restarts. */
  readonly sessionStorage: StorageAdapter<TvSessions>;
  readonly messaging: MessagingAdapter<TEvents>;
  readonly webRequest: WebRequestAdapter;
  readonly tabs: TabsAdapter;
  readonly ui: UiAdapter;
  readonly userAgent: UserAgentAdapter;
  readonly pageBootstrap: PageBootstrapAdapter;
  readonly broadband: BroadbandAdapter;
};

export const createAdapterEnv = <TState, TEvents extends BaseMessage>(
  config: AdapterConfig,
  env?: Partial<AdapterEnv<TState, TEvents>>,
): AdapterEnv<TState, TEvents> => ({
  storage: env?.storage ?? createStorageAdapter(config),
  sessionStorage: env?.sessionStorage ?? createSessionStorageAdapter(config),
  messaging: env?.messaging ?? createMessagingAdapter(config),
  webRequest: env?.webRequest ?? createWebRequestAdapter(config),
  tabs: env?.tabs ?? createTabsAdapter(config),
  ui: env?.ui ?? createUiAdapter(config),
  userAgent: env?.userAgent ?? createUserAgentAdapter(config),
  pageBootstrap: env?.pageBootstrap ?? createPageBootstrapAdapter(config),
  broadband: env?.broadband ?? createBroadbandAdapter(),
});

// Errors

export type AdapterError =
  | { readonly _tag: "StorageReadError"; readonly cause: unknown }
  | { readonly _tag: "StorageWriteError"; readonly cause: unknown }
  | { readonly _tag: "MessageForwardError"; readonly tabId: number; readonly cause: unknown }
  | { readonly _tag: "UserAgentOverrideError"; readonly cause: unknown }
  | { readonly _tag: "PageBootstrapUnavailable"; readonly reason: string }
  | { readonly _tag: "PageBootstrapError"; readonly cause: unknown }
  | { readonly _tag: "TabError"; readonly cause: unknown }
  | { readonly _tag: "BroadbandFetchError"; readonly url: string; readonly cause: unknown };
