import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/bridge.ts"),
      name: "Bridge",
      formats: ["iife"],
      fileName: () => "bridge.js",
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
