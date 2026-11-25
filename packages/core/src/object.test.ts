import { describe, expect, it } from "vitest";
import { proxyProperties } from "./object";

class Source {
  calls = 0;
  private _level = 1;

  get level(): number {
    return this._level;
  }

  set level(value: number) {
    this._level = value;
  }

  bump(by: number): number {
    this.calls += by;
    return this.calls;
  }
}

describe("proxyProperties", () => {
  it("forwards method calls to the source, with the source as `this`", () => {
    const source = new Source();
    const target = {} as Source;

    proxyProperties(target, source)();

    expect(target.bump(2)).toBe(2);
    expect(source.calls).toBe(2);
  });

  it("forwards reads and writes of accessors", () => {
    const source = new Source();
    const target = {} as Source;

    proxyProperties(target, source)();
    target.level = 5;

    expect(source.level).toBe(5);
    expect(target.level).toBe(5);
  });

  it("keeps keys that already exist on the target (native DOM API)", () => {
    const element = document.createElement("object");
    const source = { width: 640, id: "from-source" };

    proxyProperties(element, source)();

    expect(element.width).toBe("");
    expect(element.id).toBe("");
  });

  it("replaces existing keys that are explicitly overridden", () => {
    const element = document.createElement("object");
    const source = { width: 640, id: "from-source" };

    proxyProperties(element, source, ["width"])();

    expect((element as unknown as { width: number }).width).toBe(640);
    expect(element.id).toBe("");
  });

  it("is lazy", () => {
    const target = {} as Partial<Source>;

    const io = proxyProperties(target, new Source());

    expect(target.bump).toBeUndefined();
    io();
    expect(typeof target.bump).toBe("function");
  });
});
