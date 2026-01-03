import { match } from "ts-pattern";
import type { UnsubscribeFn } from "..";
import { type AdapterConfig, MANIFEST_VERSION_2, MANIFEST_VERSION_3 } from "./adapter";

export interface WebRequestAdapter {
  onHeadersReceived: (
    handler: (details: chrome.webRequest.OnHeadersReceivedDetails) => chrome.webRequest.OnHeadersReceivedDetails,
  ) => UnsubscribeFn;
}

/**
 * @since Chrome 58+ Firefox 45+
 */
export const createWebRequestAdapter = ({ manifest }: AdapterConfig): WebRequestAdapter => ({
  onHeadersReceived: (handler) => {
    const listener = match(manifest)
      .with(
        MANIFEST_VERSION_2,
        () =>
          (details: chrome.webRequest.OnHeadersReceivedDetails): chrome.webRequest.BlockingResponse => ({
            responseHeaders: handler(details).responseHeaders,
          }),
      )
      .with(
        MANIFEST_VERSION_3,
        () =>
          (details: chrome.webRequest.OnHeadersReceivedDetails): chrome.webRequest.BlockingResponse | undefined =>
            handler(details),
      )
      .exhaustive();

    const extraInfoSpec = match(manifest)
      .with(MANIFEST_VERSION_2, () => ["responseHeaders" as const, "blocking" as const])
      .with(MANIFEST_VERSION_3, () => ["responseHeaders" as const])
      .exhaustive();

    chrome.webRequest.onHeadersReceived.addListener(listener, { urls: ["<all_urls>"] }, extraInfoSpec);

    return () => chrome.webRequest.onHeadersReceived.removeListener(listener);
  },
});
