import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { type Message, MessageCodec, type MessageOrigin, MessageOriginCodec } from "./message";

export type ServiceWorkerMessageContext = {
  tabId: number;
};

const ServiceWorkerMessageContextCodec = t.type({
  tabId: t.number,
});

export interface MessageEnvelope<T extends Message = Message> {
  id: string;
  timestamp: number;
  message: T;
  source: MessageOrigin;
  target: MessageOrigin;
  context?: ServiceWorkerMessageContext;
}

const MessageEnvelopeCodec = t.intersection([
  t.type({
    id: t.string,
    timestamp: t.number,
    message: MessageCodec,
    source: MessageOriginCodec,
    target: MessageOriginCodec,
  }),
  t.partial({
    context: ServiceWorkerMessageContextCodec,
  }),
]);

export const validateEnvelope = (data: unknown): E.Either<Error, MessageEnvelope> =>
  pipe(
    MessageEnvelopeCodec.decode(data),
    E.mapLeft(() => new Error(`Invalid message envelope: ${JSON.stringify(data)}`)),
  );

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

export const createEnvelope = <T extends Message>(
  source: MessageOrigin,
  target: MessageOrigin,
  message: T,
  context?: ServiceWorkerMessageContext,
): MessageEnvelope<T> => ({
  id: generateId(),
  timestamp: Date.now(),
  message,
  source,
  target,
  context,
});

export const validateTarget =
  (expectedTarget: MessageOrigin) =>
  (envelope: MessageEnvelope): E.Either<Error, MessageEnvelope> =>
    envelope.target === expectedTarget
      ? E.right(envelope)
      : E.left(new Error(`Expected target ${expectedTarget}, got ${envelope.target}`));
