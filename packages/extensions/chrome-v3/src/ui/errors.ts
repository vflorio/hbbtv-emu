export type ConfigLoadError = Readonly<{
  type: "ConfigLoadError";
  message: string;
}>;

export type ConfigNotAvailableError = Readonly<{
  type: "ConfigNotAvailableError";
  message: string;
}>;

export type ConfigUpdateError = Readonly<{
  type: "ConfigUpdateError";
  message: string;
}>;

export type OperationError = ConfigNotAvailableError | ConfigUpdateError;

export const configLoadError = (message: string): ConfigLoadError => ({
  type: "ConfigLoadError",
  message,
});

export const configNotAvailableError = (): ConfigNotAvailableError => ({
  type: "ConfigNotAvailableError",
  message: "No config available",
});

export const configUpdateError = (message: string): ConfigUpdateError => ({
  type: "ConfigUpdateError",
  message,
});
