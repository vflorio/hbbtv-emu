/**
 * Content types of an HbbTV document as seen by the page.
 * Hosts rewrite `application/vnd.hbbtv.xhtml+xml` to `application/xhtml+xml` so that the
 * browser renders it (DNR on MV3, webRequest on MV2); a host that does not rewrite
 * leaves the original type, which also contains "hbbtv".
 *
 * Shared by the page runtime (start or not) and by hosts that inject it (inject or not).
 */
export const isHbbTVDocument = (document: Pick<Document, "contentType">): boolean => {
  const contentType = document.contentType.toLowerCase();
  return contentType === "application/xhtml+xml" || contentType.includes("hbbtv");
};
