import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../../logger";
import { type ClassType, compose } from "../../mixin";
import type { Message } from "../message";
import { type MessageAdapter, type MessageAdapterError, WithMessageAdapter } from "../messageAdapter";
import type { MessageEnvelope } from "../messageEnvelope";

const logger = createLogger("Debug Message Adapter");

const WithDebugMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements MessageAdapter {
    sendMessage = <T extends Message>(
      envelope: MessageEnvelope<T>,
    ): TE.TaskEither<MessageAdapterError | DebugMessageError, void> =>
      TE.tryCatch(
        async () => {
          logger.log("sendMessage", envelope);
        },
        (error) => debugMessageError(`Debug message failed: ${error}`),
      );
  };

// biome-ignore format: ack
export const WithDebugMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(
    Base, 
    WithMessageAdapter, 
    WithDebugMessage
);

// Errors

export type DebugMessageError = Readonly<{
  type: "DebugMessageError";
  message: string;
}>;

export const debugMessageError = (message: string): DebugMessageError => ({
  type: "DebugMessageError",
  message,
});
