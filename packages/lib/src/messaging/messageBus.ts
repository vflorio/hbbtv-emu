import { pipe } from "fp-ts/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../logger";
import type { ClassType } from "../mixin";
import type { Message } from "./message";
import type { MessageAdapter } from "./messageAdapter";
import type { MessageEnvelope } from "./messageEnvelope";
import type { MessageOrigin } from "./messageOrigin";
import type { MessageType } from "./messageType";

const logger = createLogger("MessageBus");

export namespace MessageBus {
  export interface Type {
    readonly messageOrigin: MessageOrigin;
    bus: Bus;
  }

  export interface Bus {
    on<T extends MessageType>(type: T, handler: MessageAdapter.Handler<Extract<Message, { type: T }>>): void;
    off<T extends MessageType>(type: T, handler: MessageAdapter.Handler<Extract<Message, { type: T }>>): void;
    dispatch(envelope: MessageEnvelope): TE.TaskEither<Error, void>;
  }
}

export const WithMessageBus =
  (messageOrigin: MessageOrigin) =>
  <T extends ClassType<MessageAdapter.Type>>(Base: T) =>
    class extends Base implements MessageBus.Type {
      readonly messageOrigin: MessageOrigin = messageOrigin;
      handlers: Map<string, ReadonlyArray<MessageAdapter.Handler>> = new Map();

      constructor(...args: any[]) {
        super(...args);
        this.registerMessageHandler(messageOrigin, this.bus.dispatch)();
      }

      bus: MessageBus.Bus = {
        on: (type, handler) => {
          const hs = this.handlers.get(type) ?? RA.empty;
          this.handlers.set(type, RA.append(handler as MessageAdapter.Handler)(hs));
        },

        off: (type, handler) => {
          const hs = this.handlers.get(type);
          if (!hs) return;
          this.handlers.set(type, RA.filter((h) => h !== handler)(hs));
        },

        dispatch: (envelope) => {
          const handlers = this.handlers.get(envelope.message.type) ?? RA.empty;

          if (RA.isEmpty(handlers)) {
            return TE.right(undefined);
          }

          logger.info("Dispatching message", envelope)();
          pipe(
            handlers,
            RA.map((handler) => handler(envelope)),
          );
          return TE.right(undefined);
        },
      };
    };
