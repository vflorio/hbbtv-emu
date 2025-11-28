import { pipe } from "fp-ts/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../logger";
import type { ClassType } from "../mixin";
import type { Message } from "./message";
import type { MessageAdapter, MessageHandler } from "./messageAdapter";
import type { MessageEnvelope } from "./messageEnvelope";
import type { MessageOrigin } from "./messageOrigin";
import type { MessageType } from "./messageType";

const logger = createLogger("MessageBus");

export interface MessageBus {
  readonly messageOrigin: MessageOrigin;
  bus: {
    on<T extends MessageType>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>): void;
    off<T extends MessageType>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>): void;
    dispatch(envelope: MessageEnvelope): TE.TaskEither<Error, void>;
  };
}

export const WithMessageBus =
  (messageOrigin: MessageOrigin) =>
  <T extends ClassType<MessageAdapter>>(Base: T) =>
    class extends Base implements MessageBus {
      readonly messageOrigin: MessageOrigin = messageOrigin;
      handlers: Map<string, ReadonlyArray<MessageHandler>> = new Map();

      constructor(...args: any[]) {
        super(...args);
        this.registerMessageBus(messageOrigin, this.bus.dispatch);
      }

      bus = {
        on: <T extends MessageType>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>) => {
          const hs = this.handlers.get(type) ?? RA.empty;
          this.handlers.set(type, RA.append(handler as MessageHandler)(hs));
        },

        off: <T extends MessageType>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>) => {
          const hs = this.handlers.get(type);
          if (!hs) return;
          this.handlers.set(type, RA.filter((h) => h !== handler)(hs));
        },

        dispatch: (envelope: MessageEnvelope): TE.TaskEither<Error, void> => {
          const handlers = this.handlers.get(envelope.message.type) ?? RA.empty;

          if (RA.isEmpty(handlers)) {
            return TE.right(undefined);
          }

          logger.log("Dispatching message", envelope);
          pipe(
            handlers,
            RA.map((handler) => handler(envelope)),
          );
          return TE.right(undefined);
        },
      };
    };
