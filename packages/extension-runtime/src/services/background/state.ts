/**
 * Extension State Domain Types
 */

/**
 * Extension state that persists across sessions
 */
export type ExtensionState = {
  readonly version: number;
  readonly enabledTabIds: ReadonlySet<number>;
  readonly globalSettings: GlobalSettings;
  readonly lastUpdated: number;
};

export type GlobalSettings = {
  readonly autoInjectHbbTV: boolean;
  readonly debugMode: boolean;
  readonly defaultChannel: string | null;
};

/**
 * Default state used when storage is empty
 */
export const DEFAULT_STATE: ExtensionState = {
  version: 1,
  enabledTabIds: new Set(),
  globalSettings: {
    autoInjectHbbTV: true,
    debugMode: false,
    defaultChannel: null,
  },
  lastUpdated: Date.now(),
} as const;
