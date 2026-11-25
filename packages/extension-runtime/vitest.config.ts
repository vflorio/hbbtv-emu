import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared";

// jsdom: the bridge runs in a content script, against the page DOM.
export default mergeConfig(shared, defineConfig({ test: { environment: "jsdom" } }));
