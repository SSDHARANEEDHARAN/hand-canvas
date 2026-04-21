import { useFrame } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { generatePositions, TemplateName } from "@/lib/templates";

interface Props {
  template: TemplateName;
  expansion: number; // 0..1
  hue: number; // 0..1
  count?: number;
}

export interface ParticleFieldHandle {
  burst: (strength?: number) => void;
}


export const ParticleField = forwardRef<ParticleFieldHandle, Props>(
  ({ template, expansion, hue, count = 4000 }, ref) => {
    const pointsRef = useRef<THREE.Points>(null!);
    const targetRef = useRef<Float32Array>(generatePositions(template, count));
    const currentRef = useRef<Float32Array>(targetRef.current.slice());
    const velocitiesRef = useRef<Float32Array>(new Float32Array(count * 3));
    const lastTemplate = useRef<TemplateName>(template);

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
          size: 0.06,
          color: new THREE.Color().setHSL(0.75, 0.85, 0.6),
          transparent: true,
          depthWrite: false,
          sizeAttenuation: true,
        }),
      []
    );

    useImperativeHandle(ref, () => ({
      burst: (strength = 1) => {
        const vel = velocitiesRef.current;
        const cur = currentRef.current;
        for (let i = 0; i < cur.length; i += 3) {
          // Outward kick from origin + random component
          const len = Math.hypot(cur[i], cur[i + 1], cur[i + 2]) || 1;
          const k = (4 + Math.random() * 6) * strength;
          vel[i] += (cur[i] / len) * k + (Math.random() - 0.5) * 2;
          vel[i + 1] += (cur[i + 1] / len) * k + (Math.random() - 0.5) * 2;
          vel[i + 2] += (cur[i + 2] / len) * k + (Math.random() - 0.5) * 2;
        }
      },
    }));

    useFrame((_, delta) => {
      const dt = Math.min(delta, 0.05);
      const cur = currentRef.current;
      const tgt = targetRef.current;
      const vel = velocitiesRef.current;
      const exp = 0.7 + expansion * 1.8;

      for (let i = 0; i < cur.length; i += 3) {
        const tx = tgt[i] * exp;
        const ty = tgt[i + 1] * exp;
        const tz = tgt[i + 2] * exp;
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

      const target = new THREE.Color().setHSL(hue, 0.85, 0.6);
      (material as THREE.PointsMaterial).color.lerp(target, 0.1);

      if (pointsRef.current) pointsRef.current.rotation.y += dt * 0.15;
    });

    return <points ref={pointsRef} geometry={geometry} material={material} />;
  }
);
ParticleField.displayName = "ParticleField";
