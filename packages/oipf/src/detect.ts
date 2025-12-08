import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

// FIXME: migrare a ObjectFactoryAPI

const HBBTV_OBJECT_TYPES = [
  "application/oipfApplicationManager",
  "application/oipfConfiguration",
  "application/oipfCapabilities",
] as const;

const HBBTV_META_SELECTOR = 'meta[http-equiv="Content-Type"][content*="hbbtv"]';
const HBBTV_OBJECT_SELECTOR = HBBTV_OBJECT_TYPES.map((t) => `object[type="${t}"]`).join(","); // FIXME: duplicato

const hasHbbTVObjects = (doc: Document): IO.IO<boolean> =>
  pipe(
    IO.of(doc.querySelector(HBBTV_OBJECT_SELECTOR)),
    IO.map((el) => el !== null),
  );

const hasHbbTVMeta = (doc: Document): IO.IO<boolean> =>
  pipe(
    IO.of(doc.querySelector(HBBTV_META_SELECTOR)),
    IO.map((el) => el !== null),
  );

const hasHbbTVContentType = (doc: Document): IO.IO<boolean> =>
  pipe(
    IO.of(doc.contentType),
    IO.map((ct) => ct.toLowerCase().includes("hbbtv")),
  );

export const isHbbTVPage = (doc: Document): IO.IO<boolean> =>
  pipe(
    IO.Do,
    IO.bind("hasObjects", () => hasHbbTVObjects(doc)),
    IO.bind("hasMeta", () => hasHbbTVMeta(doc)),
    IO.bind("hasContentType", () => hasHbbTVContentType(doc)),
    IO.map(({ hasObjects, hasMeta, hasContentType }) => hasObjects || hasMeta || hasContentType),
  );
