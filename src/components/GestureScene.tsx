import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ParticleField, ParticleFieldHandle } from "./ParticleField";
import { LandmarkOverlay } from "./LandmarkOverlay";
import { ManualControls } from "./ManualControls";
import { DrawTrail, DrawTrailHandle, ExportedStroke } from "./DrawTrail";
import { SettingsBar } from "./SettingsBar";
import { CalibrationOverlay } from "./CalibrationOverlay";
import { RecognizedTextEditor } from "./RecognizedTextEditor";
import { TEMPLATE_ORDER, TemplateName } from "@/lib/templates";
import { createHandTracker, EMPTY_STATE, HandState, HandTrackerHandle } from "@/lib/handTracker";
import { playBurstSound } from "@/lib/audio";
import { useCanvasRecorder } from "@/hooks/useCanvasRecorder";
import { useGestureSettings } from "@/lib/gestureSettings";
import { smoothAll } from "@/lib/strokeSimplify";
import { Button } from "@/components/ui/button";
import { Circle, Square, Pencil, Eraser, Download, Sparkles, ScanText } from "lucide-react";
import { exportTrailAsPNG, exportTrailAsSVG } from "@/lib/exportTrail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CAM_W = 176;
const CAM_H = 128;
const PINCH_COOLDOWN_MS = 600;

// Render strokes to a PNG data URL for OCR
function strokesToPNG(strokes: ExportedStroke[], size = 720): string | null {
  if (strokes.length === 0) return null;
  // Find bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (-p.y < minY) minY = -p.y;
    if (-p.y > maxY) maxY = -p.y;
  }
  if (!isFinite(minX)) return null;
  const w = Math.max(0.001, maxX - minX);
  const h = Math.max(0.001, maxY - minY);
  const scale = (size - 80) / Math.max(w, h);
  const ox = (size - w * scale) / 2 - minX * scale;
  const oy = (size - h * scale) / 2 - minY * scale;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    if (s.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x * scale + ox, -s.points[0].y * scale + oy);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x * scale + ox, -s.points[i].y * scale + oy);
    }
    ctx.stroke();
  }
  return canvas.toDataURL("image/png");
}

export const GestureScene = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fieldRef = useRef<ParticleFieldHandle>(null);
  const trailRef = useRef<DrawTrailHandle>(null);
  const trackerRef = useRef<HandTrackerHandle | null>(null);
  const [settings, setSettings] = useGestureSettings();
  const [state, setState] = useState<HandState>(EMPTY_STATE);
  const [template, setTemplate] = useState<TemplateName>("sphere");
  const [expansion, setExpansion] = useState(0.3);
  const [hue, setHue] = useState(0.75);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [manualMode, setManualMode] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [drawMode, setDrawMode] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrError, setOcrError] = useState<string | undefined>();
  const lastSwitchRef = useRef(0);
  const lastPinchRef = useRef(0);
  const wasPinchingRef = useRef(false);
  const drawingRef = useRef(false);
  const recorder = useCanvasRecorder();

  // Push settings to tracker whenever they change
  useEffect(() => {
    trackerRef.current?.updateSettings(settings);
  }, [settings]);

  const triggerBurst = useCallback((strength = 1) => {
    fieldRef.current?.burst(strength);
    playBurstSound(strength);
  }, []);

  // Camera + tracking
  useEffect(() => {
    let mounted = true;
    let localStream: MediaStream | null = null;

    (async () => {
      setStatus("loading");
      setErrorMsg("");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia not supported in this browser");
        if (!window.isSecureContext) throw new Error("Camera requires HTTPS (secure context)");
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === "videoinput");
          if (cams.length === 0) throw Object.assign(new Error("No camera detected on this system."), { name: "NotFoundError" });
        } catch { /* enumerate may fail before permission */ }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        localStream = stream;
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const tracker = await createHandTracker(video, (s) => { if (mounted) setState(s); }, settings);
        trackerRef.current = tracker;
        setStatus("ready");
        setManualMode(false);
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string };
        let msg = err?.message || "Camera access failed";
        if (err?.name === "NotAllowedError") msg = "Camera permission denied. Allow access in your browser settings.";
        else if (err?.name === "NotFoundError") msg = "No camera device found.";
        else if (err?.name === "NotReadableError") msg = "Camera is in use by another app.";
        else if (err?.name === "OverconstrainedError") msg = "Camera doesn't support requested settings.";
        setErrorMsg(msg);
        setStatus("error");
        setManualMode(true);
      }
    })();

    return () => {
      mounted = false;
      trackerRef.current?.stop();
      trackerRef.current = null;
      const v = videoRef.current;
      const stream = (v?.srcObject as MediaStream | null) ?? localStream;
      stream?.getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraAttempt]);

  // Map smoothed fingertip from MediaPipe coords through calibration → 3D scene coords
  const mapTipToScene = useCallback((tipX: number, tipY: number, tipZ: number) => {
    // Mirror x to match flipped video
    const mx = 1 - tipX;
    const { minX, maxX, minY, maxY } = settings.calibration;
    const nx = (mx - minX) / Math.max(0.001, maxX - minX); // 0..1
    const ny = (tipY - minY) / Math.max(0.001, maxY - minY);
    const cx = Math.max(0, Math.min(1, nx));
    const cy = Math.max(0, Math.min(1, ny));
    const x = (cx - 0.5) * 8;
    const y = (0.5 - cy) * 6;
    const z = tipZ * -4;
    return { x, y, z };
  }, [settings.calibration]);

  // Drive controls + pinch detection from hand state
  useEffect(() => {
    // Skip world-control updates during calibration
    if (calibrating) return;

    if (state.pinching && !wasPinchingRef.current) {
      const now = performance.now();
      if (now - lastPinchRef.current > PINCH_COOLDOWN_MS) {
        lastPinchRef.current = now;
        if (drawMode) {
          trailRef.current?.endStroke();
          drawingRef.current = false;
        } else {
          triggerBurst(1);
        }
      }
    }
    wasPinchingRef.current = state.pinching;

    if (drawMode) {
      const tip = state.smoothedTip;
      if (tip && state.isPointing) {
        const { x, y, z } = mapTipToScene(tip.x, tip.y, tip.z);
        trailRef.current?.addPoint(x, y, z, hue);
        drawingRef.current = true;
      } else if (drawingRef.current) {
        trailRef.current?.endStroke();
        drawingRef.current = false;
      }
      return;
    }

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
  }, [state, template, manualMode, triggerBurst, drawMode, hue, calibrating, mapTipToScene]);

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
      if (e.key.toLowerCase() === "g" && status === "ready") setManualMode((m) => !m);
      if (e.key.toLowerCase() === "d") setDrawMode((d) => !d);
      if (e.key.toLowerCase() === "c") handleClearAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, triggerBurst]);

  const handleManualTemplate = (t: TemplateName) => { setTemplate(t); setManualMode(true); };
  const handleManualExpansion = (v: number) => { setExpansion(v); setManualMode(true); };
  const handleManualHue = (v: number) => { setHue(v); setManualMode(true); };

  const handleSmoothStrokes = () => {
    const strokes = trailRef.current?.getStrokes() ?? [];
    if (strokes.length === 0) {
      toast.info("Nothing to smooth — draw something first.");
      return;
    }
    const smoothed = smoothAll(strokes, 0.05, 8);
    trailRef.current?.replaceStrokes(smoothed);
    toast.success("Strokes smoothed");
  };

  const handleRecognize = async () => {
    const strokes = trailRef.current?.getStrokes() ?? [];
    if (strokes.length === 0) {
      toast.info("Draw something first.");
      return;
    }
    const dataUrl = strokesToPNG(strokes);
    if (!dataUrl) {
      toast.error("Could not render strokes.");
      return;
    }
    setOcrOpen(true);
    setOcrLoading(true);
    setOcrText("");
    setOcrError(undefined);
    try {
      const { data, error } = await supabase.functions.invoke("recognize-handwriting", {
        body: { imageDataUrl: dataUrl },
      });
      if (error) throw error;
      const text = (data as { text?: string; error?: string } | null)?.text ?? "";
      const errMsg = (data as { error?: string } | null)?.error;
      if (errMsg) {
        setOcrError(errMsg);
      } else {
        setOcrText(text || "(no text recognized)");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Recognition failed";
      setOcrError(msg);
    } finally {
      setOcrLoading(false);
    }
  };

  const liveTip = useMemo(
    () => (state.smoothedTip ? { x: state.smoothedTip.x, y: state.smoothedTip.y } : null),
    [state.smoothedTip]
  );

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
        <DrawTrail ref={trailRef} />
      </Canvas>

      <SettingsBar
        settings={settings}
        onChange={setSettings}
        onCalibrate={() => {
          if (status !== "ready") {
            toast.error("Camera must be ready to calibrate.");
            return;
          }
          setCalibrating(true);
        }}
      />

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
        className="absolute bottom-4 right-4 overflow-hidden rounded-lg border border-white/10 shadow-2xl"
        style={{ width: status === "error" ? 240 : CAM_W, height: status === "error" ? 150 : CAM_H }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-80"
        />
        <LandmarkOverlay
          landmarks={state.landmarks}
          width={CAM_W}
          height={CAM_H}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        {state.pinching && (
          <div className="pointer-events-none absolute left-1 top-1 rounded bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            PINCH
          </div>
        )}
        {status === "loading" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 text-[10px] text-white/70">
            Camera…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-2 text-center">
            <div className="text-[10px] leading-tight text-white/80">{errorMsg || "No camera"}</div>
            <Button size="sm" variant="secondary" className="h-6 px-2 text-[10px]" onClick={() => setCameraAttempt((n) => n + 1)}>
              Retry camera
            </Button>
          </div>
        )}
      </div>

      {/* Live pointing hint */}
      {drawMode && status === "ready" && !calibrating && (
        <div
          className={`pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-semibold shadow-lg transition-colors ${
            state.isPointing
              ? "bg-primary text-primary-foreground"
              : "bg-black/70 text-white/80 backdrop-blur-md"
          }`}
        >
          {state.isPointing ? "✍️ Writing…" : "👆 Point with your index finger to write"}
        </div>
      )}

      {/* Camera setup overlay (only when no calibration showing) */}
      {status === "error" && !calibrating && (
        <div className="absolute left-1/2 top-1/2 z-20 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-black/80 p-4 text-xs text-white/90 backdrop-blur-md shadow-2xl">
          <div className="mb-2 text-sm font-semibold">Camera setup</div>
          <div className="mb-3 text-[11px] text-white/70">{errorMsg || "Camera unavailable"}</div>
          <ul className="space-y-1.5 text-[11px]">
            <li className="flex items-start gap-2"><span>{window.isSecureContext ? "✅" : "❌"}</span><span>Page is served over HTTPS</span></li>
            <li className="flex items-start gap-2"><span>🔒</span><span>Click the camera icon in the address bar and allow access</span></li>
            <li className="flex items-start gap-2"><span>📷</span><span>Close other apps using the camera (Zoom, Meet, OBS…)</span></li>
            <li className="flex items-start gap-2"><span>🔄</span><span>After granting, click Retry below (or refresh the page)</span></li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setCameraAttempt((n) => n + 1)}>Retry camera</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStatus("idle")}>Dismiss</Button>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute left-4 top-4 space-y-1 rounded-lg bg-black/40 p-3 text-xs text-white/90 backdrop-blur-md">
        <div className="text-sm font-semibold">Gesture Particles</div>
        <div>Template: <span className="font-mono">{template}</span></div>
        <div>Hands: {state.hands} · Fingers: {state.fingerCount}</div>
        <div>Expansion: {expansion.toFixed(2)}</div>
        <div className="opacity-60">Mode: {manualMode ? "manual" : "gesture"}{drawMode ? " · draw" : ""}</div>
      </div>

      {/* Action buttons */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        <Button size="sm" variant={recorder.isRecording ? "destructive" : "secondary"} onClick={recorder.toggle} disabled={!recorder.supported} className="gap-1.5" data-testid="record-button">
          {recorder.isRecording ? <Square className="h-3 w-3 fill-current" /> : <Circle className="h-3 w-3 fill-current text-destructive" />}
          {recorder.isRecording ? "Stop" : "Record"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => triggerBurst(1)} data-testid="burst-button">💥 Burst</Button>
        <Button size="sm" variant={drawMode ? "default" : "secondary"} onClick={() => setDrawMode((d) => !d)} className="gap-1.5" data-testid="draw-button">
          <Pencil className="h-3 w-3" />
          {drawMode ? "Drawing" : "Draw"}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleSmoothStrokes} className="gap-1.5">
          <Sparkles className="h-3 w-3" /> Smooth
        </Button>
        <Button size="sm" variant="secondary" onClick={handleRecognize} className="gap-1.5">
          <ScanText className="h-3 w-3" /> To text
        </Button>
        <Button size="sm" variant="secondary" onClick={handleClearAll} className="gap-1.5" data-testid="clear-button">
          <Eraser className="h-3 w-3" /> Clear
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="gap-1.5" data-testid="export-button">
              <Download className="h-3 w-3" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { const s = trailRef.current?.getStrokes() ?? []; if (s.length === 0) return; exportTrailAsPNG(s); }}>Download PNG</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { const s = trailRef.current?.getStrokes() ?? []; if (s.length === 0) return; exportTrailAsSVG(s); }}>Download SVG</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs space-y-1 rounded-lg bg-black/40 p-3 text-[11px] text-white/80 backdrop-blur-md">
        <div className="font-semibold text-white">Controls</div>
        <div>👐 Two-hand distance → expansion</div>
        <div>✋ Finger count → template (0–6)</div>
        <div>🤏 Pinch (thumb + index) → burst / end stroke</div>
        <div>↕️ Hand height → color</div>
        <div>✏️ Draw: point with index finger to write</div>
        <div className="pt-1 opacity-70">Keys: 1–7 templates · ↑↓ expansion · ←→ color · Space burst · G manual · D draw · C clear</div>
      </div>

      {calibrating && (
        <CalibrationOverlay
          tip={liveTip}
          isPointing={state.isPointing}
          onCancel={() => setCalibrating(false)}
          onComplete={(rect) => {
            setSettings({ ...settings, calibration: rect });
            setCalibrating(false);
            toast.success("Calibration saved");
          }}
        />
      )}

      <RecognizedTextEditor
        open={ocrOpen}
        loading={ocrLoading}
        initialText={ocrText}
        error={ocrError}
        onClose={() => setOcrOpen(false)}
        onCopy={(t) => {
          navigator.clipboard?.writeText(t).then(
            () => toast.success("Copied to clipboard"),
            () => toast.error("Copy failed")
          );
        }}
      />
    </div>
  );
};
