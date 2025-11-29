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

export interface Collection<T> {
  readonly length: number;
  item(index: number): T | null;
  [index: number]: T;
}

export const createEmptyCollection = <T>(): Collection<T> => ({
  length: 0,
  item: () => null,
});
