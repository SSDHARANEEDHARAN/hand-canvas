import { NormalizedLandmark } from "@mediapipe/hands";
import { useEffect, useRef } from "react";

// Hand connections (pairs of landmark indices)
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

interface Props {
  landmarks: NormalizedLandmark[][];
  width: number;
  height: number;
  className?: string;
}

export const LandmarkOverlay = ({ landmarks, width, height, className }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (!landmarks.length) return;

    for (const lm of landmarks) {
      // Lines
      ctx.strokeStyle = "hsl(190 95% 60%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [a, b] of CONNECTIONS) {
        const pa = lm[a];
        const pb = lm[b];
        if (!pa || !pb) continue;
        ctx.moveTo(pa.x * width, pa.y * height);
        ctx.lineTo(pb.x * width, pb.y * height);
      }
      ctx.stroke();

      // Points
      ctx.fillStyle = "hsl(280 90% 65%)";
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [landmarks, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ transform: "scaleX(-1)" }}
    />
  );
};
