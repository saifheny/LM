import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VipTier } from '../../types';

/**
 * 2026 Interactive 3D Sentient Companion Character ("LM Spatial Avatar")
 * Tracks cursor in 3D space, blinks naturally, levitates, and reacts to voice/AI state!
 */
export function SpatialCompanion3D({
  speaking = false,
  listening = false,
  size = 220,
}: {
  speaking?: boolean;
  listening?: boolean;
  size?: number;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ speaking, listening });
  stateRef.current = { speaking, listening };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0.15, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xa78bfa, 2.6);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x38bdf8, 3.2, 12);
    rimLight.position.set(-3.2, -1.5, 3);
    scene.add(rimLight);

    // Character Root Group
    const character = new THREE.Group();
    scene.add(character);

    // Sculpted Pearlescent Robot/Companion Head Capsule
    const headGeo = new THREE.SphereGeometry(1.08, 64, 64);
    headGeo.scale(1.08, 0.96, 0.98);
    const headMat = new THREE.MeshPhysicalMaterial({
      color: 0x161926,
      metalness: 0.35,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      emissive: 0x2e1065,
      emissiveIntensity: 0.22,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    character.add(head);

    // Glossy Curved Visor Faceplate
    const visorGeo = new THREE.SphereGeometry(0.95, 48, 48, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.28, Math.PI * 0.42);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x05070e,
      metalness: 0.1,
      roughness: 0.05,
      clearcoat: 1.0,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.rotation.y = -Math.PI * 0.5;
    visor.position.z = 0.22;
    character.add(visor);

    // Expressive Glowing Twin Eyes inside Visor
    const eyeGeo = new THREE.CapsuleGeometry(0.11, 0.16, 12, 24);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.32, 0.06, 1.08);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.32, 0.06, 1.08);
    character.add(leftEye, rightEye);

    // Floating Side Ear-Pods / Audio Fins
    const podGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 32);
    podGeo.rotateZ(Math.PI / 2);
    const podMat = new THREE.MeshPhysicalMaterial({
      color: 0x7c5cff,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.45,
    });
    const leftPod = new THREE.Mesh(podGeo, podMat);
    leftPod.position.set(-1.18, 0.02, 0);
    const rightPod = new THREE.Mesh(podGeo, podMat);
    rightPod.position.set(1.18, 0.02, 0);
    character.add(leftPod, rightPod);

    // Counter-Rotating Spatial Orbital Rings
    const ring1Geo = new THREE.TorusGeometry(1.58, 0.022, 16, 100);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.65 });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI * 0.42;
    scene.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(1.82, 0.015, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = -Math.PI * 0.35;
    ring2.rotation.y = Math.PI * 0.2;
    scene.add(ring2);

    let targetRotX = 0;
    let targetRotY = 0;
    const onPointerMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      targetRotY = x * 0.45;
      targetRotX = y * 0.28;
    };
    window.addEventListener('mousemove', onPointerMove);

    let raf = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const t = clock.getElapsedTime();
      const { speaking: isSpeaking, listening: isListening } = stateRef.current;

      // Smooth levitation & cursor tracking
      const bobSpeed = isSpeaking ? 5.5 : isListening ? 3.5 : 1.8;
      const bobAmp = isSpeaking ? 0.14 : 0.08;
      character.position.y = Math.sin(t * bobSpeed) * bobAmp;

      character.rotation.y += (targetRotY - character.rotation.y) * 0.08;
      character.rotation.x += (targetRotX - character.rotation.x) * 0.08;

      // Natural eye blink every ~4s + voice pulse
      const blinkCycle = Math.sin(t * 0.8);
      const isBlinking = blinkCycle > 0.985;
      const eyeScaleY = isBlinking ? 0.08 : isSpeaking ? 0.85 + Math.abs(Math.sin(t * 14)) * 0.55 : 1;
      leftEye.scale.y = eyeScaleY;
      rightEye.scale.y = eyeScaleY;

      eyeMat.color.setHex(isListening ? 0x10b981 : isSpeaking ? 0xa78bfa : 0x38bdf8);

      const ringScale = isSpeaking || isListening ? 1 + Math.sin(t * 10) * 0.05 : 1;
      ring1.scale.setScalar(ringScale);
      ring1.rotation.z = t * (isSpeaking ? 1.4 : 0.45);
      ring2.rotation.z = -t * (isListening ? 1.2 : 0.32);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onPointerMove);
      renderer.dispose();
    };
  }, [size]);

  return <div ref={mountRef} style={{ width: size, height: size }} className="mx-auto select-none pointer-events-none" />;
}

/**
 * 2026 Interactive Drag-to-Rotate 3D Prestige Artifact for VIP & Ranks
 */
export function VipArtifact3D({ tier = 1, size = 190 }: { tier: VipTier; size?: number }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.2, 4.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const colorMap: Record<number, { main: number; rim: number }> = {
      1: { main: 0xf5c451, rim: 0xfef08a }, // Imperial 24K Gold
      2: { main: 0x38bdf8, rim: 0x818cf8 }, // Sapphire Diamond
      3: { main: 0x10b981, rim: 0x6ee7b7 }, // Emerald Crystal
      4: { main: 0xa855f7, rim: 0xe9d5ff }, // Amethyst
      5: { main: 0x94a3b8, rim: 0xf1f5f9 }, // Brushed Titanium
      0: { main: 0x64748b, rim: 0xcbd5e1 },
    };
    const palette = colorMap[tier] || colorMap[1];

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const l1 = new THREE.DirectionalLight(palette.rim, 3.2);
    l1.position.set(3, 5, 4);
    scene.add(l1);
    const l2 = new THREE.PointLight(palette.main, 2.8, 10);
    l2.position.set(-3, -2, 3);
    scene.add(l2);

    const group = new THREE.Group();
    scene.add(group);

    // Faceted Octahedral Prestige Gem Core
    const gemGeo = new THREE.OctahedronGeometry(1.05, 0);
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: palette.main,
      metalness: 0.65,
      roughness: 0.12,
      clearcoat: 1.0,
      reflectivity: 1.0,
    });
    const gem = new THREE.Mesh(gemGeo, gemMat);
    group.add(gem);

    // Floating Crown Halo Ring
    const haloGeo = new THREE.TorusGeometry(1.42, 0.045, 20, 96);
    const haloMat = new THREE.MeshPhysicalMaterial({
      color: palette.rim,
      metalness: 0.85,
      roughness: 0.15,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI * 0.38;
    group.add(halo);

    let isDragging = false;
    let prevX = 0;
    let velY = 0.012;

    const onDown = (e: PointerEvent) => { isDragging = true; prevX = e.clientX; };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      prevX = e.clientX;
      velY = dx * 0.012;
      group.rotation.y += velY;
    };
    const onUp = () => { isDragging = false; };

    container.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      if (!isDragging) {
        velY += (0.012 - velY) * 0.04;
        group.rotation.y += velY;
      }
      group.position.y = Math.sin(t * 2.1) * 0.08;
      halo.rotation.z = t * 0.5;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      renderer.dispose();
    };
  }, [tier, size]);

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size }}
      title="Drag to rotate in 3D"
      className="mx-auto cursor-grab active:cursor-grabbing select-none"
    />
  );
}
