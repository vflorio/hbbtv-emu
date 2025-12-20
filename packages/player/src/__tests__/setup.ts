/**
 * Test setup file
 * Runs before each test suite
 */

// Mock HTMLVideoElement if needed
if (typeof HTMLVideoElement === "undefined") {
  // @ts-expect-error - mocking for test environment
  global.HTMLVideoElement = class HTMLVideoElement {
    src = "";
    currentTime = 0;
    duration = 0;
    paused = true;
    ended = false;
    readyState = 0;
    networkState = 0;
    error = null;
    volume = 1;
    muted = false;
    playbackRate = 1;

    play() {
      return Promise.resolve();
    }
    pause() {}
    load() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
  };
}

// Mock URL.createObjectURL if needed
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = () => "mock-url";
}
