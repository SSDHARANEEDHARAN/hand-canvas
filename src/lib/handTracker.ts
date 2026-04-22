// Load MediaPipe Hands from CDN at runtime to avoid Vite bundling issues.

import type { FingerKey, GestureSettings } from "./gestureSettings";

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandState {
  hands: number;
  fingerCount: number;
  handDistance: number;
  avgY: number;
  primaryFingers: number;
  landmarks: NormalizedLandmark[][];
  pinching: boolean;
  // Per-finger flags for primary hand
  extended: Record<FingerKey, boolean>;
  // Whether the configured "pointing" gesture is currently active
  isPointing: boolean;
  // Smoothed index fingertip in MediaPipe coords (0..1, mirrored x already? no — raw)
  smoothedTip: { x: number; y: number; z: number } | null;
}

export const EMPTY_STATE: HandState = {
  hands: 0,
  fingerCount: 0,
  handDistance: 0,
  avgY: 0.5,
  primaryFingers: 0,
  landmarks: [],
  pinching: false,
  extended: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  isPointing: false,
  smoothedTip: null,
};

const FINGER_LANDMARKS: Record<Exclude<FingerKey, "thumb">, { tip: number; pip: number }> = {
  index: { tip: 8, pip: 6 },
  middle: { tip: 12, pip: 10 },
  ring: { tip: 16, pip: 14 },
  pinky: { tip: 20, pip: 18 },
};

function computeExtended(lm: NormalizedLandmark[], strictness: number): Record<FingerKey, boolean> {
  // strictness 0..1 → margin 0.005..0.05
  const margin = 0.005 + strictness * 0.045;
  const ext = {
    thumb: Math.abs(lm[4].x - lm[2].x) > 0.04 + strictness * 0.05,
    index: lm[FINGER_LANDMARKS.index.tip].y < lm[FINGER_LANDMARKS.index.pip].y - margin,
    middle: lm[FINGER_LANDMARKS.middle.tip].y < lm[FINGER_LANDMARKS.middle.pip].y - margin,
    ring: lm[FINGER_LANDMARKS.ring.tip].y < lm[FINGER_LANDMARKS.ring.pip].y - margin,
    pinky: lm[FINGER_LANDMARKS.pinky.tip].y < lm[FINGER_LANDMARKS.pinky.pip].y - margin,
  };
  return ext;
}

function isPointingGesture(
  ext: Record<FingerKey, boolean>,
  required: FingerKey[],
  folded: FingerKey[]
): boolean {
  for (const f of required) if (!ext[f]) return false;
  for (const f of folded) if (ext[f]) return false;
  return true;
}

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240";

let scriptPromise: Promise<void> | null = null;
function loadHandsScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if ((window as unknown as { Hands?: unknown }).Hands) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = `${CDN}/hands.js`;
    s.crossOrigin = "anonymous";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load MediaPipe Hands from CDN"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface MPResults {
  multiHandLandmarks?: NormalizedLandmark[][];
}
interface MPHands {
  setOptions: (o: Record<string, unknown>) => void;
  onResults: (cb: (r: MPResults) => void) => void;
  send: (i: { image: HTMLVideoElement }) => Promise<void>;
  close: () => Promise<void>;
}

export interface HandTrackerHandle {
  stop: () => void;
  updateSettings: (s: GestureSettings) => void;
}

export async function createHandTracker(
  video: HTMLVideoElement,
  onUpdate: (s: HandState) => void,
  initialSettings: GestureSettings
): Promise<HandTrackerHandle> {
  await loadHandsScript();
  const HandsCtor = (window as unknown as { Hands: new (cfg: { locateFile: (f: string) => string }) => MPHands }).Hands;
  if (!HandsCtor) throw new Error("MediaPipe Hands global not available");

  let settings = initialSettings;
  const smoothed = { x: 0, y: 0, z: 0, init: false };

  const hands = new HandsCtor({
    locateFile: (file: string) => `${CDN}/${file}`,
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });

  hands.onResults((results: MPResults) => {
    const list = results.multiHandLandmarks ?? [];
    if (list.length === 0) {
      smoothed.init = false;
      onUpdate(EMPTY_STATE);
      return;
    }
    let fingers = 0;
    let yAcc = 0;
    let pinching = false;
    for (const lm of list) {
      const e = computeExtended(lm, settings.strictness);
      fingers += (e.thumb ? 1 : 0) + (e.index ? 1 : 0) + (e.middle ? 1 : 0) + (e.ring ? 1 : 0) + (e.pinky ? 1 : 0);
      yAcc += lm[0].y;
      const t = lm[4], idx = lm[8], wrist = lm[0], midMcp = lm[9];
      const handSize = Math.hypot(wrist.x - midMcp.x, wrist.y - midMcp.y) || 0.1;
      const tipDist = Math.hypot(t.x - idx.x, t.y - idx.y);
      if (tipDist / handSize < 0.5) pinching = true;
    }
    let dist = 0;
    if (list.length >= 2) {
      const a = list[0][0];
      const b = list[1][0];
      dist = Math.min(1, Math.hypot(a.x - b.x, a.y - b.y));
    }
    const primaryExt = computeExtended(list[0], settings.strictness);
    const isPointing = isPointingGesture(
      primaryExt,
      settings.pointingRequiredExtended,
      settings.pointingRequiredFolded
    );

    // Exponential smoothing on index fingertip
    const tip = list[0][8];
    const a = 1 - settings.smoothing;
    if (!smoothed.init) {
      smoothed.x = tip.x;
      smoothed.y = tip.y;
      smoothed.z = tip.z ?? 0;
      smoothed.init = true;
    } else {
      smoothed.x = smoothed.x + a * (tip.x - smoothed.x);
      smoothed.y = smoothed.y + a * (tip.y - smoothed.y);
      smoothed.z = smoothed.z + a * ((tip.z ?? 0) - smoothed.z);
    }

    onUpdate({
      hands: list.length,
      fingerCount: fingers,
      handDistance: dist,
      avgY: yAcc / list.length,
      primaryFingers:
        (primaryExt.thumb ? 1 : 0) +
        (primaryExt.index ? 1 : 0) +
        (primaryExt.middle ? 1 : 0) +
        (primaryExt.ring ? 1 : 0) +
        (primaryExt.pinky ? 1 : 0),
      landmarks: list.map((lm) => lm.slice()),
      pinching,
      extended: primaryExt,
      isPointing,
      smoothedTip: { x: smoothed.x, y: smoothed.y, z: smoothed.z },
    });
  });

  let stopped = false;
  let lastSent = 0;
  const tick = async () => {
    if (stopped) return;
    const minInterval = 1000 / Math.max(5, Math.min(60, settings.trackingFps));
    const now = performance.now();
    if (video.readyState >= 2 && now - lastSent >= minInterval) {
      lastSent = now;
      try {
        await hands.send({ image: video });
      } catch {
        /* ignore frame errors */
      }
    }
    requestAnimationFrame(tick);
  };
  tick();

  return {
    stop: () => {
      stopped = true;
      hands.close().catch(() => {});
    },
    updateSettings: (s) => {
      settings = s;
    },
  };
}
