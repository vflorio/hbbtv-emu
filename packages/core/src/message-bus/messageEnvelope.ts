import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { type Message, MessageCodec } from "./message";
import { type MessageOrigin, MessageOriginCodec } from "./messageOrigin";

export type BackgroundScriptMessageContext = {
  tabId: number;
};

const BackgroundScriptMessageContextCodec = t.type({
  tabId: t.number,
});

export interface MessageEnvelope<T extends Message = Message> {
  id: string;
  timestamp: number;
  message: T;
  source: MessageOrigin;
  target: MessageOrigin;
  context?: BackgroundScriptMessageContext;
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
    context: BackgroundScriptMessageContextCodec,
  }),
]);

export const validateEnvelope = (data: unknown): E.Either<InvalidMessageEnvelopeError, MessageEnvelope> =>
  pipe(
    MessageEnvelopeCodec.decode(data),
    E.mapLeft(() => invalidMessageEnvelopeError(`Invalid message envelope: ${JSON.stringify(data)}`)),
  );

export const isMessageEnvelope = (data: unknown): data is MessageEnvelope => E.isRight(validateEnvelope(data));

// questo serve più che altro al service worker
const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

export const createEnvelope = <T extends Message>(
  source: MessageOrigin,
  target: MessageOrigin,
  message: T,
  context?: BackgroundScriptMessageContext,
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
  (envelope: MessageEnvelope): E.Either<InvalidTargetError, MessageEnvelope> =>
    envelope.target === expectedTarget
      ? E.right(envelope)
      : E.left(invalidTargetError(`Expected target ${expectedTarget}, got ${envelope.target}`));

// Errors

export type InvalidMessageEnvelopeError = Readonly<{
  type: "InvalidMessageEnvelopeError";
  message: string;
}>;

export type InvalidTargetError = Readonly<{
  type: "InvalidTargetError";
  message: string;
}>;

export const invalidMessageEnvelopeError = (message: string): InvalidMessageEnvelopeError => ({
  type: "InvalidMessageEnvelopeError",
  message,
});

export const invalidTargetError = (message: string): InvalidTargetError => ({
  type: "InvalidTargetError",
  message,
});
