import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/content-script/main.ts"),
      name: "ContentScript",
      formats: ["iife"],
      fileName: () => "content-script.js",
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
