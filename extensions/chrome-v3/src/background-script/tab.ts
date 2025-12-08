import type { MessageEnvelope } from "@hbb-emu/extension-common";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
export type MissingTabIdError = Readonly<{ type: "MissingTabIdError"; message: string }>;

export const missingTabIdError = (context: string): MissingTabIdError => ({
  type: "MissingTabIdError",
  message: `Missing tabId in ${context}`,
});

export const extractTabId = (envelope: MessageEnvelope): O.Option<number> => O.fromNullable(envelope.context?.tabId);

export const validateTabId = (errorContext: string) =>
  flow(
    extractTabId,
    E.fromOption(() => missingTabIdError(errorContext)),
  );

export const isNotSourceTab =
  (sourceTabId: O.Option<number>) =>
  (tabId: number): boolean =>
    pipe(
      sourceTabId,
      O.match(
        () => true,
        (srcId) => tabId !== srcId,
      ),
    );
