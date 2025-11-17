import { inject } from "@hbb-emu/hbbtv-api";

function injectAPIs(fn: () => void) {
  const script = document.createElement("script");
  script.textContent = `(${fn.toString()})();`;
  document.documentElement.appendChild(script);
  script.remove();
}

// Run injection on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => injectAPIs(inject));
} else {
  injectAPIs(inject);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "INJECT_HBBTV") {
    injectAPIs(inject);
    sendResponse({ success: true });
  }
});
