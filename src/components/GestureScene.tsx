import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useCallback, useEffect, useRef, useState } from "react";
import { ParticleField, ParticleFieldHandle } from "./ParticleField";
import { LandmarkOverlay } from "./LandmarkOverlay";
import { ManualControls } from "./ManualControls";
import { TEMPLATE_ORDER, TemplateName } from "@/lib/templates";
import { createHandTracker, EMPTY_STATE, HandState } from "@/lib/handTracker";
import { playBurstSound } from "@/lib/audio";
import { useCanvasRecorder } from "@/hooks/useCanvasRecorder";
import { Button } from "@/components/ui/button";
import { Circle, Square } from "lucide-react";

const CAM_W = 176;
const CAM_H = 128;
const PINCH_COOLDOWN_MS = 600;

export const GestureScene = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fieldRef = useRef<ParticleFieldHandle>(null);
  const [state, setState] = useState<HandState>(EMPTY_STATE);
  const [template, setTemplate] = useState<TemplateName>("sphere");
  const [expansion, setExpansion] = useState(0.3);
  const [hue, setHue] = useState(0.75);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [, setErrorMsg] = useState<string>("");
  const [manualMode, setManualMode] = useState(false);
  const [flash, setFlash] = useState(0); // burst flash 0..1
  const lastSwitchRef = useRef(0);
  const lastPinchRef = useRef(0);
  const wasPinchingRef = useRef(false);
  const recorder = useCanvasRecorder();

  const triggerBurst = useCallback((strength = 1) => {
    fieldRef.current?.burst(strength);
    playBurstSound(strength);
    setFlash(1);
  }, []);

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

  // Drive controls + pinch detection from hand state
  useEffect(() => {
    // Pinch edge-trigger always (even in manual mode)
    if (state.pinching && !wasPinchingRef.current) {
      const now = performance.now();
      if (now - lastPinchRef.current > PINCH_COOLDOWN_MS) {
        lastPinchRef.current = now;
        triggerBurst(1);
      }
    }
    wasPinchingRef.current = state.pinching;

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
  }, [state, template, manualMode, triggerBurst]);

  // Decay burst flash
  useEffect(() => {
    if (flash <= 0) return;
    const id = setInterval(() => {
      setFlash((f) => {
        const next = f - 0.08;
        if (next <= 0) {
          clearInterval(id);
          return 0;
        }
        return next;
      });
    }, 30);
    return () => clearInterval(id);
  }, [flash]);

  // Keyboard fallback
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
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
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        triggerBurst(1);
      }
      if (e.key.toLowerCase() === "g" && status === "ready") {
        setManualMode((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, triggerBurst]);

  const handleManualTemplate = (t: TemplateName) => { setTemplate(t); setManualMode(true); };
  const handleManualExpansion = (v: number) => { setExpansion(v); setManualMode(true); };
  const handleManualHue = (v: number) => { setHue(v); setManualMode(true); };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 60 }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={["#06060f"]} />
        <ambientLight intensity={0.4} />
        <ParticleField ref={fieldRef} template={template} expansion={expansion} hue={hue} />
        <EffectComposer>
          <Bloom intensity={1.2} luminanceThreshold={0.05} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      </Canvas>

      {/* Burst flash overlay */}
      {flash > 0 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at center, hsl(${Math.round(hue * 360)} 90% 60% / ${flash * 0.35}) 0%, transparent 60%)`,
          }}
        />
      )}

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
        {state.pinching && (
          <div className="absolute left-1 top-1 rounded bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            PINCH
          </div>
        )}
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

      {/* Action buttons */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        <Button
          size="sm"
          variant={recorder.isRecording ? "destructive" : "secondary"}
          onClick={recorder.toggle}
          disabled={!recorder.supported}
          className="gap-1.5"
          data-testid="record-button"
        >
          {recorder.isRecording ? <Square className="h-3 w-3 fill-current" /> : <Circle className="h-3 w-3 fill-current text-destructive" />}
          {recorder.isRecording ? "Stop" : "Record"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => triggerBurst(1)}
          data-testid="burst-button"
        >
          💥 Burst
        </Button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs space-y-1 rounded-lg bg-black/40 p-3 text-[11px] text-white/80 backdrop-blur-md">
        <div className="font-semibold text-white">Controls</div>
        <div>👐 Two-hand distance → expansion</div>
        <div>✋ Finger count → template (0–6)</div>
        <div>🤏 Pinch (thumb + index) → burst</div>
        <div>↕️ Hand height → color</div>
        <div className="pt-1 opacity-70">Keys: 1–7 templates · ↑↓ expansion · ←→ color · Space burst · G toggle</div>
      </div>
    </div>
  );
};
