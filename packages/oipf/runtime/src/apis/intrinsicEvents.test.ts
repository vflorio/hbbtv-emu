import { describe, expect, it } from "vitest";
import { intrinsicEvent, noContext } from "./intrinsicEvents";

type PlayStateProperty = { onPlayStateChange?: (state: number, error?: number) => void };

const setup = () => {
  const object = document.createElement("object") as HTMLObjectElement & PlayStateProperty;
  document.body.appendChild(object);
  const seen: unknown[] = [];
  const playStateChange = intrinsicEvent(
    object,
    "PlayStateChange",
    (state, error) => ({ state, error }),
    (state: number, error?: number) => object.onPlayStateChange?.(state, error),
  );
  return { object, seen, playStateChange };
};

describe("intrinsic events and their DOM events (OIPF DAE §7.13.1.4)", () => {
  it("calls the onXxx property, then the application's listeners, with the context info as properties", () => {
    const { object, seen, playStateChange } = setup();
    object.addEventListener("PlayStateChange", (event) => {
      const { type, bubbles, cancelable } = event;
      const { state, error } = event as Event & { state: number; error: number };
      seen.push({ type, bubbles, cancelable, state, error });
    });
    object.onPlayStateChange = (state, error) => seen.push({ property: [state, error] });

    playStateChange(3, 5);

    expect(seen).toEqual([
      { property: [3, 5] },
      { type: "PlayStateChange", bubbles: false, cancelable: false, state: 3, error: 5 },
    ]);
  });

  it("dispatches on the object itself: it does not bubble", () => {
    const { seen, playStateChange } = setup();
    document.body.addEventListener("PlayStateChange", () => seen.push("bubbled"));

    playStateChange(0);

    expect(seen).toEqual([]);
  });

  it("an exception in the property does not keep the listeners from running", () => {
    const { object, seen, playStateChange } = setup();
    const reported: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      reported.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", onError);
    object.onPlayStateChange = () => {
      throw new Error("application bug");
    };
    object.addEventListener("PlayStateChange", () => seen.push("listener"));

    playStateChange(1);
    window.removeEventListener("error", onError);

    expect(seen).toEqual(["listener"]);
    expect(reported).toEqual([expect.objectContaining({ message: "application bug" })]);
  });

  it("an event the application dispatches itself does not call the property", () => {
    const { object, seen } = setup();
    object.onPlayStateChange = (state) => seen.push(state);

    object.dispatchEvent(new Event("PlayStateChange"));

    expect(seen).toEqual([]);
  });

  it("without context info, the property still gets its arguments", () => {
    const object = document.createElement("object") as HTMLObjectElement & {
      onFullScreenChange?: (on: boolean) => void;
    };
    const seen: unknown[] = [];
    const fullScreenChange = intrinsicEvent(object, "FullScreenChange", noContext, (on: boolean) =>
      object.onFullScreenChange?.(on),
    );
    object.onFullScreenChange = (on) => seen.push(on);
    object.addEventListener("FullScreenChange", (event) => seen.push({ context: "fullScreen" in event }));

    fullScreenChange(true);

    expect(seen).toEqual([true, { context: false }]);
  });
});
