import { createRoot } from "react-dom/client";
import { App } from "./App";

console.log("[HbbTV Runtime] Initializing standalone runtime...");

// Crea container con posizione assoluta e z-index alto
const containerId = "hbbtv-runtime-container";
let container = document.getElementById(containerId)!;

if (!container) {
  container = document.createElement("div");
  container.id = containerId;
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.zIndex = "999999";
  container.style.pointerEvents = "auto";

  // Aggiunge al body appena disponibile
  if (document.body) {
    document.body.appendChild(container);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.body.appendChild(container);
    });
  }
}

// Avvia React app
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const root = createRoot(container!);
    root.render(<App />);
    console.log("[HbbTV Runtime] Mounted");
  });
} else {
  const root = createRoot(container);
  root.render(<App />);
  console.log("[HbbTV Runtime] Mounted");
}
