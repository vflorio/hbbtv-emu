import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { ExtensionConfig } from "../lib/config";

export type BridgeContextPayload = Readonly<{
  tabId: number;
}>;

const BridgeContextPayloadCodec = t.type({
  tabId: t.number,
});

export type Message =
  | { type: "BRIDGE_SCRIPT_READY"; payload: null }
  | { type: "BRIDGE_CONTEXT_RECEIVED"; payload: null }
  | { type: "CONTENT_SCRIPT_READY"; payload: null }
  | { type: "UPDATE_BRIDGE_CONTEXT"; payload: BridgeContextPayload }
  | { type: "GET_STATE"; payload: null }
  | { type: "STATE_UPDATED"; payload: ExtensionConfig.State }
  | { type: "DISPATCH_STREAM_EVENT"; payload: ExtensionConfig.StreamEventConfig };

export const MessageCodec: t.Type<Message> = t.union([
  t.type({ type: t.literal("BRIDGE_SCRIPT_READY"), payload: t.null }),
  t.type({ type: t.literal("BRIDGE_CONTEXT_RECEIVED"), payload: t.null }),
  t.type({ type: t.literal("CONTENT_SCRIPT_READY"), payload: t.null }),
  t.type({ type: t.literal("UPDATE_BRIDGE_CONTEXT"), payload: BridgeContextPayloadCodec }),
  t.type({ type: t.literal("GET_STATE"), payload: t.null }),
  t.type({ type: t.literal("STATE_UPDATED"), payload: ExtensionConfig.StateCodec }),
  t.type({ type: t.literal("DISPATCH_STREAM_EVENT"), payload: ExtensionConfig.StreamEventConfigCodec }),
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
