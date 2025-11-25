import { ChromeStorageAdapter } from "../dist";

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  getItem = async (key: string): Promise<string | null> => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error("Failed to get item from localStorage:", error);
      return null;
    }
  };

  setItem = async (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error("Failed to set item in localStorage:", error);
    }
  };
}

export const createStorageAdapter = (): StorageAdapter => {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return new ChromeStorageAdapter();
  }
  return new LocalStorageAdapter();
};

export interface StorageOperations<T extends { id: string }> {
  loadAll(): Promise<T[]>;
  saveAll(entries: T[]): Promise<void>;
  saveEntry(entry: T): Promise<void>;
  deleteEntry(id: string): Promise<void>;
}

export class EntryStorage<T extends { id: string }> implements StorageOperations<T> {
  constructor(
    private key: string,
    private storageAdapter: StorageAdapter = createStorageAdapter(),
  ) {}

  loadAll = async (): Promise<T[]> => {
    try {
      const data = await this.storageAdapter.getItem(this.key);
      if (!data) return [];
      return JSON.parse(data) as T[];
    } catch (error) {
      console.error("Failed to load entries:", error);
      return [];
    }
  };

  saveAll = async (entries: T[]): Promise<void> => {
    try {
      await this.storageAdapter.setItem(this.key, JSON.stringify(entries));
    } catch (error) {
      console.error("Failed to save entries:", error);
    }
  };

  saveEntry = async (entry: T): Promise<void> => {
    const entries = await this.loadAll();
    const index = entries.findIndex((ch) => ch.id === entry.id);

    if (index >= 0) {
      entries[index] = entry;
    } else {
      entries.push(entry);
    }

    await this.saveAll(entries);
  };

  deleteEntry = async (id: string): Promise<void> => {
    const entries = await this.loadAll();
    const filtered = entries.filter((ch) => ch.id !== id);
    await this.saveAll(filtered);
  };
}
