/**
 * Serves the test applications in `e2e/fixtures` like a broadcaster would:
 * `.xhtml` files with the HbbTV content type, everything else by extension, and byte
 * ranges, as any web server (Chromium cannot seek in a progressive file whose server
 * does not answer them, until it has it in its buffer).
 */

import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";

export const HBBTV_CONTENT_TYPE = "application/vnd.hbbtv.xhtml+xml; charset=UTF-8";

const CONTENT_TYPES: Record<string, string> = {
  ".xhtml": HBBTV_CONTENT_TYPE,
  ".html": "text/html; charset=UTF-8",
  ".js": "text/javascript; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mpd": "application/dash+xml",
  ".m4s": "video/iso.segment",
  // TS 102 796 §9.3.1: stream event descriptions.
  ".ste": "application/vnd.dvb.streamevent+xml",
};

export type RecordedRequest = Readonly<{
  url: string;
  userAgent: string | undefined;
  /** The User-Agent Client Hints received (`sec-ch-ua…`, lower case): a TV sends none. */
  clientHints: ReadonlyArray<string>;
}>;

export type FixtureServer = Readonly<{
  /** Absolute URL of a fixture, e.g. `url("basic-app/index.xhtml")`. */
  url: (path: string) => string;
  /** Every request received so far, in order (what the "broadcaster" saw). */
  requests: ReadonlyArray<RecordedRequest>;
  close: () => Promise<void>;
}>;

/** A single `bytes=start-end` range of a body of `size` bytes, or null if there is none to serve. */
const byteRange = (header: string | undefined, size: number): { start: number; end: number } | null => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!match || (match[1] === "" && match[2] === "")) return null;
  const [start, end] =
    match[1] === ""
      ? [Math.max(0, size - Number(match[2])), size - 1]
      : [Number(match[1]), match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1)];
  return start <= end && start < size ? { start, end } : null;
};

export const startFixtureServer = async (root: string): Promise<FixtureServer> => {
  const requests: RecordedRequest[] = [];
  const server: Server = createServer(async (request, response) => {
    requests.push({
      url: request.url ?? "/",
      userAgent: request.headers["user-agent"],
      clientHints: Object.keys(request.headers).filter((name) => name.startsWith("sec-ch-ua")),
    });
    const path = normalize(decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname));
    if (path.includes("..")) {
      response.writeHead(400).end();
      return;
    }
    try {
      const body = await readFile(join(root, path));
      const type = CONTENT_TYPES[extname(path)] ?? "application/octet-stream";
      const range = byteRange(request.headers.range, body.length);
      if (request.headers.range !== undefined && range === null) {
        response.writeHead(416, { "Content-Range": `bytes */${body.length}` }).end();
        return;
      }
      if (range !== null) {
        response.writeHead(206, {
          "Content-Type": type,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${range.start}-${range.end}/${body.length}`,
          "Content-Length": range.end - range.start + 1,
        });
        response.end(body.subarray(range.start, range.end + 1));
        return;
      }
      response.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": body.length });
      response.end(body);
    } catch {
      // With a type, as real servers answer: Firefox parses an untyped empty answer
      // to an XHR as XML, and reports the parsing error as a page error.
      response.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" }).end("Not found");
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: (path) => `http://127.0.0.1:${port}/${path}`,
    requests,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
};
