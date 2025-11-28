import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { ExtensionConfig } from "../config";

// Message Source

export type MessageOrigin = "SIDE_PANEL" | "SERVICE_WORKER" | "CONTENT_SCRIPT" | "BRIDGE_SCRIPT";

export const MessageOriginCodec = t.union([
  t.literal("SIDE_PANEL"),
  t.literal("SERVICE_WORKER"),
  t.literal("CONTENT_SCRIPT"),
  t.literal("BRIDGE_SCRIPT"),
]);

export const validateMessageOrigin = (data: unknown): E.Either<InvalidMessageOriginError, MessageOrigin> =>
  pipe(
    MessageOriginCodec.decode(data),
    E.mapLeft(() => invalidMessageOriginError(`Invalid message origin: ${data}`)),
  );

export const isValidMessageOrigin = (origin: string): origin is MessageOrigin =>
  E.isRight(MessageOriginCodec.decode(origin));

// Message Type

export type MessageType = "BRIDGE_READY" | "CONTENT_SCRIPT_READY" | "UPDATE_USER_AGENT" | "UPDATE_CONFIG";

export const MessageTypeCodec = t.union([
  t.literal("BRIDGE_READY"),
  t.literal("CONTENT_SCRIPT_READY"),
  t.literal("UPDATE_USER_AGENT"),
  t.literal("UPDATE_CONFIG"),
]);

export const validateMessageType = (data: unknown): E.Either<InvalidMessageTypeError, MessageType> =>
  pipe(
    MessageTypeCodec.decode(data),
    E.mapLeft(() => invalidMessageTypeError(`Invalid message type: ${data}`)),
  );

export const isValidMessageType = (type: string): type is Message["type"] => E.isRight(MessageTypeCodec.decode(type));

// Message

export type Message =
  | { type: "BRIDGE_READY"; payload: null }
  | { type: "CONTENT_SCRIPT_READY"; payload: null }
  | { type: "UPDATE_USER_AGENT"; payload: string }
  | { type: "UPDATE_CONFIG"; payload: ExtensionConfig.State };

export const MessageCodec: t.Type<Message> = t.union([
  t.type({ type: t.literal("BRIDGE_READY"), payload: t.null }),
  t.type({ type: t.literal("CONTENT_SCRIPT_READY"), payload: t.null }),
  t.type({ type: t.literal("UPDATE_USER_AGENT"), payload: t.string }),
  t.type({ type: t.literal("UPDATE_CONFIG"), payload: ExtensionConfig.StateCodec }),
]);

export const validateMessage = (data: unknown): E.Either<InvalidMessageError, Message> =>
  pipe(
    MessageCodec.decode(data),
    E.mapLeft(() => invalidMessageError(`Invalid message: ${JSON.stringify(data)}`)),
  );

export const isMessage = (data: unknown): data is Message => E.isRight(MessageCodec.decode(data));

// Errors

export type InvalidMessageOriginError = Readonly<{
  type: "InvalidMessageOriginError";
  message: string;
}>;

export type InvalidMessageTypeError = Readonly<{
  type: "InvalidMessageTypeError";
  message: string;
}>;

export type InvalidMessageError = Readonly<{
  type: "InvalidMessageError";
  message: string;
}>;

export const invalidMessageOriginError = (message: string): InvalidMessageOriginError => ({
  type: "InvalidMessageOriginError",
  message,
});

export const invalidMessageTypeError = (message: string): InvalidMessageTypeError => ({
  type: "InvalidMessageTypeError",
  message,
});

export const invalidMessageError = (message: string): InvalidMessageError => ({
  type: "InvalidMessageError",
  message,
});
