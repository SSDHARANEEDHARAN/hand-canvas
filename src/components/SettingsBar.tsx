import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { RotateCcw } from "lucide-react";
import {
  DEFAULT_SETTINGS,
  FingerKey,
  GestureSettings,
} from "@/lib/gestureSettings";

const FINGERS: FingerKey[] = ["thumb", "index", "middle", "ring", "pinky"];

interface Props {
  settings: GestureSettings;
  onChange: (next: GestureSettings) => void;
}

export const SettingsBar = ({ settings, onChange }: Props) => {
  const toggle = (list: FingerKey[], f: FingerKey): FingerKey[] =>
    list.includes(f) ? list.filter((x) => x !== f) : [...list, f];

  return (
    <div className="grid gap-4 rounded-lg border border-border/70 bg-background/95 p-4 text-xs text-foreground shadow-2xl backdrop-blur-md sm:grid-cols-2">
      <div className="space-y-2">
        <div className="font-semibold">Pointing — must be EXTENDED</div>
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
        <div className="font-semibold">Pointing — must be FOLDED</div>
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
          <span className="font-semibold">Detection strictness</span>
          <span className="text-muted-foreground">{settings.strictness.toFixed(2)}</span>
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
          <span className="font-semibold">Fingertip smoothing</span>
          <span className="text-muted-foreground">{settings.smoothing.toFixed(2)}</span>
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
          <span className="font-semibold">Tracking FPS</span>
          <span className="text-muted-foreground">{settings.trackingFps}</span>
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
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={() => onChange(DEFAULT_SETTINGS)}
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
        <div className="ml-auto text-[10px] text-muted-foreground">
          Calibrated: {settings.calibration.minX.toFixed(2)}–{settings.calibration.maxX.toFixed(2)} ×{" "}
          {settings.calibration.minY.toFixed(2)}–{settings.calibration.maxY.toFixed(2)}
        </div>
      </div>
    </div>
  );
};
