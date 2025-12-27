import { resolve } from "node:path";
import * as babel from "@babel/core";
import { babel as rollupBabel } from "@rollup/plugin-babel";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Plugin personalizzato per transpilare solo const/let -> var
function babelOutputPlugin() {
  return {
    name: "babel-output",
    generateBundle(_options: any, bundle: any) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        if (chunk.type === "chunk" && fileName.endsWith(".js")) {
          // Solo block-scoping per const/let -> var (più veloce)
          const result = babel.transformSync(chunk.code, {
            filename: fileName,
            plugins: ["@babel/plugin-transform-block-scoping"],
            compact: false,
            comments: true,
            configFile: false,
            babelrc: false,
          });
          if (result && result.code) {
            chunk.code = result.code;
          }
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env": "{}",
  },

  plugins: [
    react({
      babel: {
        presets: [
          [
            "@babel/preset-env",
            {
              // Target ES5 per Webkit r152340 (Tizen 2.4)
              targets: { ie: "9" },

              // Usa entry per includere i polyfills basati sull'import esplicito
              useBuiltIns: "entry",
              corejs: 3,

              // Moduli: false per lasciare gestire a Rollup
              modules: false,

              // Loose mode per codice più compatibile
              loose: true,
            },
          ],
        ],
        plugins: [
          ["babel-plugin-react-compiler"],
          // Forza la transpilazione delle arrow functions
          "@babel/plugin-transform-arrow-functions",
          // Forza la transpilazione di const/let a var
          "@babel/plugin-transform-block-scoping",
        ],
      },
    }),
    // Applica Babel all'output finale per garantire ES5
    babelOutputPlugin(),
  ],

  // Disabilita esbuild completamente per forzare uso di Babel
  esbuild: false,

  build: {
    // ES2015 come target per evitare il crash di esbuild
    // I polyfill di core-js garantiscono la compatibilità ES5
    target: "es2015",

    outDir: "dist",

    sourcemap: false,

    // Includi tutte le dipendenze (non esternalizzare nulla)
    rollupOptions: {
      // Entry point - usa entry.ts che carica prima i polyfills
      input: resolve(__dirname, "src/entry.ts"),

      // Non esternalizzare nulla - tutto nel bundle
      external: [],

      // Transpila tutto il bundle con Babel (incluso node_modules)
      plugins: [
        rollupBabel({
          babelHelpers: "bundled",
          extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs"],
          // Includi node_modules nella transpilazione
          exclude: [],
          presets: [
            "@babel/preset-react",
            [
              "@babel/preset-env",
              {
                targets: { ie: "9" },
                useBuiltIns: false, // Non usiamo entry qui, è già nel polyfills.ts
                modules: false,
                loose: true,
              },
            ],
          ],
          plugins: ["@babel/plugin-transform-arrow-functions", "@babel/plugin-transform-block-scoping"],
        }),
      ],

      output: {
        // Formato IIFE per standalone
        format: "iife",
        name: "HbbTVRuntime",
        entryFileNames: "hbbtv-runtime.js",

        // Nessun code splitting - tutto in un file
        inlineDynamicImports: true,
      },
    },

    // Minificazione con terser per ES5
    minify: "terser",
    terserOptions: {
      ecma: 5, // ES5 strict
      compress: {
        passes: 2,
        ecma: 5, // Importante: previene ottimizzazioni ES6+
        // Opzioni conservative per vecchi runtime
        arrows: false,
        collapse_vars: false,
      },
      mangle: {
        safari10: true,
      },
      format: {
        safari10: true,
        ecma: 5, // Forza ES5 nell'output
      },
    },
  },
});
