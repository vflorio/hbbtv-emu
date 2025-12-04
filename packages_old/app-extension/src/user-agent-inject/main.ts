// This script runs at document_start in MAIN world
// It overrides navigator.userAgent before any page scripts run

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (SmartTV; HbbTV/1.5.1 (+DL;Vendor/ModelName;0.0.1;0.0.1;) CE-HTML/1.0 NETRANGEMMH";

// Override navigator.userAgent
Object.defineProperty(navigator, "userAgent", {
  get: () => DEFAULT_USER_AGENT,
  configurable: true,
});

// Override navigator.appVersion
Object.defineProperty(navigator, "appVersion", {
  get: () => DEFAULT_USER_AGENT.replace("Mozilla/", ""),
  configurable: true,
});
