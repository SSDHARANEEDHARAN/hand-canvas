import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ParticleField, ParticleFieldHandle } from "./ParticleField";
import { LandmarkOverlay } from "./LandmarkOverlay";
import { ManualControls } from "./ManualControls";
import { DrawTrail, DrawTrailHandle, ExportedStroke } from "./DrawTrail";
import { SettingsBar } from "./SettingsBar";
import { CalibrationOverlay } from "./CalibrationOverlay";
import { RecognizedTextEditor } from "./RecognizedTextEditor";
import { createHandTracker, EMPTY_STATE, HandState, HandTrackerHandle } from "@/lib/handTracker";
import { playBurstSound } from "@/lib/audio";
import { useGestureSettings } from "@/lib/gestureSettings";
import { smoothAll } from "@/lib/strokeSimplify";
import { exportTrailAsPNG, exportTrailAsSVG } from "@/lib/exportTrail";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Crosshair,
  Download,
  Eraser,
  Palette,
  Pencil,
  ScanText,
  Settings as SettingsIcon,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { applyTheme, getThemePreset, loadThemeId, saveThemeId, THEME_PRESETS } from "@/lib/themeSystem";
import { setAmbientThemeSound } from "@/lib/ambientAudio";

const CAM_W = 176;
const CAM_H = 128;
const PINCH_COOLDOWN_MS = 600;
const TEMPLATES = ["sphere", "heart", "flower", "saturn", "fireworks", "galaxy", "dna"] as const;

type Template = (typeof TEMPLATES)[number];

function strokesToPNG(strokes: ExportedStroke[], size = 720): string | null {
  if (strokes.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, -point.y);
      maxY = Math.max(maxY, -point.y);
    }
  }

  if (!Number.isFinite(minX)) return null;

  const width = Math.max(0.001, maxX - minX);
  const height = Math.max(0.001, maxY - minY);
  const scale = (size - 80) / Math.max(width, height);
  const offsetX = (size - width * scale) / 2 - minX * scale;
  const offsetY = (size - height * scale) / 2 - minY * scale;

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

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * scale + offsetX, -stroke.points[0].y * scale + offsetY);
    for (let i = 1; i < stroke.points.length; i += 1) {
      ctx.lineTo(stroke.points[i].x * scale + offsetX, -stroke.points[i].y * scale + offsetY);
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
  const [template, setTemplate] = useState<Template>("sphere");
  const [expansion, setExpansion] = useState(0.3);
  const [hue, setHue] = useState(0.75);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeId, setThemeId] = useState(() => loadThemeId());
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrError, setOcrError] = useState<string | undefined>();

  const lastSwitchRef = useRef(0);
  const lastPinchRef = useRef(0);
  const wasPinchingRef = useRef(false);
  const drawingRef = useRef(false);

  const displayedTheme = useMemo(() => getThemePreset(previewThemeId ?? themeId), [previewThemeId, themeId]);

  useEffect(() => {
    trackerRef.current?.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    applyTheme(displayedTheme);
    if (!previewThemeId) saveThemeId(displayedTheme.id);
    void setAmbientThemeSound(displayedTheme.soundHz, ambientEnabled);
  }, [displayedTheme, ambientEnabled, previewThemeId]);

  useEffect(() => {
    if (!themeMenuOpen) setPreviewThemeId(null);
  }, [themeMenuOpen]);

  useEffect(() => {
    if (!cameraEnabled) {
      setStatus("idle");
      setErrorMsg("");
      setCalibrating(false);
      setDrawMode(false);
      setState(EMPTY_STATE);
      return undefined;
    }

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
          const cameras = devices.filter((device) => device.kind === "videoinput");
          if (cameras.length === 0) throw Object.assign(new Error("No camera detected on this system."), { name: "NotFoundError" });
        } catch {
          // ignore pre-permission enumerate errors
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });

        localStream = stream;
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        trackerRef.current = await createHandTracker(
          video,
          (nextState) => {
            if (mounted) setState(nextState);
          },
          settings,
        );
        setStatus("ready");
        setManualMode(false);
      } catch (error) {
        const err = error as { name?: string; message?: string };
        let msg = err?.message || "Camera access failed";
        if (err?.name === "NotAllowedError") msg = "Camera permission denied. Allow access in your browser settings.";
        else if (err?.name === "NotFoundError") msg = "No camera device found.";
        else if (err?.name === "NotReadableError") msg = "Camera is in use by another app.";
        else if (err?.name === "OverconstrainedError") msg = "Camera doesn't support requested settings.";
        setErrorMsg(msg);
        setStatus("error");
      }
    })();

    return () => {
      mounted = false;
      trackerRef.current?.stop();
      trackerRef.current = null;
      const video = videoRef.current;
      const stream = (video?.srcObject as MediaStream | null) ?? localStream;
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [cameraEnabled, cameraAttempt]);

  const triggerBurst = useCallback((strength = 1) => {
    fieldRef.current?.burst(strength);
    playBurstSound(strength);
  }, []);

  const mapTipToScene = useCallback(
    (tipX: number, tipY: number, tipZ: number) => {
      const mirroredX = 1 - tipX;
      const { minX, maxX, minY, maxY } = settings.calibration;
      const nx = (mirroredX - minX) / Math.max(0.001, maxX - minX);
      const ny = (tipY - minY) / Math.max(0.001, maxY - minY);
      const cx = Math.max(0, Math.min(1, nx));
      const cy = Math.max(0, Math.min(1, ny));
      return {
        x: (cx - 0.5) * 8,
        y: (0.5 - cy) * 6,
        z: tipZ * -4,
      };
    },
    [settings.calibration],
  );

  useEffect(() => {
    if (!cameraEnabled || calibrating) return;

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

    const targetExpansion = state.hands >= 2 ? state.handDistance : 0.25;
    setExpansion((prev) => prev + (targetExpansion - prev) * 0.15);

    if (state.hands > 0) {
      const targetHue = 1 - state.avgY;
      setHue((prev) => prev + (targetHue - prev) * 0.1);
    }

    const now = performance.now();
    if (state.hands > 0 && now - lastSwitchRef.current > 700) {
      const nextTemplate = TEMPLATES[Math.max(0, Math.min(TEMPLATES.length - 1, state.fingerCount))];
      if (nextTemplate && nextTemplate !== template) {
        setTemplate(nextTemplate);
        lastSwitchRef.current = now;
      }
    }
  }, [cameraEnabled, calibrating, drawMode, hue, manualMode, mapTipToScene, state, template, triggerBurst]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const num = Number.parseInt(event.key, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= TEMPLATES.length) {
        setTemplate(TEMPLATES[num - 1]);
        setManualMode(true);
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        setExpansion((prev) => Math.max(0, Math.min(1, prev + (event.key === "ArrowUp" ? 0.05 : -0.05))));
        setManualMode(true);
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setHue((prev) => (prev + (event.key === "ArrowRight" ? 0.04 : -0.04) + 1) % 1);
        setManualMode(true);
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        triggerBurst(1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [triggerBurst]);

  const handleManualTemplate = (nextTemplate: Template) => {
    setTemplate(nextTemplate);
    setManualMode(true);
  };

  const handleManualExpansion = (value: number) => {
    setExpansion(value);
    setManualMode(true);
  };

  const handleManualHue = (value: number) => {
    setHue(value);
    setManualMode(true);
  };

  const handleClearAll = () => {
    trailRef.current?.clear();
    setOcrText("");
    setOcrError(undefined);
    setOcrOpen(false);
  };

  const handleSmoothStrokes = () => {
    const strokes = trailRef.current?.getStrokes() ?? [];
    if (strokes.length === 0) {
      toast.info("Nothing to smooth yet.");
      return;
    }
    trailRef.current?.replaceStrokes(smoothAll(strokes, 0.05, 8));
    toast.success("Strokes smoothed.");
  };

  const handleRecognize = async () => {
    const strokes = trailRef.current?.getStrokes() ?? [];
    if (strokes.length === 0) {
      toast.info("Draw something first.");
      return;
    }

    const imageDataUrl = strokesToPNG(strokes);
    if (!imageDataUrl) {
      toast.error("Could not prepare text recognition.");
      return;
    }

    setOcrOpen(true);
    setOcrLoading(true);
    setOcrText("");
    setOcrError(undefined);

    try {
      const { data, error } = await supabase.functions.invoke("recognize-handwriting", {
        body: { imageDataUrl },
      });
      if (error) throw error;

      const result = data as { text?: string; error?: string } | null;
      if (result?.error) {
        setOcrError(result.error);
      } else {
        setOcrText(result?.text || "(no text recognized)");
      }
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "Recognition failed");
    } finally {
      setOcrLoading(false);
    }
  };

  const startCalibration = () => {
    if (!cameraEnabled || status !== "ready") {
      toast.error("Turn camera on and wait until it is ready.");
      return;
    }
    setCalibrating(true);
  };

  const exportStrokes = (format: "png" | "svg") => {
    const strokes = trailRef.current?.getStrokes() ?? [];
    if (strokes.length === 0) {
      toast.info("Nothing to export yet.");
      return;
    }
    if (format === "png") exportTrailAsPNG(strokes);
    else exportTrailAsSVG(strokes);
  };

  const liveTip = useMemo(
    () => (state.smoothedTip ? { x: state.smoothedTip.x, y: state.smoothedTip.y } : null),
    [state.smoothedTip],
  );

  const cameraActionLabel = !cameraEnabled ? "Camera Off" : status === "loading" ? "Camera Loading" : status === "error" ? "Camera Error" : "Camera On";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <Canvas camera={{ position: [0, 0, 7], fov: 60 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}>
        <color attach="background" args={[`hsl(${displayedTheme.vars.background})`]} />
        <ambientLight intensity={0.4} />
        <ParticleField ref={fieldRef} template={template} expansion={expansion} hue={hue} />
        <DrawTrail ref={trailRef} />
      </Canvas>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 py-3 sm:px-4">
        <div className="pointer-events-auto mx-auto flex w-full max-w-7xl flex-col gap-3 rounded-lg border border-border/70 bg-background/88 px-3 py-3 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-md bg-primary/15 p-2 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Gesture Particles</div>
                <div className="truncate text-[11px] text-muted-foreground">All controls are inside this top bar</div>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={cameraEnabled ? "default" : "secondary"}
                className="gap-1.5"
                onClick={() => {
                  setCameraEnabled((prev) => !prev);
                  if (cameraEnabled) {
                    setDrawMode(false);
                    setCalibrating(false);
                  } else {
                    setCameraAttempt((prev) => prev + 1);
                  }
                }}
              >
                <Camera className="h-3.5 w-3.5" />
                {cameraActionLabel}
              </Button>

              <Button
                size="sm"
                variant={ambientEnabled ? "secondary" : "outline"}
                className="gap-1.5"
                onClick={() => setAmbientEnabled((prev) => !prev)}
              >
                {ambientEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                {ambientEnabled ? "Sound On" : "Sound Off"}
              </Button>

              <DropdownMenu open={themeMenuOpen} onOpenChange={setThemeMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary" className="gap-1.5">
                    <Palette className="h-3.5 w-3.5" />
                    Themes
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(420px,calc(100vw-2rem))] p-3">
                  <DropdownMenuLabel className="px-0">Preview themes</DropdownMenuLabel>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {THEME_PRESETS.map((theme) => {
                      const active = theme.id === themeId;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onPointerEnter={() => setPreviewThemeId(theme.id)}
                          onFocus={() => setPreviewThemeId(theme.id)}
                          onClick={() => {
                            setThemeId(theme.id);
                            setPreviewThemeId(null);
                            setThemeMenuOpen(false);
                          }}
                          className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-2 py-2 text-left text-xs transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                        >
                          <span className="flex items-center gap-1">
                            <span className="h-4 w-4 rounded-full border border-border/70" style={{ backgroundColor: `hsl(${theme.vars.primary})` }} />
                            <span className="h-4 w-4 rounded-full border border-border/70" style={{ backgroundColor: `hsl(${theme.vars.accent})` }} />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{theme.name}</span>
                          <span className="text-[10px] text-muted-foreground">{active ? "On" : "Try"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <DropdownMenuSeparator className="my-3" />
                  <div className="text-[11px] text-muted-foreground">Hover or focus a chip to audition it, then click to keep it.</div>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" variant="secondary" className="gap-1.5" onClick={startCalibration}>
                <Crosshair className="h-3.5 w-3.5" />
                Start Calibration
              </Button>

              <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" variant="secondary" className="gap-1.5">
                    <SettingsIcon className="h-3.5 w-3.5" />
                    Settings
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[min(560px,100vw)] overflow-y-auto border-border/70 bg-background/95">
                  <SheetHeader>
                    <SheetTitle>Gesture settings</SheetTitle>
                    <SheetDescription>Fine-tune pointing detection, smoothing, and tracking speed.</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <SettingsBar settings={settings} onChange={setSettings} />
                  </div>
                </SheetContent>
              </Sheet>
            </nav>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <ManualControls
              template={template}
              expansion={expansion}
              hue={hue}
              onTemplate={handleManualTemplate}
              onExpansion={handleManualExpansion}
              onHue={handleManualHue}
            />

            {cameraEnabled && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-background/75 p-3">
                <Button size="sm" variant={drawMode ? "default" : "secondary"} className="gap-1.5" onClick={() => setDrawMode((prev) => !prev)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {drawMode ? "Drawing" : "Draw"}
                </Button>
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={handleSmoothStrokes}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Smooth
                </Button>
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={handleRecognize}>
                  <ScanText className="h-3.5 w-3.5" />
                  To Text
                </Button>
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={handleClearAll}>
                  <Eraser className="h-3.5 w-3.5" />
                  Clear
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary" className="gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportStrokes("png")}>Download PNG</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportStrokes("svg")}>Download SVG</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </header>

      {cameraEnabled && (
        <div
          className="absolute bottom-4 right-4 overflow-hidden rounded-lg border border-border/70 shadow-2xl"
          style={{ width: status === "error" ? 240 : CAM_W, height: status === "error" ? 150 : CAM_H }}
        >
          <video ref={videoRef} playsInline muted className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-80" />
          <LandmarkOverlay landmarks={state.landmarks} width={CAM_W} height={CAM_H} className="pointer-events-none absolute inset-0 h-full w-full" />
          {state.pinching && (
            <div className="pointer-events-none absolute left-1 top-1 rounded bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              PINCH
            </div>
          )}
          {status === "loading" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 text-[10px] text-foreground/70">
              Camera…
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 p-2 text-center">
              <div className="text-[10px] leading-tight text-foreground/80">{errorMsg || "No camera"}</div>
              <Button size="sm" variant="secondary" className="h-6 px-2 text-[10px]" onClick={() => setCameraAttempt((prev) => prev + 1)}>
                Retry camera
              </Button>
            </div>
          )}
        </div>
      )}

      {drawMode && cameraEnabled && status === "ready" && !calibrating && (
        <div
          className={`pointer-events-none absolute left-1/2 top-[10.75rem] z-10 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-semibold shadow-lg transition-colors ${
            state.isPointing ? "bg-primary text-primary-foreground" : "bg-background/85 text-foreground backdrop-blur-md"
          }`}
        >
          {state.isPointing ? "Writing…" : "Point with index finger to write"}
        </div>
      )}

      {cameraEnabled && status === "error" && !calibrating && (
        <div className="absolute left-1/2 top-1/2 z-20 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/70 bg-background/95 p-4 text-xs text-foreground shadow-2xl backdrop-blur-md">
          <div className="mb-2 text-sm font-semibold">Camera setup</div>
          <div className="mb-3 text-[11px] text-muted-foreground">{errorMsg || "Camera unavailable"}</div>
          <ul className="space-y-1.5 text-[11px]">
            <li className="flex items-start gap-2"><span>{window.isSecureContext ? "✅" : "❌"}</span><span>Page is served over HTTPS</span></li>
            <li className="flex items-start gap-2"><span>🔒</span><span>Allow camera access in the browser</span></li>
            <li className="flex items-start gap-2"><span>📷</span><span>Close other apps using the camera</span></li>
            <li className="flex items-start gap-2"><span>🔄</span><span>Retry after permission is granted</span></li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setCameraAttempt((prev) => prev + 1)}>Retry camera</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStatus("idle")}>Dismiss</Button>
          </div>
        </div>
      )}

      {calibrating && (
        <CalibrationOverlay
          tip={liveTip}
          isPointing={state.isPointing}
          onCancel={() => setCalibrating(false)}
          onComplete={(rect) => {
            setSettings({ ...settings, calibration: rect });
            setCalibrating(false);
            toast.success("Calibration saved.");
          }}
        />
      )}

      <RecognizedTextEditor
        open={ocrOpen}
        loading={ocrLoading}
        initialText={ocrText}
        error={ocrError}
        onClose={() => setOcrOpen(false)}
        onCopy={(text) => {
          navigator.clipboard?.writeText(text).then(
            () => toast.success("Copied to clipboard."),
            () => toast.error("Copy failed."),
          );
        }}
      />
    </div>
  );
};
