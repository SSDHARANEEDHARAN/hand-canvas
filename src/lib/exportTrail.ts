import type { ExportedStroke } from "@/components/DrawTrail";

const SIZE = 1080;
const SCALE = 80; // world units → pixels (scene roughly ±5 → ±400px)

function project(x: number, y: number) {
  // Center origin, flip Y so up is up
  return {
    px: SIZE / 2 + x * SCALE,
    py: SIZE / 2 - y * SCALE,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportTrailAsSVG(strokes: ExportedStroke[]) {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`
  );
  parts.push(`<rect width="${SIZE}" height="${SIZE}" fill="#06060f"/>`);

  for (const s of strokes) {
    if (s.points.length < 2) continue;
    // Build a polyline per stroke; color = average of segment colors
    let r = 0, g = 0, b = 0;
    for (const c of s.colors) { r += c.r; g += c.g; b += c.b; }
    const n = s.colors.length || 1;
    const stroke = rgbToHex(r / n, g / n, b / n);
    const pts = s.points.map((p) => {
      const { px, py } = project(p.x, p.y);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(" ");
    parts.push(
      `<polyline fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/>`
    );
  }
  parts.push("</svg>");

  const blob = new Blob([parts.join("")], { type: "image/svg+xml" });
  download(blob, `gesture-trail-${Date.now()}.svg`);
}

export function exportTrailAsPNG(strokes: ExportedStroke[]) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#06060f";
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const s of strokes) {
    if (s.points.length < 2) continue;
    // Draw each segment with its own color for a gradient feel
    for (let i = 1; i < s.points.length; i++) {
      const a = s.points[i - 1];
      const p = s.points[i];
      const c = s.colors[i] ?? s.colors[i - 1];
      const pa = project(a.x, a.y);
      const pp = project(p.x, p.y);
      ctx.strokeStyle = rgbToHex(c.r, c.g, c.b);
      ctx.beginPath();
      ctx.moveTo(pa.px, pa.py);
      ctx.lineTo(pp.px, pp.py);
      ctx.stroke();
    }
  }

  canvas.toBlob((blob) => {
    if (blob) download(blob, `gesture-trail-${Date.now()}.png`);
  }, "image/png");
}
