import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";

// Message Source

export type MessageOrigin = "SIDE_PANEL" | "SERVICE_WORKER" | "CONTENT_SCRIPT" | "BRIDGE_SCRIPT";

export const MessageOriginCodec = t.union([
  t.literal("SIDE_PANEL"),
  t.literal("SERVICE_WORKER"),
  t.literal("CONTENT_SCRIPT"),
  t.literal("BRIDGE_SCRIPT"),
]);

export type InvalidMessageOriginError = Readonly<{
  type: "InvalidMessageOriginError";
  message: string;
}>;

export const invalidMessageOriginError = (message: string): InvalidMessageOriginError => ({
  type: "InvalidMessageOriginError",
  message,
});

export const validateMessageOrigin = (data: unknown): E.Either<InvalidMessageOriginError, MessageOrigin> =>
  pipe(
    MessageOriginCodec.decode(data),
    E.mapLeft(() => invalidMessageOriginError(`Invalid message origin: ${data}`)),
  );

export const isValidMessageOrigin = (origin: string): origin is MessageOrigin =>
  E.isRight(MessageOriginCodec.decode(origin));
