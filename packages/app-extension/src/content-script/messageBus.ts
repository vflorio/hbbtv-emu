import { type ClassType, compose, WithChromeMessageAdapter, WithMessageBus } from "@hbb-emu/lib";

export const WithContentScriptMessageBus = <T extends ClassType>(Base: T) =>
  compose(Base, WithChromeMessageAdapter, WithMessageBus("CONTENT_SCRIPT"));
