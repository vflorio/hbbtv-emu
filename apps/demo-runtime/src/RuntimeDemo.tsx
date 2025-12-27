import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import type { OIPF } from "@hbb-emu/oipf";
import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime, type PlayerRuntimeConfig } from "@hbb-emu/player-runtime";
import { Overlay } from "@hbb-emu/player-ui";
import { createRuntimeEnv, type PlayerRuntimeFactory, type RuntimeHandle, runtime } from "@hbb-emu/runtime";
import { useEffect, useRef, useState } from "react";

/**
 * Demo del runtime HbbTV con AVControl Object e Player UI
 */
export function RuntimeDemo() {
  const [runtimeHandle, setRuntimeHandle] = useState<RuntimeHandle | null>(null);
  const [playerRuntime, setPlayerRuntime] = useState<PlayerRuntime | null>(null);
  const [showPlayerUi, setShowPlayerUi] = useState(false);
  const objectRef = useRef<HTMLObjectElement & OIPF.AV.Control.AVControlObject>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [test] = useState(true);

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
    // This is independent from the AVControlObject's internal player
    const playerRuntime = createPlayerRuntimeInstance();
    setPlayerRuntime(playerRuntime);
    console.log("[PlayerRuntime] Created for UI overlay");

    // Create runtime environment with the factory
    const env = createRuntimeEnv(DEFAULT_EXTENSION_STATE, undefined, playerRuntimeFactory);
    console.log("[Runtime] Environment created");

    // Start the runtime
    const handle = runtime(env)();
    setRuntimeHandle(handle);
    console.log("[Runtime] Runtime started successfully");

    // Read player UI visibility from extension state
    setShowPlayerUi(DEFAULT_EXTENSION_STATE.playerUiVisible);

    return () => {
      console.log("[Runtime] Cleaning up runtime");
      handle.stop();
      if (playerRuntime) {
        playerRuntime.destroy().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!objectRef.current || !runtimeHandle || !playerRuntime) return;

    const object = objectRef.current;

    console.log("[AV Object] Object created and attached to DOM");

    // Mount player runtime to the video element created by the object
    // Note: This is a simplified integration. In production, you'd need to
    // coordinate between the AVControlObject's internal player and the overlay.
    const videoElement = object.querySelector("video");
    if (videoElement) {
      playerRuntime.mount(videoElement as HTMLVideoElement)();
      console.log("[PlayerRuntime] Mounted to video element");
    }

    object.onPlayStateChange = (...args: unknown[]) => {
      console.log("[AV Object] PlayStateChange:", ...args);
    };

    setTimeout(() => {
      console.log("[AV Object] Calling play(1)...");
      object.play(1);
    }, 100);
  }, [runtimeHandle, playerRuntime]);

  if (!runtimeHandle) return <div>Initializing HbbTV Runtime...</div>;

  if (!test) return null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <object
        ref={objectRef}
        type="application/dash+xml"
        data="https://d1x2qd46lfkzk0.cloudfront.net/daitest/multiaac2/index.mpd"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Player UI Overlay - conditionally rendered based on ExtensionState */}
      {showPlayerUi && playerRuntime && <Overlay core={playerRuntime} videoRef={videoRef} />}
    </div>
  );
}
