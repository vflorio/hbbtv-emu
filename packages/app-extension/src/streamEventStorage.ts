import type { StreamEventConfig } from "@hbb-emu/ui";

const STORAGE_KEY = "hbbtv-stream-events";

/**
 * Storage service for stream event configurations using localStorage
 */
export const StreamEventStorage = {
  /**
   * Load all stream events from localStorage
   */
  load(): StreamEventConfig[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as StreamEventConfig[];
    } catch (error) {
      console.error("Failed to load stream events from localStorage:", error);
      return [];
    }
  },

  /**
   * Save all stream events to localStorage
   */
  save(events: StreamEventConfig[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      console.error("Failed to save stream events to localStorage:", error);
    }
  },

  /**
   * Add or update a stream event
   */
  saveStreamEvent(event: StreamEventConfig): void {
    const events = this.load();
    const index = events.findIndex((ev) => ev.id === event.id);

    if (index >= 0) {
      events[index] = event;
    } else {
      events.push(event);
    }

    this.save(events);
  },

  /**
   * Delete a stream event by ID
   */
  deleteStreamEvent(id: string): void {
    const events = this.load();
    const filtered = events.filter((ev) => ev.id !== id);
    this.save(filtered);
  },

  /**
   * Clear all stream events
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear stream events from localStorage:", error);
    }
  },
};
