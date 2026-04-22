import { useEffect, useState } from "react";

export type FingerKey = "thumb" | "index" | "middle" | "ring" | "pinky";

export interface CalibrationRect {
  // Normalized (0..1) bounds in the *mirrored* MediaPipe coord space
  // that the user can comfortably reach with their pointing fingertip.
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const DEFAULT_CALIBRATION: CalibrationRect = {
  minX: 0.15,
  maxX: 0.85,
  minY: 0.15,
  maxY: 0.85,
};

export interface GestureSettings {
  // Which fingers must be EXTENDED to count as "pointing"
  pointingRequiredExtended: FingerKey[];
  // Which fingers must be FOLDED (not extended) to count as "pointing"
  pointingRequiredFolded: FingerKey[];
  // 0..1 — how strict the extended/folded test is (margin around the pip joint)
  strictness: number;
  // Fingertip exponential smoothing factor (0 = none, 0.95 = very smooth)
  smoothing: number;
  // Tracking FPS cap (5..60)
  trackingFps: number;
  calibration: CalibrationRect;
}

export const DEFAULT_SETTINGS: GestureSettings = {
  pointingRequiredExtended: ["index"],
  pointingRequiredFolded: ["middle", "ring", "pinky"],
  strictness: 0.5,
  smoothing: 0.6,
  trackingFps: 30,
  calibration: DEFAULT_CALIBRATION,
};

const KEY = "gesture-settings-v1";

export function loadSettings(): GestureSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GestureSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      calibration: { ...DEFAULT_CALIBRATION, ...(parsed.calibration ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: GestureSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function useGestureSettings() {
  const [settings, setSettings] = useState<GestureSettings>(() => loadSettings());
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  return [settings, setSettings] as const;
}
