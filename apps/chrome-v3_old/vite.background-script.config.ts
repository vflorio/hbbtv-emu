import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/background-script/main.ts"),
      name: "BackgroundScript",
      formats: ["iife"],
      fileName: () => "background-script.js",
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
