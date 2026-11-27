import { describe, expect, it } from "vitest";
import { FULLSCREEN_ATTRIBUTE } from "../../../subsystems/provider/detection/embedded";
import { createObjectVideoWindow, parsePixels } from "./videoWindow";

const setup = (style = "") => {
  const object = document.createElement("object");
  object.setAttribute("type", "video/broadcast");
  object.setAttribute("style", style);
  document.body.appendChild(object);
  return { object, videoWindow: createObjectVideoWindow(object) };
};

describe("parsePixels", () => {
  it.each([
    ["640px", 640],
    ["640.9px", 640],
    ["0px", 0],
    ["auto", 0],
    ["", 0],
    ["50%", 0],
  ])("%j → %d", (input, expected) => {
    expect(parsePixels(input)).toBe(expected);
  });
});

describe("createObjectVideoWindow", () => {
  it("reads the size from the object's style", () => {
    const { videoWindow } = setup("width: 640px; height: 360px");

    expect(videoWindow.getSize()).toEqual({ width: 640, height: 360 });
  });

  it("reflects style changes made by the application directly", () => {
    const { object, videoWindow } = setup("width: 640px; height: 360px");

    object.style.width = "320px";

    expect(videoWindow.getSize().width).toBe(320);
  });

  it("writes width and height to the object's style, one at a time", () => {
    const { object, videoWindow } = setup("width: 640px; height: 50%");

    videoWindow.setWidth(800)();

    expect(object.style.width).toBe("800px");
    expect(object.style.height).toBe("50%");

    videoWindow.setHeight(450)();
    expect(object.style.height).toBe("450px");
  });

  it("full-screen marks the object, whichever video it holds, and leaves its style (and z-index) alone", () => {
    const { object, videoWindow } = setup("width: 640px; height: 360px; z-index: 3");

    videoWindow.setFullScreen(true)();

    expect(object.hasAttribute(FULLSCREEN_ATTRIBUTE)).toBe(true);
    expect(object.getAttribute("style")).toBe("width: 640px; height: 360px; z-index: 3");

    videoWindow.setFullScreen(false)();
    expect(object.hasAttribute(FULLSCREEN_ATTRIBUTE)).toBe(false);
  });

  it("is lazy", () => {
    const { object, videoWindow } = setup("width: 640px");

    const resize = videoWindow.setWidth(10);
    const enter = videoWindow.setFullScreen(true);

    expect(object.style.width).toBe("640px");
    expect(object.hasAttribute(FULLSCREEN_ATTRIBUTE)).toBe(false);
    resize();
    enter();
    expect(object.style.width).toBe("10px");
  });
});
