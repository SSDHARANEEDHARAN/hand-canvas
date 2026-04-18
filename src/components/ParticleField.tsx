import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { generatePositions, TemplateName } from "@/lib/templates";

interface Props {
  template: TemplateName;
  expansion: number; // 0..1
  hue: number; // 0..1
  count?: number;
}

export const ParticleField = ({ template, expansion, hue, count = 4000 }: Props) => {
  const pointsRef = useRef<THREE.Points>(null!);
  const targetRef = useRef<Float32Array>(generatePositions(template, count));
  const currentRef = useRef<Float32Array>(targetRef.current.slice());
  const velocitiesRef = useRef<Float32Array>(new Float32Array(count * 3));
  const lastTemplate = useRef<TemplateName>(template);

  // When template changes, regenerate target positions
  if (lastTemplate.current !== template) {
    targetRef.current = generatePositions(template, count);
    lastTemplate.current = template;
  }

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(currentRef.current, 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.045,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: false,
      }),
    []
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const cur = currentRef.current;
    const tgt = targetRef.current;
    const vel = velocitiesRef.current;
    const exp = 0.7 + expansion * 1.8; // scale factor

    for (let i = 0; i < cur.length; i += 3) {
      const tx = tgt[i] * exp;
      const ty = tgt[i + 1] * exp;
      const tz = tgt[i + 2] * exp;

      // Spring toward target
      const ax = (tx - cur[i]) * 6 - vel[i] * 2;
      const ay = (ty - cur[i + 1]) * 6 - vel[i + 1] * 2;
      const az = (tz - cur[i + 2]) * 6 - vel[i + 2] * 2;
      vel[i] += ax * dt;
      vel[i + 1] += ay * dt;
      vel[i + 2] += az * dt;
      cur[i] += vel[i] * dt;
      cur[i + 1] += vel[i + 1] * dt;
      cur[i + 2] += vel[i + 2] * dt;
    }

    geometry.attributes.position.needsUpdate = true;

    // Color by hue
    const color = new THREE.Color().setHSL(hue, 0.85, 0.6);
    material.color.lerp(color, 0.1);

    // Gentle rotation
    if (pointsRef.current) {
      pointsRef.current.rotation.y += dt * 0.15;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
};
