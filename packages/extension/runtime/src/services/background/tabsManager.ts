import { createLogger, type Logger } from "@hbb-emu/core";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import { match } from "ts-pattern";

export type ExtraInfoSpec = "blocking" | "extraHeaders" | "responseHeaders";

type UnsubscribeFn = () => void;

export type HttpHeader = { name: string; value?: string };

type HeadersResponse<THeader extends HttpHeader = HttpHeader> = {
  responseHeaders?: THeader[];
};

interface WebRequestAdapter<TResponse extends HeadersResponse = HeadersResponse> {
  onHeadersReceived: (handler: (details: TResponse) => TResponse) => UnsubscribeFn;
}

type TabStatus = "unloaded" | "loading" | "complete";

interface TabsAdapter {
  onTabsUpdated: (handler: (tabId: number, status: TabStatus) => void) => UnsubscribeFn;
}

export type TabsManangerEnv = {
  webRequest: WebRequestAdapter;
  tabs: TabsAdapter;
  handlers: {
    onTabAdded: (tabId: number) => IO.IO<void>;
    onTabRemoved: (tabId: number) => IO.IO<void>;
  };
};

export const createDefaultTabsManagerEnv = (): TabsManangerEnv => ({
  handlers: {
    onTabAdded: (_tabId: number) => () => {},
    onTabRemoved: (_tabId: number) => () => {},
  },
  webRequest: {
    onHeadersReceived:
      <TResponse extends HeadersResponse>(_handler: (details: TResponse) => TResponse): UnsubscribeFn =>
      () => {},
  },
  tabs: {
    onTabsUpdated:
      (_handler: (tabId: number, status: TabStatus) => void): UnsubscribeFn =>
      () => {},
  },
});

export class TabsManager {
  protected readonly tabs: number[] = [];

  constructor(
    protected readonly env: TabsManangerEnv,
    private readonly logger: Logger = createLogger("TabsManager"),
  ) {
    env.tabs.onTabsUpdated(this.onTabsUpdated);
    env.webRequest.onHeadersReceived(this.onHeadersReceived);
  }

  private readonly onTabsUpdated = (tabId: number, tabStatus: TabStatus): void =>
    pipe(
      IOO.fromNullable(tabStatus),
      IOO.filter((status) => status === "loading" || status === "unloaded"),
      IOO.tapIO((status) => this.logger.info(`Tab ${tabId} status change: ${status} `)),
      IOO.tapIO((status) =>
        match(status)
          .with("loading", () => this.env.handlers.onTabAdded(tabId))
          .with("unloaded", () => this.env.handlers.onTabRemoved(tabId))
          .exhaustive(),
      ),
      IO.asUnit,
    )();

  private readonly onHeadersReceived = <TResponse extends HeadersResponse<THeader>, THeader extends HttpHeader>({
    responseHeaders = [],
    ...etc
  }: TResponse): TResponse => {
    const updateFirst =
      <A>(predicate: (a: A) => boolean, map: (a: A) => A) =>
      (as: A[]): A[] =>
        pipe(
          as,
          A.findIndex(predicate),
          O.match(
            () => as,
            (index) =>
              pipe(
                as,
                A.modifyAt(index, map),
                O.getOrElse(() => as),
              ),
          ),
        );

    return pipe(
      responseHeaders,
      updateFirst(
        (header) => header.name?.toLowerCase() === "content-type",
        (header) => ({ ...header, value: "application/xhtml+xml" }),
      ),
      (modifiedHeaders) => ({ responseHeaders: modifiedHeaders, ...etc }) as TResponse,
    );
  };
}
