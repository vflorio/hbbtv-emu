import * as TE from "fp-ts/TaskEither";
import type { AdapterError } from "./adapter";

/** A text resource as fetched: its content type (if any) and its body. */
export type BroadbandText = Readonly<{ contentType: string | null; body: string }>;

/**
 * What the TV fetches over broadband for itself, not for the application's page: e.g. the
 * XML description of stream events (TS 102 796 §8.2.1.1). The background fetches it with
 * the extension's host permissions, so without CORS, like a TV, and with the cookies of the
 * resource's site.
 */
export interface BroadbandAdapter {
  readonly fetchText: (url: string) => TE.TaskEither<AdapterError, BroadbandText>;
}

export const createBroadbandAdapter = (fetchImpl: typeof fetch = (...args) => fetch(...args)): BroadbandAdapter => ({
  fetchText: (url) =>
    TE.tryCatch(
      async () => {
        const response = await fetchImpl(url, { credentials: "include" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { contentType: response.headers.get("content-type"), body: await response.text() };
      },
      (cause): AdapterError => ({ _tag: "BroadbandFetchError", url, cause }),
    ),
});
