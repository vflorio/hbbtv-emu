import type { StorageAdapter } from "../storage";

export class ChromeStorageAdapter implements StorageAdapter {
  getItem = async (key: string): Promise<string | null> => {
    try {
      const result = await chrome.storage.local.get(key);
      const value = result[key];
      return typeof value === "string" ? value : null;
    } catch (error) {
      console.error("Failed to get item from chrome.storage:", error);
      return null;
    }
  };

  setItem = async (key: string, value: string): Promise<void> => {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error("Failed to set item in chrome.storage:", error);
    }
  };
}
