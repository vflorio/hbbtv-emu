import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/bridge-script/main.ts"),
      name: "BridgeScript",
      formats: ["iife"],
      fileName: () => "bridge-script.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
