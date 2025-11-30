import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RA from "fp-ts/ReadonlyArray";
import type { ClassType } from "../mixin";
import type { Message } from "./message";
import type { MessageAdapter } from "./messageAdapter";
import type { MessageEnvelope } from "./messageEnvelope";
import type { MessageOrigin } from "./messageOrigin";
import type { MessageType } from "./messageType";

export namespace MessageBus {
  export interface Contract {
    readonly messageOrigin: MessageOrigin;
    bus: Bus;
  }

  export interface Bus {
    on: On;
    off: Off;
    dispatch: Dispatch;
  }

  export type On = <T extends MessageType>(
    type: T,
    handler: MessageAdapter.Handler<Extract<Message, { type: T }>>,
  ) => IO.IO<void>;

  export type Off = <T extends MessageType>(
    type: T,
    handler: MessageAdapter.Handler<Extract<Message, { type: T }>>,
  ) => IO.IO<void>;

  export type Dispatch = (envelope: MessageEnvelope) => IO.IO<void>;
}

export const WithMessageBus =
  (messageOrigin: MessageOrigin) =>
  <T extends ClassType<MessageAdapter.Contract>>(Base: T) =>
    class extends Base implements MessageBus.Contract {
      readonly messageOrigin: MessageOrigin = messageOrigin;
      handlers: Map<string, ReadonlyArray<MessageAdapter.Handler>> = new Map();

      constructor(...args: any[]) {
        super(...args);
        this.registerMessageHandler(messageOrigin)(this.bus.dispatch)();
      }

      updateHandlers = (
        type: string,
        updater: (handlers: ReadonlyArray<MessageAdapter.Handler>) => ReadonlyArray<MessageAdapter.Handler>,
      ): IO.IO<void> => IO.of(this.handlers.set(type, updater(this.handlers.get(type) ?? RA.empty)));

      bus: MessageBus.Bus = {
        on: (type, handler) => this.updateHandlers(type, RA.append(handler as MessageAdapter.Handler)),

        off: (type, handler) =>
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
