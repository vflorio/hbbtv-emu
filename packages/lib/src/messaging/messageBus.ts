import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RA from "fp-ts/ReadonlyArray";
import type { ClassType } from "../mixin";
import type { Message } from "./message";
import type { Handler, MessageAdapter } from "./messageAdapter";
import type { MessageEnvelope } from "./messageEnvelope";
import type { MessageOrigin } from "./messageOrigin";
import type { MessageType } from "./messageType";

export type Dispatch = (envelope: MessageEnvelope) => IO.IO<void>;

export interface Bus {
  on: <T extends MessageType>(type: T, handler: Handler<Extract<Message, { type: T }>>) => IO.IO<void>;
  off: <T extends MessageType>(type: T, handler: Handler<Extract<Message, { type: T }>>) => IO.IO<void>;
  dispatch: Dispatch;
}

export interface MessageBus {
  readonly messageOrigin: MessageOrigin;
  readonly bus: Bus;
}

export const WithMessageBus =
  (messageOrigin: MessageOrigin) =>
  <T extends ClassType<MessageAdapter>>(Base: T) =>
    class extends Base implements MessageBus {
      readonly messageOrigin: MessageOrigin = messageOrigin;
      handlers: Map<string, ReadonlyArray<Handler>> = new Map();

      constructor(...args: any[]) {
        super(...args);
        this.registerMessageHandler(messageOrigin)(this.bus.dispatch)();
      }

      updateHandlers = (
        type: string,
        updater: (handlers: ReadonlyArray<Handler>) => ReadonlyArray<Handler>,
      ): IO.IO<void> => IO.of(this.handlers.set(type, updater(this.handlers.get(type) ?? RA.empty)));

      bus: Bus = {
        on: <T extends MessageType>(type: T, handler: Handler<Extract<Message, { type: T }>>): IO.IO<void> =>
          this.updateHandlers(type, RA.append(handler as Handler)),

        off: <T extends MessageType>(type: T, handler: Handler<Extract<Message, { type: T }>>): IO.IO<void> =>
          this.updateHandlers(
            type,
            RA.filter((h) => h !== handler),
          ),

        dispatch: (envelope) =>
          pipe(
            this.handlers.get(envelope.message.type) ?? RA.empty,
            RA.map((handler) => handler(envelope)),
            IO.sequenceArray,
          ),
      };
    };
