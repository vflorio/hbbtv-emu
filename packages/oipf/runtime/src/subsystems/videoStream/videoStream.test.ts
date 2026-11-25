import { describe, expect, it } from "vitest";
import { VideoStreamService } from "./videoStream";

const setup = () => {
  const video = document.createElement("video");
  return { video, stream: new VideoStreamService(video) };
};

describe("VideoStreamService — display", () => {
  it("setFullscreen(true) stretches the video to its container", () => {
    const { video, stream } = setup();

    stream.setFullscreen(true)();

    expect(video.style.width).toBe("100%");
    expect(video.style.height).toBe("100%");
  });

  it("setFullscreen(false) drops the full-screen styling", () => {
    const { video, stream } = setup();
    stream.setFullscreen(true)();

    stream.setFullscreen(false)();

    expect(video.getAttribute("style")).toBeNull();
  });

  it("setSize() sets the size in pixels", () => {
    const { video, stream } = setup();

    stream.setSize(640, 360)();

    expect(video.style.width).toBe("640px");
    expect(video.style.height).toBe("360px");
  });

  it("is lazy: nothing changes until the IO is run", () => {
    const { video, stream } = setup();

    const enter = stream.setFullscreen(true);
    const resize = stream.setSize(640, 360);

    expect(video.getAttribute("style")).toBeNull();
    resize();
    enter();
    expect(video.style.width).toBe("100%");
  });
});
