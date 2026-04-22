import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Settings as SettingsIcon, Crosshair, RotateCcw } from "lucide-react";
import { useState } from "react";
import {
  DEFAULT_SETTINGS,
  FingerKey,
  GestureSettings,
} from "@/lib/gestureSettings";

const FINGERS: FingerKey[] = ["thumb", "index", "middle", "ring", "pinky"];

interface Props {
  settings: GestureSettings;
  onChange: (next: GestureSettings) => void;
  onCalibrate: () => void;
}

export const SettingsBar = ({ settings, onChange, onCalibrate }: Props) => {
  const [open, setOpen] = useState(false);

  const toggle = (list: FingerKey[], f: FingerKey): FingerKey[] =>
    list.includes(f) ? list.filter((x) => x !== f) : [...list, f];

  return (
    <div className="pointer-events-auto absolute left-1/2 top-4 z-20 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-white/10 bg-black/70 text-white/90 backdrop-blur-md shadow-2xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm"
      >
        <span className="flex items-center gap-2 font-semibold">
          <SettingsIcon className="h-4 w-4" /> Settings
        </span>
        <span className="flex items-center gap-2 text-xs opacity-70">
          {settings.pointingRequiredExtended.join("+")} extended ·{" "}
          {Math.round(settings.smoothing * 100)}% smooth · {settings.trackingFps}fps
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-white/10 p-4 text-xs sm:grid-cols-2">
          <div className="space-y-2">
            <div className="font-semibold text-white">Pointing — must be EXTENDED</div>
            <div className="flex flex-wrap gap-3">
              {FINGERS.map((f) => (
                <label key={`e-${f}`} className="flex items-center gap-1.5 capitalize">
                  <Checkbox
                    checked={settings.pointingRequiredExtended.includes(f)}
                    onCheckedChange={() =>
                      onChange({
                        ...settings,
                        pointingRequiredExtended: toggle(settings.pointingRequiredExtended, f),
                      })
                    }
                  />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-white">Pointing — must be FOLDED</div>
            <div className="flex flex-wrap gap-3">
              {FINGERS.map((f) => (
                <label key={`f-${f}`} className="flex items-center gap-1.5 capitalize">
                  <Checkbox
                    checked={settings.pointingRequiredFolded.includes(f)}
                    onCheckedChange={() =>
                      onChange({
                        ...settings,
                        pointingRequiredFolded: toggle(settings.pointingRequiredFolded, f),
                      })
                    }
                  />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold text-white">Detection strictness</span>
              <span className="opacity-70">{settings.strictness.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.strictness]}
              onValueChange={([v]) => onChange({ ...settings, strictness: v })}
              min={0}
              max={1}
              step={0.05}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold text-white">Fingertip smoothing</span>
              <span className="opacity-70">{settings.smoothing.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.smoothing]}
              onValueChange={([v]) => onChange({ ...settings, smoothing: v })}
              min={0}
              max={0.95}
              step={0.05}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold text-white">Tracking FPS</span>
              <span className="opacity-70">{settings.trackingFps}</span>
            </div>
            <Slider
              value={[settings.trackingFps]}
              onValueChange={([v]) => onChange({ ...settings, trackingFps: Math.round(v) })}
              min={5}
              max={60}
              step={1}
            />
          </div>

          <div className="flex items-end gap-2 sm:col-span-2">
            <Button size="sm" variant="secondary" onClick={onCalibrate} className="gap-1.5">
              <Crosshair className="h-3 w-3" /> Calibrate canvas
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => onChange(DEFAULT_SETTINGS)}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
            <div className="ml-auto text-[10px] opacity-60">
              Calibrated: {settings.calibration.minX.toFixed(2)}–{settings.calibration.maxX.toFixed(2)} ×{" "}
              {settings.calibration.minY.toFixed(2)}–{settings.calibration.maxY.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
