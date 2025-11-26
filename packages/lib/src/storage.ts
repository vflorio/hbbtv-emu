import { ChromeStorageAdapter } from "./chrome";

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

export class Storage<T> {
  constructor(
    private key: string,
    private storageAdapter: StorageAdapter = createStorageAdapter(),
  ) {}

  load = async (): Promise<T | null> => {
    try {
      const data = await this.storageAdapter.getItem(this.key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error("Failed to load entry:", error);
      return null;
    }
  };

  save = async (entry: T): Promise<void> => {
    try {
      await this.storageAdapter.setItem(this.key, JSON.stringify(entry));
    } catch (error) {
      console.error("Failed to save entry:", error);
    }
  };
}

export class EntryStorage<T extends { id: string }> extends Storage<T[]> {
  constructor(key: string, storageAdapter: StorageAdapter = createStorageAdapter()) {
    super(key, storageAdapter);
  }

  saveEntry = async (entry: T): Promise<void> => {
    const entries = (await this.load()) || [];
    const index = entries.findIndex((channel) => channel.id === entry.id);

    if (index >= 0) {
      entries[index] = entry;
    } else {
      entries.push(entry);
    }

    await this.save(entries);
  };

  deleteEntry = async (id: string): Promise<void> => {
    const entries = (await this.load()) || [];
    const filtered = entries.filter((channel) => channel.id !== id);
    await this.save(filtered);
  };
}
