import type { ManifestVersion, UnsubscribeFn } from "@hbb-emu/extension-runtime";
import { match } from "ts-pattern";

export interface WebRequestAdapter {
  onHeadersReceived: (
    handler: (details: chrome.webRequest.OnHeadersReceivedDetails) => chrome.webRequest.OnHeadersReceivedDetails,
  ) => UnsubscribeFn;
}

/**
 * @since Chrome 58+ Firefox 45+
 */
export const createWebRequestAdapter = (manifestVersion: ManifestVersion): WebRequestAdapter => ({
  onHeadersReceived: (handler) => {
    const listener = match(manifestVersion)
      .with(
        2,
        () =>
          (details: chrome.webRequest.OnHeadersReceivedDetails): chrome.webRequest.BlockingResponse => ({
            responseHeaders: handler(details).responseHeaders,
          }),
      )
      .with(
        3,
        () =>
          (details: chrome.webRequest.OnHeadersReceivedDetails): chrome.webRequest.BlockingResponse | undefined =>
            handler(details),
      )
      .exhaustive();

    const extraInfoSpec = match(manifestVersion)
      .with(2, () => [
        chrome.webRequest.OnHeadersReceivedOptions.RESPONSE_HEADERS,
        chrome.webRequest.OnHeadersReceivedOptions.BLOCKING,
        chrome.webRequest.OnHeadersReceivedOptions.EXTRA_HEADERS,
      ])
      .with(3, () => [chrome.webRequest.OnHeadersReceivedOptions.RESPONSE_HEADERS])
      .exhaustive();

    chrome.webRequest.onHeadersReceived.addListener(listener, { urls: ["<all_urls>"] }, extraInfoSpec);

    return () => chrome.webRequest.onHeadersReceived.removeListener(listener);
  },
});
