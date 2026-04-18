import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { ParticleField } from "./ParticleField";
import { TEMPLATE_ORDER, TemplateName } from "@/lib/templates";
import { createHandTracker, EMPTY_STATE, HandState } from "@/lib/handTracker";

export const GestureScene = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<HandState>(EMPTY_STATE);
  const [template, setTemplate] = useState<TemplateName>("sphere");
  const [expansion, setExpansion] = useState(0.3);
  const [hue, setHue] = useState(0.75);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const lastSwitchRef = useRef(0);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;

    (async () => {
      setStatus("loading");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        cleanup = await createHandTracker(video, (s) => {
          if (mounted) setState(s);
        });
        setStatus("ready");
      } catch (e: any) {
        setErrorMsg(e?.message ?? "Camera access denied");
        setStatus("error");
      }
    })();

    return () => {
      mounted = false;
      cleanup?.();
      const v = videoRef.current;
      const stream = v?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Drive controls from hand state
  useEffect(() => {
    // Expansion: two-hand distance, smoothed
    const targetExp = state.hands >= 2 ? state.handDistance : 0.25;
    setExpansion((p) => p + (targetExp - p) * 0.15);

    // Hue: hand height (top = warm, bottom = cool)
    if (state.hands > 0) {
      const targetHue = 1 - state.avgY; // 0..1
      setHue((p) => p + (targetHue - p) * 0.1);
    }

    // Template: finger count of primary hand (1..5 maps to first 5 templates;
    // 0 fingers + 2 hands cycles to remaining)
    const now = performance.now();
    if (state.hands > 0 && now - lastSwitchRef.current > 700) {
      const idx = Math.max(0, Math.min(TEMPLATE_ORDER.length - 1, state.fingerCount));
      const next = TEMPLATE_ORDER[idx];
      if (next && next !== template) {
        setTemplate(next);
        lastSwitchRef.current = now;
      }
    }
  }, [state, template]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <Canvas camera={{ position: [0, 0, 7], fov: 60 }} dpr={[1, 2]}>
        <color attach="background" args={["#06060f"]} />
        <ambientLight intensity={0.4} />
        <ParticleField template={template} expansion={expansion} hue={hue} />
      </Canvas>

      {/* Camera preview */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="pointer-events-none absolute bottom-4 right-4 h-32 w-44 -scale-x-100 rounded-lg border border-white/10 object-cover opacity-80 shadow-2xl"
      />

      {/* HUD */}
      <div className="pointer-events-none absolute left-4 top-4 space-y-1 rounded-lg bg-black/40 p-3 text-xs text-white/90 backdrop-blur-md">
        <div className="text-sm font-semibold">Gesture Particles</div>
        <div>Template: <span className="font-mono">{template}</span></div>
        <div>Hands: {state.hands} · Fingers: {state.fingerCount}</div>
        <div>Expansion: {expansion.toFixed(2)}</div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs rounded-lg bg-black/40 p-3 text-xs text-white/80 backdrop-blur-md">
        <div className="mb-1 font-semibold text-white">Gestures</div>
        <div>👐 Two-hand distance → expansion</div>
        <div>✋ Finger count → switch template (0–6)</div>
        <div>↕️ Hand height → color</div>
      </div>

      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center text-white">
          <div className="max-w-md space-y-2 p-6">
            {status === "loading" && <div>Requesting camera…</div>}
            {status === "error" && (
              <>
                <div className="text-lg font-semibold">Camera unavailable</div>
                <div className="text-sm text-white/70">{errorMsg}</div>
                <div className="text-xs text-white/50">
                  Allow camera access and reload to enable hand tracking.
                </div>
              </>
            )}
            {status === "idle" && <div>Initializing…</div>}
          </div>
        </div>
      )}
    </div>
  );
};
