import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../../logger";
import { type ClassType, compose } from "../../mixin";
import type { Message } from "../message";
import { type MessageAdapter, WithMessageAdapter } from "../messageAdapter";
import type { MessageEnvelope } from "../messageEnvelope";

const logger = createLogger("DebugMessageAdapter");

export namespace DebugMessageAdapter {
  export interface Contract extends MessageAdapter.Contract {
    sendMessage: SendMessage;
  }

  export type Error = DebugMessageError;

  export type SendMessage = <T extends Message>(
    envelope: MessageEnvelope<T>,
  ) => TE.TaskEither<MessageAdapter.Error | DebugMessageError, void>;

  export type DebugMessageError = Readonly<{
    type: "DebugMessageError";
    message: string;
  }>;
}

const WithDebugMessage = <T extends ClassType<MessageAdapter.Contract>>(Base: T) =>
  class extends Base implements DebugMessageAdapter.Contract {
    sendMessage: DebugMessageAdapter.SendMessage = <T extends Message>(envelope: MessageEnvelope<T>) =>
      TE.tryCatch(
        async () => logger.info("sendMessage", envelope)(),
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

export const debugMessageError = (message: string): DebugMessageAdapter.DebugMessageError => ({
  type: "DebugMessageError",
  message,
});
