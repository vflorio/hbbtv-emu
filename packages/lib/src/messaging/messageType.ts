import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";

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

export const isValidMessageType = (type: string): type is MessageType => E.isRight(MessageTypeCodec.decode(type));

export type InvalidMessageTypeError = Readonly<{
  type: "InvalidMessageTypeError";
  message: string;
}>;

export const invalidMessageTypeError = (message: string): InvalidMessageTypeError => ({
  type: "InvalidMessageTypeError",
  message,
});
