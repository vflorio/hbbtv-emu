import { afterEach, describe, expect, it } from "vitest";
import type { AnyStateful } from "../binding";
import { applyAttachStrategy, detachAttachedElement } from "./attach";
import { EMBEDDED_STYLES_ATTRIBUTE } from "./embedded";

const createObject = (type: string) => {
  const element = document.createElement("object");
  element.setAttribute("type", type);
  document.body.appendChild(element);
  return element;
};

const detected = (element: HTMLObjectElement) => ({ element, mimeType: element.type });

const createVisualInstance = () =>
  ({
    videoElement: document.createElement("video"),
    setFullScreen: () => "called",
    get width() {
      return 640;
    },
  }) as unknown as AnyStateful & { videoElement: HTMLVideoElement };

const injectedStyles = () => document.querySelectorAll(`style[${EMBEDDED_STYLES_ATTRIBUTE}]`);

afterEach(() => {
  document.body.innerHTML = "";
  for (const style of Array.from(injectedStyles())) style.remove();
});

describe("non-visual attach", () => {
  it("exposes the instance methods and properties on the <object> element", () => {
    const element = createObject("application/oipfApplicationManager");
    const instance = {
      getOwnerApplication: () => "app",
      get answer() {
        return 42;
      },
    } as unknown as AnyStateful;

    applyAttachStrategy({ attachStrategy: "non-visual" }, detected(element), instance)();

    const oipf = element as unknown as { getOwnerApplication: () => string; answer: number };
    expect(oipf.getOwnerApplication()).toBe("app");
    expect(oipf.answer).toBe(42);
  });

  it("is lazy", () => {
    const element = createObject("application/oipfApplicationManager");
    const instance = { getOwnerApplication: () => "app" } as unknown as AnyStateful;

    const io = applyAttachStrategy({ attachStrategy: "non-visual" }, detected(element), instance);

    expect("getOwnerApplication" in element).toBe(false);
    io();
    expect("getOwnerApplication" in element).toBe(true);
  });
});

describe("visual-embedded attach", () => {
  it("mounts no video: whoever presents one mounts it inside the <object> (the broadcast layer)", () => {
    const element = createObject("video/broadcast");
    const instance = createVisualInstance();

    applyAttachStrategy({ attachStrategy: "visual-embedded" }, detected(element), instance)();

    expect(instance.videoElement.parentElement).toBeNull();
    expect(element.childElementCount).toBe(0);
    expect(element.nextElementSibling).toBeNull();
  });

  it("injects the emulator stylesheet once, before the application's styles", () => {
    const appStyle = document.createElement("style");
    document.head.appendChild(appStyle);

    for (const element of [createObject("video/broadcast"), createObject("video/broadcast")]) {
      applyAttachStrategy({ attachStrategy: "visual-embedded" }, detected(element), createVisualInstance())();
    }

    expect(injectedStyles()).toHaveLength(1);
    expect(document.head.firstElementChild?.hasAttribute(EMBEDDED_STYLES_ATTRIBUTE)).toBe(true);
    appStyle.remove();
  });

  it("exposes the instance API and replaces only the listed native properties", () => {
    const element = createObject("video/broadcast");

    applyAttachStrategy(
      { attachStrategy: "visual-embedded", nativeOverrides: ["width"] },
      detected(element),
      createVisualInstance(),
    )();

    const oipf = element as unknown as { setFullScreen: () => string; width: number };
    expect(oipf.setFullScreen()).toBe("called");
    expect(oipf.width).toBe(640);
  });

  it("without overrides, native properties of the element win", () => {
    const element = createObject("video/broadcast");

    applyAttachStrategy({ attachStrategy: "visual-embedded" }, detected(element), createVisualInstance())();

    expect(element.width).toBe("");
  });
});

describe("visual attach (legacy)", () => {
  it("puts the video in a container right after the <object>", () => {
    const element = createObject("video/mp4");
    const instance = createVisualInstance();

    applyAttachStrategy({ attachStrategy: "visual" }, detected(element), instance)();

    expect(element.nextElementSibling?.contains(instance.videoElement)).toBe(true);

    detachAttachedElement(element)();
    expect(element.nextElementSibling).toBeNull();
  });

  it("replaces only the native properties listed in nativeOverrides", () => {
    const element = createObject("video/mp4");
    let data = "";
    const instance = Object.defineProperties(createVisualInstance(), {
      data: {
        get: () => data,
        set: (value: string) => {
          data = value;
        },
        enumerable: true,
      },
      type: { get: () => "replaced", enumerable: true },
    });

    applyAttachStrategy({ attachStrategy: "visual", nativeOverrides: ["data"] }, detected(element), instance)();

    (element as HTMLObjectElement & { data: string }).data = "http://vod/movie.mp4";
    expect(data).toBe("http://vod/movie.mp4");
    // The browser never sees it: it does not load the media itself.
    expect(element.hasAttribute("data")).toBe(false);
    expect(element.type).toBe("video/mp4");
  });
});
