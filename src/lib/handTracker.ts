import { Hands, Results, NormalizedLandmark } from "@mediapipe/hands";

export interface HandState {
  hands: number;
  fingerCount: number;
  handDistance: number;
  avgY: number;
  primaryFingers: number;
  landmarks: NormalizedLandmark[][];
  pinching: boolean; // any hand currently pinching (thumb tip ↔ index tip)
}

export const EMPTY_STATE: HandState = {
  hands: 0,
  fingerCount: 0,
  handDistance: 0,
  avgY: 0.5,
  primaryFingers: 0,
  landmarks: [],
  pinching: false,
};

// Tip and PIP indices for finger extension test
const FINGERS = [
  { tip: 8, pip: 6 }, // index
  { tip: 12, pip: 10 }, // middle
  { tip: 16, pip: 14 }, // ring
  { tip: 20, pip: 18 }, // pinky
];

function countFingers(lm: NormalizedLandmark[]): number {
  let count = 0;
  for (const f of FINGERS) {
    if (lm[f.tip].y < lm[f.pip].y - 0.02) count++;
  }
  // Thumb: compare x against IP joint, direction depends on handedness; simple heuristic
  if (Math.abs(lm[4].x - lm[2].x) > 0.06) count++;
  return count;
}

export async function createHandTracker(
  video: HTMLVideoElement,
  onUpdate: (s: HandState) => void
): Promise<() => void> {
  const hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });

  hands.onResults((results: Results) => {
    const list = results.multiHandLandmarks ?? [];
    if (list.length === 0) {
      onUpdate(EMPTY_STATE);
      return;
    }
    let fingers = 0;
    let yAcc = 0;
    let pinching = false;
    for (const lm of list) {
      fingers += countFingers(lm);
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
    onUpdate({
      hands: list.length,
      fingerCount: fingers,
      handDistance: dist,
      avgY: yAcc / list.length,
      primaryFingers: countFingers(list[0]),
      landmarks: list.map((lm) => lm.slice()),
      pinching,
    });
  });

  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    if (video.readyState >= 2) {
      await hands.send({ image: video });
    }
    requestAnimationFrame(tick);
  };
  tick();

  return () => {
    stopped = true;
    hands.close().catch(() => {});
  };
}
