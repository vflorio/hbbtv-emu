/**
 * Page runtime bootstrap.
 *
 * Runs in the page's own JS world (MAIN), as early as the host allows (ideally
 * `document_start`), so that the OIPF APIs exist before any application script,
 * as on a TV. It decides by itself whether the document is an HbbTV application;
 * hosts only have to load it.
 */

import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";

/**
 * Content types of an HbbTV document as seen by the page.
 * Hosts rewrite `application/vnd.hbbtv.xhtml+xml` to `application/xhtml+xml` so that the
 * browser renders it (DNR on MV3, webRequest on MV2); a host that does not rewrite
 * leaves the original type, which also contains "hbbtv".
 */
export const isHbbTVDocument = (document: Document): boolean => {
  const contentType = document.contentType.toLowerCase();
  return contentType === "application/xhtml+xml" || contentType.includes("hbbtv");
};

/** Marks a window whose runtime has already started (scripts can be injected twice). */
export const BOOT_MARKER = Symbol.for("hbb-emu.page-runtime");

type MarkedWindow = Window & { [BOOT_MARKER]?: true };

export type BootEnv<Handle> = Readonly<{
  window: Window;
  document: Document;
  /** Starts the runtime; injected so the bootstrap can be tested without it. */
  startRuntime: IO.IO<Handle>;
}>;

/**
 * Starts the runtime once per window, and only in HbbTV documents.
 * Returns the runtime handle when it started, `none` otherwise.
 */
export const bootPageRuntime = <Handle>({ window, document, startRuntime }: BootEnv<Handle>): IO.IO<O.Option<Handle>> =>
  pipe(
    IO.of(isHbbTVDocument(document) && !(window as MarkedWindow)[BOOT_MARKER]),
    IO.flatMap((shouldStart) =>
      shouldStart
        ? pipe(
            IO.of(undefined),
            IO.tap(() => () => {
              Object.defineProperty(window, BOOT_MARKER, { value: true, enumerable: false });
            }),
            IO.flatMap(() => startRuntime),
            IO.map(O.some),
          )
        : IO.of(O.none),
    ),
  );
