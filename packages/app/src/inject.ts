import hbbtvApi from "@hbb-emu/hbbtv-api";

Object.entries(hbbtvApi).forEach(([key, value]) => {
  // biome-ignore lint/suspicious/noExplicitAny: augmenting window object
  (window as any)[key] = value;
});
