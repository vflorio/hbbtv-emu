export type ConfigTimeoutError = Readonly<{
  type: "ConfigTimeoutError";
  message: string;
}>;

export type MessageTimeoutError = Readonly<{
  type: "MessageTimeoutError";
  message: string;
  messageType: string;
}>;

export type ContentScriptError = ConfigTimeoutError | MessageTimeoutError;

export const configTimeoutError = (timeoutMs: number): ConfigTimeoutError => ({
  type: "ConfigTimeoutError",
  message: `Timeout waiting for config after ${timeoutMs}ms`,
});

export const messageTimeoutError = (messageType: string, timeoutMs: number): MessageTimeoutError => ({
  type: "MessageTimeoutError",
  message: `Timeout waiting for ${messageType} after ${timeoutMs}ms`,
  messageType,
});
