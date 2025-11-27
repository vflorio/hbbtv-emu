import { type ClassType, compose, WithMessageBus, WithPostMessageAdapter } from "@hbb-emu/lib";

// Adapter senza MessageBus - usato dal content script principale
// che non ha bisogno di registrare handler locali tramite bus.on()
export const WithContentScriptAdapter = <T extends ClassType>(Base: T) => WithPostMessageAdapter(Base);

// Adapter CON MessageBus - usato dagli oggetti HbbTV
// che devono registrare handler per UPDATE_CHANNELS, UPDATE_CAPABILITIES, etc.
// Il filtering è automatico: riceve solo messaggi con target=CONTENT_SCRIPT o target=undefined (broadcast)
// biome-ignore format: ack
export const WithContentScriptMessageBus = <T extends ClassType>(Base: T) =>
  compose(
    Base,
    WithPostMessageAdapter,
    WithMessageBus("CONTENT_SCRIPT")
  );
