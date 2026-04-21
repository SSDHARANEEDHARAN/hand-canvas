import { useMemo, forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export interface ExportedStroke {
  points: { x: number; y: number; z: number }[];
  colors: { r: number; g: number; b: number }[];
}

export interface DrawTrailHandle {
  addPoint: (x: number, y: number, z: number, hue: number) => void;
  endStroke: () => void;
  clear: () => void;
  getStrokes: () => ExportedStroke[];
}

interface Stroke {
  positions: number[]; // flat xyz
  colors: number[]; // flat rgb
  geometry: THREE.BufferGeometry;
}

const MAX_STROKES = 40;
const MAX_POINTS_PER_STROKE = 600;

export const DrawTrail = forwardRef<DrawTrailHandle>((_, ref) => {
  const groupRef = useRef<THREE.Group>(null!);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const lastPointRef = useRef<THREE.Vector3 | null>(null);
  const dirtyRef = useRef(false);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        linewidth: 2,
      }),
    []
  );

  const newStroke = (): Stroke => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_POINTS_PER_STROKE * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX_POINTS_PER_STROKE * 3), 3));
    geometry.setDrawRange(0, 0);
    return { positions: [], colors: [], geometry };
  };

  useImperativeHandle(ref, () => ({
    addPoint: (x, y, z, hue) => {
      if (!currentRef.current) {
        currentRef.current = newStroke();
        strokesRef.current.push(currentRef.current);
        if (strokesRef.current.length > MAX_STROKES) {
          const removed = strokesRef.current.shift();
          removed?.geometry.dispose();
        }
      }
      const s = currentRef.current;
      const p = new THREE.Vector3(x, y, z);
      // skip if too close to previous
      if (lastPointRef.current && lastPointRef.current.distanceTo(p) < 0.02) return;
      lastPointRef.current = p;

      if (s.positions.length / 3 >= MAX_POINTS_PER_STROKE) return;
      s.positions.push(x, y, z);
      const c = new THREE.Color().setHSL(hue, 0.9, 0.6);
      s.colors.push(c.r, c.g, c.b);
      dirtyRef.current = true;
    },
    endStroke: () => {
      currentRef.current = null;
      lastPointRef.current = null;
    },
    clear: () => {
      strokesRef.current.forEach((s) => s.geometry.dispose());
      strokesRef.current = [];
      currentRef.current = null;
      lastPointRef.current = null;
    },
    getStrokes: () => {
      return strokesRef.current.map((s) => {
        const points: { x: number; y: number; z: number }[] = [];
        const colors: { r: number; g: number; b: number }[] = [];
        for (let i = 0; i < s.positions.length; i += 3) {
          points.push({ x: s.positions[i], y: s.positions[i + 1], z: s.positions[i + 2] });
          colors.push({ r: s.colors[i], g: s.colors[i + 1], b: s.colors[i + 2] });
        }
        return { points, colors };
      });
    },
  }));

  useFrame(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    for (const s of strokesRef.current) {
      const count = s.positions.length / 3;
      const posAttr = s.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colAttr = s.geometry.getAttribute("color") as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const colArr = colAttr.array as Float32Array;
      for (let i = 0; i < s.positions.length; i++) posArr[i] = s.positions[i];
      for (let i = 0; i < s.colors.length; i++) colArr[i] = s.colors[i];
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      s.geometry.setDrawRange(0, count);
      s.geometry.computeBoundingSphere();
    }
    // rebuild children
    const g = groupRef.current;
    if (!g) return;
    while (g.children.length > strokesRef.current.length) {
      const child = g.children.pop()!;
      (child as THREE.Line).geometry?.dispose?.();
    }
    for (let i = g.children.length; i < strokesRef.current.length; i++) {
      const line = new THREE.Line(strokesRef.current[i].geometry, material);
      g.add(line);
    }
    // ensure each child uses correct geometry (in case of shifts)
    for (let i = 0; i < strokesRef.current.length; i++) {
      (g.children[i] as THREE.Line).geometry = strokesRef.current[i].geometry;
    }
  });

  return <group ref={groupRef} />;
});
DrawTrail.displayName = "DrawTrail";
