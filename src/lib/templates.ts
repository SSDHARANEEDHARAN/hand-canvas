// Particle position generators. Each returns Float32Array of length count*3.
export type TemplateName = "heart" | "flower" | "saturn" | "fireworks" | "galaxy" | "dna" | "sphere";

export const TEMPLATE_ORDER: TemplateName[] = [
  "sphere",
  "heart",
  "flower",
  "saturn",
  "fireworks",
  "galaxy",
  "dna",
];

const TAU = Math.PI * 2;

export function generatePositions(name: TemplateName, count: number): Float32Array {
  const arr = new Float32Array(count * 3);
  switch (name) {
    case "heart": {
      for (let i = 0; i < count; i++) {
        const t = (i / count) * TAU;
        const r = 0.05 + Math.random() * 0.05;
        const x = 16 * Math.sin(t) ** 3;
        const y =
          13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t);
        const jitterZ = (Math.random() - 0.5) * 4;
        const scale = 0.12 + r;
        arr[i * 3] = x * scale + (Math.random() - 0.5) * 0.2;
        arr[i * 3 + 1] = y * scale + (Math.random() - 0.5) * 0.2;
        arr[i * 3 + 2] = jitterZ * 0.3;
      }
      break;
    }
    case "flower": {
      const petals = 6;
      for (let i = 0; i < count; i++) {
        const t = (i / count) * TAU * 4;
        const r = Math.cos(petals * t) * 2 + 0.3 * Math.random();
        arr[i * 3] = r * Math.cos(t);
        arr[i * 3 + 1] = r * Math.sin(t);
        arr[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      }
      break;
    }
    case "saturn": {
      for (let i = 0; i < count; i++) {
        if (i % 5 === 0) {
          // Planet sphere
          const u = Math.random();
          const v = Math.random();
          const theta = u * TAU;
          const phi = Math.acos(2 * v - 1);
          const r = 1.2;
          arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
          arr[i * 3 + 2] = r * Math.cos(phi);
        } else {
          const t = Math.random() * TAU;
          const r = 1.8 + Math.random() * 1.4;
          arr[i * 3] = r * Math.cos(t);
          arr[i * 3 + 1] = (Math.random() - 0.5) * 0.08;
          arr[i * 3 + 2] = r * Math.sin(t);
        }
      }
      break;
    }
    case "fireworks": {
      const bursts = 12;
      for (let i = 0; i < count; i++) {
        const burst = i % bursts;
        const ba = (burst / bursts) * TAU;
        const cx = Math.cos(ba) * 1.5;
        const cy = Math.sin(ba) * 1.5;
        const cz = (Math.random() - 0.5) * 1.5;
        const dir = new Array(3).fill(0).map(() => (Math.random() - 0.5) * 2);
        const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
        const r = 0.2 + Math.random() * 1.8;
        arr[i * 3] = cx + (dir[0] / len) * r;
        arr[i * 3 + 1] = cy + (dir[1] / len) * r;
        arr[i * 3 + 2] = cz + (dir[2] / len) * r;
      }
      break;
    }
    case "galaxy": {
      const arms = 4;
      for (let i = 0; i < count; i++) {
        const r = Math.pow(Math.random(), 0.6) * 3;
        const arm = i % arms;
        const angle = (arm / arms) * TAU + r * 1.2 + (Math.random() - 0.5) * 0.3;
        arr[i * 3] = Math.cos(angle) * r;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 0.2 * (1 - r / 4);
        arr[i * 3 + 2] = Math.sin(angle) * r;
      }
      break;
    }
    case "dna": {
      for (let i = 0; i < count; i++) {
        const t = (i / count) * TAU * 6;
        const y = (i / count - 0.5) * 6;
        const strand = i % 2 === 0 ? 1 : -1;
        arr[i * 3] = Math.cos(t) * 0.8 * strand;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = Math.sin(t) * 0.8 * strand;
      }
      break;
    }
    case "sphere":
    default: {
      for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * TAU;
        const phi = Math.acos(2 * v - 1);
        const r = 1.6 + (Math.random() - 0.5) * 0.1;
        arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        arr[i * 3 + 2] = r * Math.cos(phi);
      }
      break;
    }
  }
  return arr;
}
