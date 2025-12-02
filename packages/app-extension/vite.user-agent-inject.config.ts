import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/user-agent-inject/main.ts"),
      name: "userAgentInject",
      formats: ["iife"],
      fileName: () => "user-agent-inject.js",
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
