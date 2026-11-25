import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** The settings UI (sidebar) and the TV page. Other entries are built by their own configs into the same dist. */
export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: false,
  build: {
    rollupOptions: {
      input: { index: resolve(__dirname, "index.html"), tv: resolve(__dirname, "tv.html") },
      output: {
        entryFileNames: (chunk) => (chunk.name === "index" ? "ui.js" : `${chunk.name}.js`),
        chunkFileNames: "ui-[name].js",
        assetFileNames: "ui-[name][extname]",
      },
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
