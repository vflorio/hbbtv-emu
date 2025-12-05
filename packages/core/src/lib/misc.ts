import type * as IO from "fp-ts/IO";

export type DataNotFoundError = Readonly<{
  type: "DataNotFoundError";
  message: string;
}>;

export const dataNotFoundError = (message: string): DataNotFoundError => ({
  type: "DataNotFoundError",
  message,
});

export type InvalidDataError = Readonly<{
  type: "InvalidDataError";
  message: string;
}>;

export const invalidDataError = (message: string): InvalidDataError => ({
  type: "InvalidDataError",
  message,
});

export type NotImplementedError = Readonly<{
  type: "NotImplementedError";
  message: string;
}>;

export const notImplementedError = (message: string): NotImplementedError => ({
  type: "NotImplementedError",
  message,
});

export const randomUUID = (): string => {
  if (typeof crypto?.randomUUID !== "function") {
    // Fallback for extension context
    return "xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  return crypto.randomUUID();
};

export const createRandomUUID = (): IO.IO<string> => () => randomUUID();
