/**
 * Serves the test applications in `e2e/fixtures` like a broadcaster would:
 * `.xhtml` files with the HbbTV content type, everything else by extension.
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

export type RecordedRequest = Readonly<{ url: string; userAgent: string | undefined }>;

export type FixtureServer = Readonly<{
  /** Absolute URL of a fixture, e.g. `url("basic-app/index.xhtml")`. */
  url: (path: string) => string;
  /** Every request received so far, in order (what the "broadcaster" saw). */
  requests: ReadonlyArray<RecordedRequest>;
  close: () => Promise<void>;
}>;

export const startFixtureServer = async (root: string): Promise<FixtureServer> => {
  const requests: RecordedRequest[] = [];
  const server: Server = createServer(async (request, response) => {
    requests.push({ url: request.url ?? "/", userAgent: request.headers["user-agent"] });
    const path = normalize(decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname));
    if (path.includes("..")) {
      response.writeHead(400).end();
      return;
    }
    try {
      const body = await readFile(join(root, path));
      response.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(path)] ?? "application/octet-stream" });
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
