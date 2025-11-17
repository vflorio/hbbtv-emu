// Utilities
export const log = (message: string): void => {
  console.timeStamp(message);
};

export interface Collection<T> {
  readonly length: number;
  item(index: number): T | null;
  [index: number]: T;
}

export const createEmptyCollection = <T>(): Collection<T> => ({
  length: 0,
  item: () => null,
});
