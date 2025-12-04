import { type App, type ClassType, compose, initApp } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";

export interface AppState {
  tabs: Set<number>;
}

const WithApp = <T extends ClassType>(Base: T) =>
  class extends Base implements App, AppState {
    tabs: Set<number> = new Set<number>();

    init: IO.IO<void> = () => {};
  };

// biome-ignore format: ack
const BackgroundScript = compose(
  class {},
  WithApp
);

initApp(new BackgroundScript())();
