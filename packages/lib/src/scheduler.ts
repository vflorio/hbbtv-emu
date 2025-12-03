import { createLogger } from "./logger";

const logger = createLogger("Scheduler");

/**
 * A scheduled event with its delay
 */
export interface ScheduledEvent<T> {
  id: string;
  delaySeconds: number;
  data: T;
}

/**
 * Cyclic scheduler that runs a sequence of events in a loop.
 * Each event is triggered after its delaySeconds from the previous event.
 *
 * Example sequence with delays [10, 10, 10]:
 * - t=0: Start
 * - t=10s: Event 1
 * - t=20s: Event 2
 * - t=30s: Event 3
 * - t=40s: Event 1 (cycle repeats)
 * - ...
 */
export interface CyclicScheduler<T> {
  start: (events: ScheduledEvent<T>[], callback: (event: ScheduledEvent<T>) => void) => void;
  stop: () => void;
  isRunning: () => boolean;
  getCurrentIndex: () => number;
}

export const createCyclicScheduler = <T>(): CyclicScheduler<T> => {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let currentIndex = 0;
  let currentEvents: ScheduledEvent<T>[] = [];
  let currentCallback: ((event: ScheduledEvent<T>) => void) | null = null;

  const scheduleNext = (): void => {
    if (!running || currentEvents.length === 0 || !currentCallback) {
      return;
    }

    const event = currentEvents[currentIndex];
    const delayMs = event.delaySeconds * 1000;

    logger.info(
      `Scheduling event "${event.id}" in ${event.delaySeconds}s (index ${currentIndex}/${currentEvents.length})`,
    )();

    timerId = setTimeout(() => {
      if (!running || !currentCallback) return;

      logger.info(`Triggering event "${event.id}"`)();
      currentCallback(event);

      // Move to next event (cyclic)
      currentIndex = (currentIndex + 1) % currentEvents.length;
      scheduleNext();
    }, delayMs);
  };

  const start = (events: ScheduledEvent<T>[], callback: (event: ScheduledEvent<T>) => void): void => {
    stop(); // Stop any existing schedule

    if (events.length === 0) {
      logger.info("No events to schedule")();
      return;
    }

    currentEvents = events;
    currentCallback = callback;
    currentIndex = 0;
    running = true;

    logger.info(`Starting cyclic scheduler with ${events.length} events`)();
    scheduleNext();
  };

  const stop = (): void => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    running = false;
    currentIndex = 0;
    currentEvents = [];
    currentCallback = null;
    logger.info("Scheduler stopped")();
  };

  const isRunning = (): boolean => running;

  const getCurrentIndex = (): number => currentIndex;

  return { start, stop, isRunning, getCurrentIndex };
};
