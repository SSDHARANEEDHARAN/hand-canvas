import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ParticleField, ParticleFieldHandle } from "./ParticleField";
import { LandmarkOverlay } from "./LandmarkOverlay";
import { ManualControls } from "./ManualControls";
import { DrawTrail, DrawTrailHandle } from "./DrawTrail";
import { SettingsBar } from "./SettingsBar";
import { CalibrationOverlay } from "./CalibrationOverlay";
import { createHandTracker, EMPTY_STATE, HandState, HandTrackerHandle } from "@/lib/handTracker";
import { playBurstSound } from "@/lib/audio";
import { useCanvasRecorder } from "@/hooks/useCanvasRecorder";
import { useGestureSettings } from "@/lib/gestureSettings";
import { Button } from "@/components/ui/button";
import { Circle, Menu, Settings as SettingsIcon, Square, Sparkles, Camera, Palette, Crosshair } from "lucide-react";
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
import { applyTheme, getThemePreset, loadThemeId, saveThemeId, THEME_PRESETS } from "@/lib/themeSystem";
import { setAmbientThemeSound } from "@/lib/ambientAudio";

const CAM_W = 176;
const CAM_H = 128;
const PINCH_COOLDOWN_MS = 600;

export const GestureScene = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fieldRef = useRef<ParticleFieldHandle>(null);
  const trailRef = useRef<DrawTrailHandle>(null);
  const trackerRef = useRef<HandTrackerHandle | null>(null);
  const [settings, setSettings] = useGestureSettings();
  const [state, setState] = useState<HandState>(EMPTY_STATE);
  const [template, setTemplate] = useState<"heart" | "flower" | "saturn" | "fireworks" | "galaxy" | "dna" | "sphere">("sphere");
  const [expansion, setExpansion] = useState(0.3);
  const [hue, setHue] = useState(0.75);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [manualMode, setManualMode] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState(() => loadThemeId());
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const lastSwitchRef = useRef(0);
  const lastPinchRef = useRef(0);
  const wasPinchingRef = useRef(false);
  const recorder = useCanvasRecorder();

  const activeTheme = useMemo(() => getThemePreset(themeId), [themeId]);

  useEffect(() => {
    trackerRef.current?.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    applyTheme(activeTheme);
    saveThemeId(activeTheme.id);
    void setAmbientThemeSound(activeTheme.soundHz, ambientEnabled);
  }, [activeTheme, ambientEnabled]);

  useEffect(() => () => {
    void setAmbientThemeSound(activeTheme.soundHz, false);
  }, [activeTheme.soundHz]);

  const triggerBurst = useCallback((strength = 1) => {
    fieldRef.current?.burst(strength);
    playBurstSound(strength);
  }, []);

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
        } catch {
          // ignore enumerate issues before permission
        }
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
        const tracker = await createHandTracker(video, (s) => {
          if (mounted) setState(s);
        }, settings);
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
  }, [cameraAttempt]);



  useEffect(() => {
    if (calibrating) return;

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
      const templates = ["sphere", "heart", "flower", "saturn", "fireworks", "galaxy", "dna"] as const;
      const idx = Math.max(0, Math.min(templates.length - 1, state.fingerCount));
      const next = templates[idx];
      if (next && next !== template) {
        setTemplate(next);
        lastSwitchRef.current = now;
      }
    }

  }, [state, template, manualMode, triggerBurst, hue, calibrating]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const templates = ["sphere", "heart", "flower", "saturn", "fireworks", "galaxy", "dna"] as const;
      const num = parseInt(e.key, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= templates.length) {
        setTemplate(templates[num - 1]);
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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, triggerBurst]);

  const handleManualTemplate = (nextTemplate: typeof template) => {
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

  const liveTip = useMemo(
    () => (state.smoothedTip ? { x: state.smoothedTip.x, y: state.smoothedTip.y } : null),
    [state.smoothedTip],
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 60 }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={[`hsl(${activeTheme.vars.background})`]} />
        <ambientLight intensity={0.4} />
        <ParticleField ref={fieldRef} template={template} expansion={expansion} hue={hue} />
        <DrawTrail ref={trailRef} />
      </Canvas>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 py-3 sm:px-4">
        <div className="pointer-events-auto mx-auto flex w-full max-w-7xl items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/85 px-3 py-2 shadow-2xl backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-md bg-primary/15 p-2 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Gesture Particles</div>
              <div className="truncate text-[11px] text-muted-foreground">
                Camera, themes, calibration, and settings in one place
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <Button
              size="sm"
              variant={status === "ready" ? "secondary" : "destructive"}
              className="gap-1.5"
              onClick={() => setCameraAttempt((n) => n + 1)}
            >
              <Camera className="h-3.5 w-3.5" />
              {status === "ready" ? "Camera" : "Retry camera"}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="gap-1.5">
                  <Palette className="h-3.5 w-3.5" />
                  Themes
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Theme styles</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {THEME_PRESETS.map((theme) => (
                  <DropdownMenuItem
                    key={theme.id}
                    onClick={() => setThemeId(theme.id)}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{theme.name}</span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-full border border-border"
                        style={{ backgroundColor: `hsl(${theme.vars.primary})` }}
                      />
                      {theme.id === activeTheme.id ? "Active" : ""}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAmbientEnabled((v) => !v)}>
                  Ambient sound: {ambientEnabled ? "On" : "Off"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={() => {
                if (status !== "ready") {
                  toast.error("Camera must be ready to calibrate.");
                  return;
                }
                setCalibrating(true);
              }}
            >
              <Crosshair className="h-3.5 w-3.5" />
              Calibration
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
                  <SheetDescription>Fine-tune which fingers count as pointing and how stable tracking feels.</SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <SettingsBar settings={settings} onChange={setSettings} />
                </div>
              </SheetContent>
            </Sheet>
          </nav>

          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="secondary" aria-label="Open navigation">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={() => setCameraAttempt((n) => n + 1)}>
                  {status === "ready" ? "Camera" : "Retry camera"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (status !== "ready") {
                      toast.error("Camera must be ready to calibrate.");
                      return;
                    }
                    setCalibrating(true);
                  }}
                >
                  Calibration
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Themes</DropdownMenuLabel>
                {THEME_PRESETS.map((theme) => (
                  <DropdownMenuItem key={theme.id} onClick={() => setThemeId(theme.id)}>
                    {theme.name}{theme.id === activeTheme.id ? " · Active" : ""}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAmbientEnabled((v) => !v)}>
                  Ambient sound: {ambientEnabled ? "On" : "Off"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 px-3 sm:px-4">
        <div className="pointer-events-auto mx-auto w-full max-w-3xl">
          <ManualControls
          template={template}
          expansion={expansion}
          hue={hue}
          onTemplate={handleManualTemplate}
          onExpansion={handleManualExpansion}
          onHue={handleManualHue}
          />
        </div>
      </div>

      <div
        className="absolute bottom-4 right-4 overflow-hidden rounded-lg border border-border/70 shadow-2xl"
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
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 text-[10px] text-foreground/70">
            Camera…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 p-2 text-center">
            <div className="text-[10px] leading-tight text-foreground/80">{errorMsg || "No camera"}</div>
            <Button size="sm" variant="secondary" className="h-6 px-2 text-[10px]" onClick={() => setCameraAttempt((n) => n + 1)}>
              Retry camera
            </Button>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute left-4 top-24 space-y-1 rounded-lg border border-border/70 bg-background/70 p-3 text-xs text-foreground shadow-lg backdrop-blur-md">
        <div className="text-sm font-semibold">Live status</div>
        <div>Theme: <span className="font-mono">{activeTheme.name}</span></div>
        <div>Template: <span className="font-mono">{template}</span></div>
        <div>Hands: {state.hands} · Fingers: {state.fingerCount}</div>
        <div>Expansion: {expansion.toFixed(2)}</div>
        <div className="text-muted-foreground">Mode: {manualMode ? "manual" : "gesture"}</div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs space-y-1 rounded-lg border border-border/70 bg-background/70 p-3 text-[11px] text-foreground/80 shadow-lg backdrop-blur-md">
        <div className="font-semibold text-foreground">Controls</div>
        <div>👐 Two-hand distance → expansion</div>
        <div>✋ Finger count → template</div>
        <div>🤏 Pinch → burst</div>
        <div>↕️ Hand height → color</div>
        <div className="pt-1 text-muted-foreground">Keys: 1–7 templates · ↑↓ expansion · ←→ color · Space burst · G manual</div>
      </div>

      {status === "error" && !calibrating && (
        <div className="absolute left-1/2 top-1/2 z-20 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/70 bg-background/95 p-4 text-xs text-foreground shadow-2xl backdrop-blur-md">
          <div className="mb-2 text-sm font-semibold">Camera setup</div>
          <div className="mb-3 text-[11px] text-muted-foreground">{errorMsg || "Camera unavailable"}</div>
          <ul className="space-y-1.5 text-[11px]">
            <li className="flex items-start gap-2"><span>{window.isSecureContext ? "✅" : "❌"}</span><span>Page is served over HTTPS</span></li>
            <li className="flex items-start gap-2"><span>🔒</span><span>Click the camera icon in the address bar and allow access</span></li>
            <li className="flex items-start gap-2"><span>📷</span><span>Close other apps using the camera</span></li>
            <li className="flex items-start gap-2"><span>🔄</span><span>After granting, click Retry below or refresh the page</span></li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setCameraAttempt((n) => n + 1)}>Retry camera</Button>
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
            toast.success("Calibration saved");
          }}
        />
      )}
    </div>
  );
};
