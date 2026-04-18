import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { ParticleField } from "./ParticleField";
import { LandmarkOverlay } from "./LandmarkOverlay";
import { ManualControls } from "./ManualControls";
import { TEMPLATE_ORDER, TemplateName } from "@/lib/templates";
import { createHandTracker, EMPTY_STATE, HandState } from "@/lib/handTracker";

const CAM_W = 176;
const CAM_H = 128;

export const GestureScene = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<HandState>(EMPTY_STATE);
  const [template, setTemplate] = useState<TemplateName>("sphere");
  const [expansion, setExpansion] = useState(0.3);
  const [hue, setHue] = useState(0.75);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [manualMode, setManualMode] = useState(false);
  const lastSwitchRef = useRef(0);

  // Camera + tracking
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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Camera access denied";
        setErrorMsg(msg);
        setStatus("error");
        setManualMode(true);
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

  // Drive controls from hand state (skip while manual)
  useEffect(() => {
    if (manualMode) return;
    const targetExp = state.hands >= 2 ? state.handDistance : 0.25;
    setExpansion((p) => p + (targetExp - p) * 0.15);

    if (state.hands > 0) {
      const targetHue = 1 - state.avgY;
      setHue((p) => p + (targetHue - p) * 0.1);
    }

    const now = performance.now();
    if (state.hands > 0 && now - lastSwitchRef.current > 700) {
      const idx = Math.max(0, Math.min(TEMPLATE_ORDER.length - 1, state.fingerCount));
      const next = TEMPLATE_ORDER[idx];
      if (next && next !== template) {
        setTemplate(next);
        lastSwitchRef.current = now;
      }
    }
  }, [state, template, manualMode]);

  // Keyboard fallback
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Number keys 1-7 → template
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= TEMPLATE_ORDER.length) {
        setTemplate(TEMPLATE_ORDER[num - 1]);
        setManualMode(true);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setExpansion((p) => Math.max(0, Math.min(1, p + (e.key === "ArrowUp" ? 0.05 : -0.05))));
        setManualMode(true);
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setHue((p) => (p + (e.key === "ArrowRight" ? 0.04 : -0.04) + 1) % 1);
        setManualMode(true);
      }
      if (e.key.toLowerCase() === "g") {
        // Toggle back to gesture mode if camera is ready
        if (status === "ready") setManualMode((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status]);

  const handleManualTemplate = (t: TemplateName) => {
    setTemplate(t);
    setManualMode(true);
  };
  const handleManualExpansion = (v: number) => {
    setExpansion(v);
    setManualMode(true);
  };
  const handleManualHue = (v: number) => {
    setHue(v);
    setManualMode(true);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <Canvas camera={{ position: [0, 0, 7], fov: 60 }} dpr={[1, 2]}>
        <color attach="background" args={["#06060f"]} />
        <ambientLight intensity={0.4} />
        <ParticleField template={template} expansion={expansion} hue={hue} />
      </Canvas>

      <ManualControls
        template={template}
        expansion={expansion}
        hue={hue}
        onTemplate={handleManualTemplate}
        onExpansion={handleManualExpansion}
        onHue={handleManualHue}
      />

      {/* Camera preview + landmark overlay */}
      <div
        className="pointer-events-none absolute bottom-4 right-4 overflow-hidden rounded-lg border border-white/10 shadow-2xl"
        style={{ width: CAM_W, height: CAM_H }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-80"
        />
        <LandmarkOverlay
          landmarks={state.landmarks}
          width={CAM_W}
          height={CAM_H}
          className="absolute inset-0 h-full w-full"
        />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-[10px] text-white/70">
            {status === "loading" ? "Camera…" : "No camera"}
          </div>
        )}
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute left-4 top-4 space-y-1 rounded-lg bg-black/40 p-3 text-xs text-white/90 backdrop-blur-md">
        <div className="text-sm font-semibold">Gesture Particles</div>
        <div>Template: <span className="font-mono">{template}</span></div>
        <div>Hands: {state.hands} · Fingers: {state.fingerCount}</div>
        <div>Expansion: {expansion.toFixed(2)}</div>
        <div className="opacity-60">Mode: {manualMode ? "manual" : "gesture"}</div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs space-y-1 rounded-lg bg-black/40 p-3 text-[11px] text-white/80 backdrop-blur-md">
        <div className="font-semibold text-white">Controls</div>
        <div>👐 Two-hand distance → expansion</div>
        <div>✋ Finger count → template (0–6)</div>
        <div>↕️ Hand height → color</div>
        <div className="pt-1 opacity-70">Keyboard: 1–7 templates · ↑↓ expansion · ←→ color · G toggle gesture</div>
      </div>
    </div>
  );
};
