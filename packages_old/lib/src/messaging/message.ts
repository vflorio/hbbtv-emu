import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { ExtensionConfig } from "../config";

// Stream event payload for dispatching DSM-CC events
export const StreamEventPayloadCodec = t.type({
  targetURL: t.string,
  eventName: t.string,
  data: t.string,
  text: t.string,
});

export type StreamEventPayload = t.TypeOf<typeof StreamEventPayloadCodec>;

export type Message =
  | { type: "BRIDGE_READY"; payload: null }
  | { type: "CONTENT_SCRIPT_READY"; payload: null }
  | { type: "UPDATE_USER_AGENT"; payload: string }
  | { type: "UPDATE_CONFIG"; payload: ExtensionConfig.State }
  | { type: "GET_CONFIG"; payload: null }
  | { type: "DISPATCH_STREAM_EVENT"; payload: StreamEventPayload };

export const MessageCodec: t.Type<Message> = t.union([
  t.type({ type: t.literal("BRIDGE_READY"), payload: t.null }),
  t.type({ type: t.literal("CONTENT_SCRIPT_READY"), payload: t.null }),
  t.type({ type: t.literal("UPDATE_USER_AGENT"), payload: t.string }),
  t.type({ type: t.literal("UPDATE_CONFIG"), payload: ExtensionConfig.StateCodec }),
  t.type({ type: t.literal("GET_CONFIG"), payload: t.null }),
  t.type({ type: t.literal("DISPATCH_STREAM_EVENT"), payload: StreamEventPayloadCodec }),
]);

export type InvalidMessageError = Readonly<{
  type: "InvalidMessageError";
  message: string;
}>;

export const invalidMessageError = (message: string): InvalidMessageError => ({
  type: "InvalidMessageError",
  message,
});

export const validateMessage = (data: unknown): E.Either<InvalidMessageError, Message> =>
  pipe(
    MessageCodec.decode(data),
    E.mapLeft(() => invalidMessageError(`Invalid message: ${JSON.stringify(data)}`)),
  );

export const isMessage = (data: unknown): data is Message => E.isRight(MessageCodec.decode(data));
