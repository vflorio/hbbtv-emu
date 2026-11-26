import { describe, expect, it } from "vitest";
import { installDataCue } from "./dataCue";

class FakeVTTCue {
  constructor(
    readonly startTime: number,
    readonly endTime: number,
    readonly text: string,
  ) {}
}

describe("DataCue (HTML 5.1), for DASH events (TS 102 796 §9.3.2.2)", () => {
  it("made from the browser's VTTCue, with its data, and published on the window", () => {
    const window = { VTTCue: FakeVTTCue } as unknown as Window & { DataCue?: unknown };
    const installed = installDataCue(window);
    const data = new ArrayBuffer(2);

    type Made = new (startTime: number, endTime: number, data: ArrayBuffer) => FakeVTTCue & { data: ArrayBuffer };
    const cue = new (installed?.DataCue as unknown as Made)(1, 2, data);

    expect(window.DataCue).toBe(installed?.DataCue);
    expect(cue).toBeInstanceOf(window.DataCue as never);
    expect(cue).toMatchObject({ startTime: 1, endTime: 2, text: "", data });
    installed?.uninstall();
    expect("DataCue" in window).toBe(false);
  });

  it("the browser's own DataCue is left as it is", () => {
    class NativeDataCue {}
    const window = { DataCue: NativeDataCue, VTTCue: FakeVTTCue } as unknown as Window & { DataCue?: unknown };

    const installed = installDataCue(window);
    installed?.uninstall();

    expect(installed?.DataCue).toBe(NativeDataCue);
    expect(window.DataCue).toBe(NativeDataCue);
  });

  it("no VTTCue to make it from: none", () => {
    expect(installDataCue({} as Window)).toBeNull();
  });
});
