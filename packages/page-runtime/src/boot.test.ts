import * as O from "fp-ts/Option";
import { describe, expect, it, vi } from "vitest";
import { BOOT_MARKER, bootPageRuntime, isHbbTVDocument } from "./boot";

const XHTML_NS = "http://www.w3.org/1999/xhtml";

const xhtmlDocument = () => document.implementation.createDocument(XHTML_NS, "html");

const setup = (doc: Document = xhtmlDocument()) => {
  const fakeWindow = {} as Window;
  const startRuntime = vi.fn(() => "handle");
  const boot = () => bootPageRuntime({ window: fakeWindow, document: doc, startRuntime })();
  return { boot, startRuntime, fakeWindow };
};

describe("isHbbTVDocument", () => {
  it("accepts an HbbTV document rewritten to XHTML by the host", () => {
    expect(isHbbTVDocument(xhtmlDocument())).toBe(true);
  });

  it("accepts the original HbbTV content type when the host does not rewrite it", () => {
    const doc = { contentType: "application/vnd.hbbtv.xhtml+xml" } as Document;
    expect(isHbbTVDocument(doc)).toBe(true);
  });

  it("rejects ordinary web pages", () => {
    expect(isHbbTVDocument(document)).toBe(false);
  });
});

describe("bootPageRuntime", () => {
  it("starts the runtime in an HbbTV document", () => {
    const { boot, startRuntime } = setup();

    expect(boot()).toEqual(O.some("handle"));
    expect(startRuntime).toHaveBeenCalledOnce();
  });

  it("does nothing on ordinary web pages", () => {
    const { boot, startRuntime } = setup(document);

    expect(boot()).toEqual(O.none);
    expect(startRuntime).not.toHaveBeenCalled();
  });

  it("starts only once per window, even if the script is injected twice", () => {
    const { boot, startRuntime } = setup();

    boot();
    expect(boot()).toEqual(O.none);
    expect(startRuntime).toHaveBeenCalledOnce();
  });

  it("marks the window without exposing an enumerable property to the application", () => {
    const { boot, fakeWindow } = setup();

    boot();

    expect((fakeWindow as unknown as Record<symbol, unknown>)[BOOT_MARKER]).toBe(true);
    expect(Object.keys(fakeWindow)).toEqual([]);
  });

  it("is lazy", () => {
    const { startRuntime, fakeWindow } = setup();

    bootPageRuntime({ window: fakeWindow, document: xhtmlDocument(), startRuntime });

    expect(startRuntime).not.toHaveBeenCalled();
  });
});
