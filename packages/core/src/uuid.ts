import type * as IO from "fp-ts/IO";

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
