import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import type { OIPF } from "@hbb-emu/oipf";
import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime, type PlayerRuntimeConfig } from "@hbb-emu/player-runtime";
import { Overlay } from "@hbb-emu/player-ui";
import { createRuntimeEnv, type PlayerRuntimeFactory, runtime } from "@hbb-emu/runtime";
import { useEffect, useRef, useState } from "react";

/**
 * HbbTV Runtime Standalone
 */
export function App() {
  const [runtimeService, setRuntimeService] = useState<any>(null);
  const [playerRuntime, setPlayerRuntime] = useState<PlayerRuntime | null>(null);
  const [showPlayerUi, setShowPlayerUi] = useState(false);
  const objectRef = useRef<HTMLObjectElement & OIPF.AV.Control.AVControlObject>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    console.log("[Runtime] Initializing HbbTV Runtime...");

    // Create PlayerRuntime factory for AVControl objects
    const createPlayerRuntimeInstance = (): PlayerRuntime => {
      const config: PlayerRuntimeConfig = {
        adapters: {
          native: new NativeAdapter(),
          hls: new HLSAdapter(),
          dash: new DASHAdapter(),
        },
      };
      return new PlayerRuntime(config);
    };

    const playerRuntimeFactory: PlayerRuntimeFactory = {
      create: () => {
        console.log("[Factory] Creating new PlayerRuntime instance");
        return createPlayerRuntimeInstance();
      },
      destroy: (runtime: PlayerRuntime) => {
        console.log("[Factory] Destroying PlayerRuntime instance");
        runtime.destroy().catch(() => {});
      },
    };

    // Create a separate PlayerRuntime for the UI overlay
    const playerRuntime = createPlayerRuntimeInstance();
    setPlayerRuntime(playerRuntime);
    console.log("[PlayerRuntime] Created for UI overlay");

    // Setup runtime environment with player factory
    const env = createRuntimeEnv(
      DEFAULT_EXTENSION_STATE,
      playerRuntime, // shared player runtime
      playerRuntimeFactory, // factory for AVControl instances
    );

    // Create runtime service and start it
    const runtimeIO = runtime(env);
    const handle = runtimeIO();
    setRuntimeService(handle);

    // Start the runtime
    handle.stop(); // Chiamiamo stop per inizializzare
    console.log("[Runtime] Initialized", handle);

    return () => {
      console.log("[Runtime] Cleanup...");
      handle.stop();
      playerRuntime.destroy().catch(() => {});
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        backgroundColor: "#000",
      }}
    >
      {/* AVControl Object - il video player HbbTV */}
      <object
        ref={objectRef}
        type="application/oipfApplicationManager"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />

      {/* Overlay UI - Player controls */}
      {playerRuntime && showPlayerUi && <Overlay core={playerRuntime} videoRef={videoRef} />}

      {/* Hidden video element for UI overlay (separato da AVControl) */}
      <video
        ref={videoRef}
        style={{ display: "none" }}
        onPlay={() => setShowPlayerUi(true)}
        onPause={() => setShowPlayerUi(false)}
      />

      {/* Debug info */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          right: 10,
          color: "#fff",
          backgroundColor: "rgba(0,0,0,0.7)",
          padding: "8px 12px",
          fontSize: "12px",
          fontFamily: "monospace",
          borderRadius: "4px",
        }}
      >
        Runtime: {runtimeService ? "✓" : "✗"} | Player: {playerRuntime ? "✓" : "✗"}
      </div>
    </div>
  );
}
