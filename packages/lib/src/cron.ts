import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";

/**
 * Minimal cron expression parser supporting:
 * - Standard 5-field format: minute hour day month weekday
 * - Wildcards: asterisk (*)
 * - Step values: asterisk/5, 0-30/5
 * - Ranges: 1-5
 * - Lists: 1,2,3
 */

export type CronField = {
  values: number[];
};

export type CronExpression = {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
};

export type CronParseError = Readonly<{
  type: "CronParseError";
  message: string;
}>;

export const cronParseError = (message: string): CronParseError => ({
  type: "CronParseError",
  message,
});

// Field ranges (min, max)
const FIELD_RANGES: Record<string, [number, number]> = {
  minute: [0, 59],
  hour: [0, 23],
  dayOfMonth: [1, 31],
  month: [1, 12],
  dayOfWeek: [0, 6], // 0 = Sunday
};

const parseFieldValue = (value: string, min: number, max: number): E.Either<CronParseError, number[]> => {
  // Handle wildcard with step: */5
  if (value.startsWith("*/")) {
    const step = parseInt(value.slice(2), 10);
    if (isNaN(step) || step <= 0) {
      return E.left(cronParseError(`Invalid step value: ${value}`));
    }
    const values: number[] = [];
    for (let i = min; i <= max; i += step) {
      values.push(i);
    }
    return E.right(values);
  }

  // Handle wildcard: *
  if (value === "*") {
    const values: number[] = [];
    for (let i = min; i <= max; i++) {
      values.push(i);
    }
    return E.right(values);
  }

  // Handle range with step: 0-30/5
  if (value.includes("-") && value.includes("/")) {
    const [rangePart, stepPart] = value.split("/");
    const [startStr, endStr] = rangePart.split("-");
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    const step = parseInt(stepPart, 10);

    if (isNaN(start) || isNaN(end) || isNaN(step) || step <= 0) {
      return E.left(cronParseError(`Invalid range with step: ${value}`));
    }
    if (start < min || end > max || start > end) {
      return E.left(cronParseError(`Range out of bounds: ${value}`));
    }

    const values: number[] = [];
    for (let i = start; i <= end; i += step) {
      values.push(i);
    }
    return E.right(values);
  }

  // Handle range: 1-5
  if (value.includes("-")) {
    const [startStr, endStr] = value.split("-");
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);

    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      return E.left(cronParseError(`Invalid range: ${value}`));
    }

    const values: number[] = [];
    for (let i = start; i <= end; i++) {
      values.push(i);
    }
    return E.right(values);
  }

  // Handle list: 1,2,3
  if (value.includes(",")) {
    const parts = value.split(",");
    const values: number[] = [];

    for (const part of parts) {
      const num = parseInt(part.trim(), 10);
      if (isNaN(num) || num < min || num > max) {
        return E.left(cronParseError(`Invalid list value: ${part}`));
      }
      values.push(num);
    }
    return E.right(values);
  }

  // Handle single value
  const num = parseInt(value, 10);
  if (isNaN(num) || num < min || num > max) {
    return E.left(cronParseError(`Invalid value: ${value}`));
  }
  return E.right([num]);
};

const parseField = (value: string, fieldName: keyof typeof FIELD_RANGES): E.Either<CronParseError, CronField> => {
  const [min, max] = FIELD_RANGES[fieldName];
  return pipe(
    parseFieldValue(value, min, max),
    E.map((values) => ({ values })),
  );
};

export const parseCron = (expression: string): E.Either<CronParseError, CronExpression> => {
  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    return E.left(cronParseError(`Invalid cron expression: expected 5 fields, got ${parts.length}`));
  }

  const [minuteStr, hourStr, dayOfMonthStr, monthStr, dayOfWeekStr] = parts;

  return pipe(
    E.Do,
    E.bind("minute", () => parseField(minuteStr, "minute")),
    E.bind("hour", () => parseField(hourStr, "hour")),
    E.bind("dayOfMonth", () => parseField(dayOfMonthStr, "dayOfMonth")),
    E.bind("month", () => parseField(monthStr, "month")),
    E.bind("dayOfWeek", () => parseField(dayOfWeekStr, "dayOfWeek")),
  );
};

export const matchesCron = (cron: CronExpression, date: Date): boolean => {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed
  const dayOfWeek = date.getDay(); // 0 = Sunday

  return (
    cron.minute.values.includes(minute) &&
    cron.hour.values.includes(hour) &&
    cron.dayOfMonth.values.includes(dayOfMonth) &&
    cron.month.values.includes(month) &&
    cron.dayOfWeek.values.includes(dayOfWeek)
  );
};

export const getNextMatch = (cron: CronExpression, from: Date = new Date()): O.Option<Date> => {
  const maxIterations = 366 * 24 * 60; // Max 1 year of minutes
  const current = new Date(from);
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1); // Start from next minute

  for (let i = 0; i < maxIterations; i++) {
    if (matchesCron(cron, current)) {
      return O.some(current);
    }
    current.setMinutes(current.getMinutes() + 1);
  }

  return O.none;
};

export const getMillisecondsUntilNext = (cron: CronExpression, from: Date = new Date()): O.Option<number> =>
  pipe(
    getNextMatch(cron, from),
    O.map((next) => next.getTime() - from.getTime()),
  );

/**
 * Simple cron scheduler that runs a callback on a schedule
 */
export interface CronJob {
  id: string;
  expression: CronExpression;
  callback: () => void;
  timerId: ReturnType<typeof setTimeout> | null;
}

export interface CronScheduler {
  schedule: (id: string, expression: string, callback: () => void) => E.Either<CronParseError, void>;
  unschedule: (id: string) => void;
  unscheduleAll: () => void;
  getJobs: () => CronJob[];
}

export const createCronScheduler = (): CronScheduler => {
  const jobs = new Map<string, CronJob>();

  const scheduleNext = (job: CronJob): void => {
    if (job.timerId) {
      clearTimeout(job.timerId);
    }

    const ms = getMillisecondsUntilNext(job.expression);
    pipe(
      ms,
      O.map((delay) => {
        job.timerId = setTimeout(() => {
          job.callback();
          scheduleNext(job); // Schedule next execution
        }, delay);
      }),
    );
  };

  const schedule = (id: string, expression: string, callback: () => void): E.Either<CronParseError, void> =>
    pipe(
      parseCron(expression),
      E.map((expr) => {
        // Unschedule existing job with same id
        unschedule(id);

        const job: CronJob = {
          id,
          expression: expr,
          callback,
          timerId: null,
        };

        jobs.set(id, job);
        scheduleNext(job);
      }),
    );

  const unschedule = (id: string): void => {
    const job = jobs.get(id);
    if (job) {
      if (job.timerId) {
        clearTimeout(job.timerId);
      }
      jobs.delete(id);
    }
  };

  const unscheduleAll = (): void => {
    for (const job of jobs.values()) {
      if (job.timerId) {
        clearTimeout(job.timerId);
      }
    }
    jobs.clear();
  };

  const getJobs = (): CronJob[] => Array.from(jobs.values());

  return { schedule, unschedule, unscheduleAll, getJobs };
};
