import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";

export type MessageType =
  | "BRIDGE_SCRIPT_READY"
  | "BRIDGE_CONTEXT_RECEIVED"
  | "CONTENT_SCRIPT_READY"
  | "UPDATE_BRIDGE_CONTEXT"
  | "STATE_UPDATED"
  | "GET_STATE"
  | "PLAY_CHANNEL"
  | "DISPATCH_STREAM_EVENT";

export const MessageTypeCodec = t.union([
  t.literal("BRIDGE_SCRIPT_READY"),
  t.literal("BRIDGE_CONTEXT_RECEIVED"),
  t.literal("CONTENT_SCRIPT_READY"),
  t.literal("UPDATE_BRIDGE_CONTEXT"),
  t.literal("STATE_UPDATED"),
  t.literal("GET_STATE"),
  t.literal("PLAY_CHANNEL"),
  t.literal("DISPATCH_STREAM_EVENT"),
]);

export const validateMessageType = (data: unknown): E.Either<InvalidMessageTypeError, MessageType> =>
  pipe(
    MessageTypeCodec.decode(data),
    E.mapLeft(() => invalidMessageTypeError(`Invalid message type: ${data}`)),
  );

export const isValidMessageType = (type: string): type is MessageType => E.isRight(MessageTypeCodec.decode(type));

export type InvalidMessageTypeError = Readonly<{
  type: "InvalidMessageTypeError";
  message: string;
}>;

export const invalidMessageTypeError = (message: string): InvalidMessageTypeError => ({
  type: "InvalidMessageTypeError",
  message,
});
