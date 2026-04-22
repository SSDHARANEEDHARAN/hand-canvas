import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CalibrationRect } from "@/lib/gestureSettings";

interface Props {
  // Current smoothed fingertip in MediaPipe coords (raw, not mirrored)
  tip: { x: number; y: number } | null;
  isPointing: boolean;
  onComplete: (rect: CalibrationRect) => void;
  onCancel: () => void;
}

const CORNERS = [
  { id: "tl", label: "Top-left", x: 0.1, y: 0.1 },
  { id: "tr", label: "Top-right", x: 0.9, y: 0.1 },
  { id: "br", label: "Bottom-right", x: 0.9, y: 0.9 },
  { id: "bl", label: "Bottom-left", x: 0.1, y: 0.9 },
] as const;

const HOLD_MS = 1200;

export const CalibrationOverlay = ({ tip, isPointing, onComplete, onCancel }: Props) => {
  const [step, setStep] = useState(0);
  // Captured tip positions in MIRRORED MP coords (so the overlay matches the camera preview)
  const captures = useRef<{ x: number; y: number }[]>([]);
  const holdStartRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!tip || !isPointing) {
      holdStartRef.current = null;
      setProgress(0);
      return;
    }
    if (holdStartRef.current == null) holdStartRef.current = performance.now();
    const id = setInterval(() => {
      if (holdStartRef.current == null) return;
      const elapsed = performance.now() - holdStartRef.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        // Mirror x to match the visual overlay
        const mirroredX = 1 - tip.x;
        captures.current.push({ x: mirroredX, y: tip.y });
        holdStartRef.current = null;
        setProgress(0);
        const next = step + 1;
        if (next >= CORNERS.length) {
          const xs = captures.current.map((c) => c.x);
          const ys = captures.current.map((c) => c.y);
          const rect: CalibrationRect = {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
          };
          // Sanity: ensure non-degenerate rect
          if (rect.maxX - rect.minX < 0.05) rect.maxX = rect.minX + 0.05;
          if (rect.maxY - rect.minY < 0.05) rect.maxY = rect.minY + 0.05;
          onComplete(rect);
        } else {
          setStep(next);
        }
      }
    }, 30);
    return () => clearInterval(id);
  }, [tip, isPointing, step, onComplete]);

  const target = CORNERS[step];

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-center text-sm text-white shadow-xl">
        <div className="font-semibold">Calibration {step + 1} / {CORNERS.length}</div>
        <div className="text-xs opacity-80">
          Make the pointing gesture and hold your fingertip on the <b>{target.label}</b> dot
        </div>
      </div>

      {/* The 4 target dots */}
      {CORNERS.map((c, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div
            key={c.id}
            className="absolute"
            style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, transform: "translate(-50%, -50%)" }}
          >
            <div
              className={`relative h-12 w-12 rounded-full border-2 ${
                done
                  ? "border-emerald-400 bg-emerald-400/30"
                  : active
                  ? "border-primary bg-primary/40 animate-pulse"
                  : "border-white/40 bg-white/10"
              }`}
            >
              {active && (
                <div
                  className="absolute inset-0 rounded-full border-4 border-primary"
                  style={{ clipPath: `inset(${(1 - progress) * 100}% 0 0 0)` }}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* Live fingertip cursor */}
      {tip && (
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
          style={{
            left: `${(1 - tip.x) * 100}%`,
            top: `${tip.y * 100}%`,
            backgroundColor: isPointing ? "hsl(var(--primary))" : "transparent",
          }}
        />
      )}

      <div className="absolute bottom-8 flex gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
