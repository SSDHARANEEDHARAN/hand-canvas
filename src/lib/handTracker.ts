// Load MediaPipe Hands from CDN at runtime to avoid Vite bundling issues
// (bundling mangles the global `Hands` constructor → "zX.Hands is not a constructor").

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
  // Bitmask-ish flags for primary hand
  indexExtended: boolean;
  middleExtended: boolean;
  ringExtended: boolean;
  pinkyExtended: boolean;
  thumbExtended: boolean;
}

export const EMPTY_STATE: HandState = {
  hands: 0,
  fingerCount: 0,
  handDistance: 0,
  avgY: 0.5,
  primaryFingers: 0,
  landmarks: [],
  pinching: false,
  indexExtended: false,
  middleExtended: false,
  ringExtended: false,
  pinkyExtended: false,
  thumbExtended: false,
};

const FINGERS = [
  { tip: 8, pip: 6 },
  { tip: 12, pip: 10 },
  { tip: 16, pip: 14 },
  { tip: 20, pip: 18 },
];

function extendedFlags(lm: NormalizedLandmark[]) {
  const ext = FINGERS.map((f) => lm[f.tip].y < lm[f.pip].y - 0.02);
  const thumb = Math.abs(lm[4].x - lm[2].x) > 0.06;
  return {
    index: ext[0],
    middle: ext[1],
    ring: ext[2],
    pinky: ext[3],
    thumb,
    count: ext.filter(Boolean).length + (thumb ? 1 : 0),
  };
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

export async function createHandTracker(
  video: HTMLVideoElement,
  onUpdate: (s: HandState) => void
): Promise<() => void> {
  await loadHandsScript();
  const HandsCtor = (window as unknown as { Hands: new (cfg: { locateFile: (f: string) => string }) => MPHands }).Hands;
  if (!HandsCtor) throw new Error("MediaPipe Hands global not available");

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
      onUpdate(EMPTY_STATE);
      return;
    }
    let fingers = 0;
    let yAcc = 0;
    let pinching = false;
    for (const lm of list) {
      const f = extendedFlags(lm);
      fingers += f.count;
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
    const primary = extendedFlags(list[0]);
    onUpdate({
      hands: list.length,
      fingerCount: fingers,
      handDistance: dist,
      avgY: yAcc / list.length,
      primaryFingers: primary.count,
      landmarks: list.map((lm) => lm.slice()),
      pinching,
      indexExtended: primary.index,
      middleExtended: primary.middle,
      ringExtended: primary.ring,
      pinkyExtended: primary.pinky,
      thumbExtended: primary.thumb,
    });
  });

  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    if (video.readyState >= 2) {
      try {
        await hands.send({ image: video });
      } catch {
        /* ignore frame errors */
      }
    }
    requestAnimationFrame(tick);
  };
  tick();

  return () => {
    stopped = true;
    hands.close().catch(() => {});
  };
}
