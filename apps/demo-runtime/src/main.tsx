import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import type { OIPF } from "@hbb-emu/oipf";
import { createRuntimeEnv, type RuntimeHandle, runtime } from "@hbb-emu/runtime";
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [runtimeHandle, setRuntimeHandle] = useState<RuntimeHandle | null>(null);
  const objectRef = useRef<HTMLObjectElement & OIPF.AV.Control.AVControlObject>(null);

  useEffect(() => {
    console.log("[Runtime] Initializing HbbTV Runtime...");

    // Create runtime environment from default extension state
    const env = createRuntimeEnv(DEFAULT_EXTENSION_STATE);
    console.log("[Runtime] Environment created");

    // Start the runtime
    const handle = runtime(env)();
    setRuntimeHandle(handle);
    console.log("[Runtime] Runtime started successfully");

    return () => {
      console.log("[Runtime] Cleaning up runtime");
      handle.stop();
    };
  }, []);

  useEffect(() => {
    if (!objectRef.current || !runtimeHandle) return;

    const object = objectRef.current;

    console.log("[AV Object] Object created and attached to DOM");

    object.onPlayStateChange = (...args: unknown[]) => {
      console.log("[AV Object] PlayStateChange:", ...args);
    };

    setTimeout(() => {
      console.log("[AV Object] Calling play(1)...");
      object.play(1);
    }, 100);
  }, [runtimeHandle]);

  if (!runtimeHandle) return <div>Initializing HbbTV Runtime...</div>;

  return (
    <object
      ref={objectRef}
      type="application/dash+xml"
      data="https://d1x2qd46lfkzk0.cloudfront.net/daitest/multiaac2/index.mpd"
      aria-label="HbbTV A/V Control Object"
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
