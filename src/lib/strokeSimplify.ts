import type { ExportedStroke } from "@/components/DrawTrail";

interface P {
  x: number;
  y: number;
  z: number;
}

function distToSegment(p: P, a: P, b: P) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / len2));
  const projx = a.x + t * dx;
  const projy = a.y + t * dy;
  const projz = a.z + t * dz;
  return Math.hypot(p.x - projx, p.y - projy, p.z - projz);
}

// Ramer–Douglas–Peucker
export function simplify(points: P[], epsilon = 0.04): number[] {
  if (points.length < 3) return points.map((_, i) => i);
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distToSegment(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > epsilon) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < keep.length; i++) if (keep[i]) out.push(i);
  return out;
}

// Catmull–Rom smoothing — inserts interpolated points between control points.
function catmullRom(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) };
}

export function smoothStroke(stroke: ExportedStroke, epsilon = 0.04, segments = 6): ExportedStroke {
  if (stroke.points.length < 3) return stroke;
  const idxs = simplify(stroke.points, epsilon);
  const ctrl = idxs.map((i) => stroke.points[i]);
  const ctrlColors = idxs.map((i) => stroke.colors[i] ?? stroke.colors[0]);
  if (ctrl.length < 2) return stroke;

  const out: P[] = [];
  const outC: { r: number; g: number; b: number }[] = [];

  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[i - 1] ?? ctrl[i];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[i + 2] ?? ctrl[i + 1];
    const c1 = ctrlColors[i];
    const c2 = ctrlColors[i + 1] ?? c1;
    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      out.push(catmullRom(p0, p1, p2, p3, t));
      outC.push({
        r: c1.r + (c2.r - c1.r) * t,
        g: c1.g + (c2.g - c1.g) * t,
        b: c1.b + (c2.b - c1.b) * t,
      });
    }
  }
  const last = ctrl[ctrl.length - 1];
  out.push(last);
  outC.push(ctrlColors[ctrlColors.length - 1]);
  return { points: out, colors: outC };
}

export function smoothAll(strokes: ExportedStroke[], epsilon = 0.04, segments = 6): ExportedStroke[] {
  return strokes.map((s) => smoothStroke(s, epsilon, segments));
}
