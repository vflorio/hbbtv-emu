export const createStorage = <T extends { id: string }>(key: string) => {
  const loadAll = async (): Promise<T[]> => {
    try {
      const data = localStorage.getItem(key);
      if (!data) return [];
      return JSON.parse(data) as T[];
    } catch (error) {
      console.error("Failed to load entries from localStorage:", error);
      return [];
    }
  };

  const saveAll = async (entries: T[]): Promise<void> => {
    try {
      localStorage.setItem(key, JSON.stringify(entries));
    } catch (error) {
      console.error("Failed to save entries to localStorage:", error);
    }
  };

  const saveEntry = async (entry: T): Promise<void> => {
    const entries = await loadAll();
    const index = entries.findIndex((ch) => ch.id === entry.id);

    if (index >= 0) {
      entries[index] = entry;
    } else {
      entries.push(entry);
    }

    saveAll(entries);
  };

  const deleteEntry = async (id: string): Promise<void> => {
    const entries = await loadAll();
    const filtered = entries.filter((ch) => ch.id !== id);
    await saveAll(filtered);
  };

  return [loadAll, saveAll, saveEntry, deleteEntry] as const;
};
