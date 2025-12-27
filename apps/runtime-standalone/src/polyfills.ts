/**
 * Polyfills per Webkit r152340 (Tizen 2.4)
 */

// Importa Symbol PRIMA di tutto - è fondamentale per React
import "core-js/es/symbol";
import "core-js/es/symbol/iterator";

// Poi importa tutti gli altri polyfill stabili
import "core-js/stable";

// Regenerator runtime per async/await e generators
import "regenerator-runtime/runtime";

console.log("[Polyfills] Loaded for ES5 compatibility");
console.log("[Polyfills] Symbol available:", typeof Symbol !== "undefined");
