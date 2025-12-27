/**
 * Entry point principale - garantisce che i polyfill vengano caricati PRIMA di tutto
 */

// DEVE essere il primo import assoluto - non spostare!
import "./polyfills";

// Dopo i polyfill, importa il resto dell'applicazione
import "./index";
