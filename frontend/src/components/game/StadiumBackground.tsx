"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildScene, buildPitch, buildGoals, buildStadium } from "@/lib/game/scene-builder";

export default function StadiumBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = buildScene();
    buildPitch(scene);
    buildGoals(scene);
    buildStadium(scene);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 600);
    camera.position.set(0, 32, 65);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const clock = new THREE.Clock();

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Slow orbital pan
      const radius = 68;
      const speed = 0.04;
      camera.position.x = Math.sin(t * speed) * radius;
      camera.position.z = Math.cos(t * speed) * radius;
      camera.position.y = 30 + Math.sin(t * 0.08) * 4;
      camera.lookAt(0, 2, 0);

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.35, filter: "blur(1px) brightness(0.6)" }}
    />
  );
}
