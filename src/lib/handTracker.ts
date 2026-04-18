import { Hands, Results, NormalizedLandmark } from "@mediapipe/hands";

export interface HandState {
  hands: number;
  fingerCount: number; // total extended fingers across both hands
  handDistance: number; // 0..1, normalized distance between two hand centers (0 if <2 hands)
  avgY: number; // 0..1, average wrist y across hands (0 top, 1 bottom)
  primaryFingers: number; // fingers on dominant (first) hand 0..5
  landmarks: NormalizedLandmark[][]; // raw landmark sets per hand for visualization
}

export const EMPTY_STATE: HandState = {
  hands: 0,
  fingerCount: 0,
  handDistance: 0,
  avgY: 0.5,
  primaryFingers: 0,
  landmarks: [],
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
    for (const lm of list) {
      fingers += countFingers(lm);
      yAcc += lm[0].y;
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
