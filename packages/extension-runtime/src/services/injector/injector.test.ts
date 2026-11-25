import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contentScriptInjecting, injectIntoHbbTVDocument, runInPage } from "./injector";

/**
 * jsdom runs inline scripts in its own realm, not the test's: the tests capture
 * the scripts inserted in the document instead.
 */
let inserted: string[] = [];
const originalAppendChild = Node.prototype.appendChild;

beforeEach(() => {
  inserted = [];
  Node.prototype.appendChild = function <T extends Node>(this: Node, node: T): T {
    if (node instanceof HTMLScriptElement) inserted.push(node.textContent ?? "");
    return originalAppendChild.call(this, node) as T;
  };
});

afterEach(() => {
  Node.prototype.appendChild = originalAppendChild;
  Object.defineProperty(document, "contentType", { value: "text/html", configurable: true });
});

/** jsdom documents are text/html: swap the content type the checks read. */
const withContentType = (contentType: string) => {
  Object.defineProperty(document, "contentType", { value: contentType, configurable: true });
};

describe("runInPage", () => {
  it("inserts the code as an inline script and leaves no element behind", () => {
    const before = document.getElementsByTagName("script").length;

    runInPage(document, "void 'page code';")();

    expect(inserted).toEqual(["void 'page code';"]);
    expect(document.getElementsByTagName("script").length).toBe(before);
  });
});

describe("HbbTV-only injection", () => {
  it.each([
    ["application/xhtml+xml", true],
    ["application/vnd.hbbtv.xhtml+xml", true],
    ["text/html", false],
  ])("%s → injected: %s", (contentType, expected) => {
    withContentType(contentType);

    expect(injectIntoHbbTVDocument(document, "void 'direct';")()).toBe(expected);
    // The variant for registered content scripts must agree with the shared check.
    new Function(contentScriptInjecting("void 'registered';"))();

    expect(inserted).toEqual(expected ? ["void 'direct';", "void 'registered';"] : []);
  });

  it("the registered variant carries any code intact (quotes, newlines, </script>)", () => {
    withContentType("application/xhtml+xml");
    const code = 'var a = "it\'s"; // </script>\nvar b = `x`;';

    new Function(contentScriptInjecting(code))();

    expect(inserted).toEqual([code]);
  });
});
