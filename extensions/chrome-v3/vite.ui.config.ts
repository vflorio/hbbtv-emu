import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** The settings UI (side panel). Other entries are built by their own configs into the same dist. */
export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: false,
  build: {
    rollupOptions: {
      input: { index: resolve(__dirname, "index.html") },
      output: {
        entryFileNames: "ui.js",
        chunkFileNames: "ui-[name].js",
        assetFileNames: "ui-[name][extname]",
      },
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
