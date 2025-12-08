import type { ExtensionConfig } from "@hbb-emu/core";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import type { Instance } from "./app";

export type SendError = Readonly<{
  type: "SendError";
  message: string;
}>;
export const sendError = (message: string): SendError => ({ type: "SendError", message });

export const sendGetState = (app: Instance): TE.TaskEither<SendError, void> =>
  pipe(
    app.send("BACKGROUND_SCRIPT", { type: "GET_STATE", payload: null }),
    TE.mapError((error) => sendError(`Failed to send GET_STATE: ${String(error)}`)),
  );

export const waitForState = (app: Instance): TE.TaskEither<ResponseError | TimeoutError, State> =>
  pipe(
    TE.tryCatch(
      () => app.once("STATE_UPDATED", 3000)(),
      () => timeoutError("Timeout waiting for STATE_UPDATED"),
    ),
    TE.flatMap((result) =>
      TE.fromEither(
        pipe(
          result,
          E.mapLeft(() => responseError("Invalid response")),
          E.map((r) => r.message.payload),
        ),
      ),
    ),
  );

export type TimeoutError = Readonly<{
  type: "TimeoutError";
  message: string;
}>;

export type ResponseError = Readonly<{
  type: "ResponseError";
  message: string;
}>;

export const responseError = (message: string): ResponseError => ({ type: "ResponseError", message });

export const timeoutError = (message: string): TimeoutError => ({ type: "TimeoutError", message });
