import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import land110m from 'world-atlas/land-110m.json';

interface HubPoint {
  lat: number;
  lon: number;
  intensity: number;
  radius: number;
}

const GLOW_HUBS: HubPoint[] = [
  // Europe & Mediterranean
  { lat: 51.5, lon: -0.1, intensity: 1.0, radius: 0.42 },   // London
  { lat: 48.8, lon: 2.35, intensity: 0.9, radius: 0.36 },   // Paris
  { lat: 52.5, lon: 13.4, intensity: 0.85, radius: 0.38 },  // Berlin
  { lat: 41.9, lon: 12.5, intensity: 0.78, radius: 0.32 },  // Rome
  // Middle East & Africa
  { lat: 30.0, lon: 31.2, intensity: 1.05, radius: 0.44 },  // Cairo
  { lat: 24.7, lon: 46.7, intensity: 0.88, radius: 0.36 },  // Riyadh
  { lat: 6.5, lon: 3.4, intensity: 0.92, radius: 0.40 },    // Lagos
  { lat: -1.3, lon: 36.8, intensity: 0.82, radius: 0.36 },  // Nairobi
  { lat: -26.2, lon: 28.0, intensity: 0.76, radius: 0.34 }, // Johannesburg
  // Asia & Oceania
  { lat: 19.1, lon: 72.9, intensity: 0.98, radius: 0.44 },  // Mumbai
  { lat: 28.6, lon: 77.2, intensity: 0.95, radius: 0.40 },  // Delhi
  { lat: 31.2, lon: 121.5, intensity: 1.05, radius: 0.46 }, // Shanghai
  { lat: 39.9, lon: 116.4, intensity: 0.92, radius: 0.40 }, // Beijing
  { lat: 35.7, lon: 139.7, intensity: 0.96, radius: 0.38 }, // Tokyo
  { lat: 1.35, lon: 103.8, intensity: 0.85, radius: 0.36 }, // Singapore
  { lat: -33.9, lon: 151.2, intensity: 0.72, radius: 0.34 },// Sydney
  // Americas
  { lat: 40.7, lon: -74.0, intensity: 1.0, radius: 0.44 },  // New York
  { lat: 37.7, lon: -122.4, intensity: 0.88, radius: 0.38 },// San Francisco
  { lat: -23.5, lon: -46.6, intensity: 0.9, radius: 0.40 }, // Sao Paulo
];

function latLonToVec3(latDeg: number, lonDeg: number, radius: number): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const cosLat = Math.cos(lat);
  return new THREE.Vector3(
    radius * cosLat * Math.sin(lon),
    radius * Math.sin(lat),
    radius * cosLat * Math.cos(lon)
  );
}

/**
 * Rasterizes the real Natural Earth 1:110m landmass TopoJSON into a crisp 1024x512 bitmap once (< 5ms).
 */
function buildEarthLandMask(): { data: Uint8ClampedArray; width: number; height: number } {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { data: new Uint8ClampedArray(width * height * 4), width, height };
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';

  const topo = land110m as unknown as Topology<{ land: GeometryCollection }>;
  const geo = feature(topo, topo.objects.land);

  const drawPolygon = (rings: number[][][]) => {
    ctx.beginPath();
    for (const ring of rings) {
      if (!ring || ring.length < 3) continue;
      for (let i = 0; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        const x = ((lon + 180) / 360) * width;
        const y = ((90 - lat) / 180) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill('evenodd');
  };

  const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
  for (const f of features) {
    if (f.type !== 'Feature' || !f.geometry) continue;
    const geom = f.geometry;
    if (geom.type === 'Polygon') {
      drawPolygon(geom.coordinates as number[][][]);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates as number[][][][]) {
        drawPolygon(poly);
      }
    }
  }

  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

function createRadialGlowTexture(innerRgba: string, midRgba: string, outerRgba: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, innerRgba);
  g.addColorStop(0.28, midRgba);
  g.addColorStop(0.65, outerRgba);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createBeaconRingTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  // Soft purple glow halo
  const halo = ctx.createRadialGradient(c, c, 4, c, c, c);
  halo.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  halo.addColorStop(0.18, 'rgba(233, 213, 255, 0.72)');
  halo.addColorStop(0.42, 'rgba(168, 85, 247, 0.34)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  // Crisp glowing ring around pinpoint
  ctx.strokeStyle = 'rgba(245, 232, 255, 0.92)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c, c, 20, 0, Math.PI * 2);
  ctx.stroke();

  // Pure white inner center dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(c, c, 7, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function CosmicPlanetCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x050409, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);

    const GLOBE_RADIUS = 2.68;
    const GLOBE_Y_OFFSET = -0.62;

    // ------------------------------------------------------------------
    // 1. DEEP SPACE CRISP STARFIELD (Occluded naturally behind planet)
    // ------------------------------------------------------------------
    const STAR_COUNT = 260;
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starSizes = new Float32Array(STAR_COUNT);
    const starPhases = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      // Spread across back sky hemisphere behind the globe
      const x = (Math.random() - 0.5) * 44;
      const y = (Math.random() - 0.35) * 28;
      const z = -12 - Math.random() * 24;
      starPositions[i * 3] = x;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = z;
      const bright = Math.random();
      starSizes[i] = bright > 0.9 ? 2.6 + Math.random() * 1.4 : 1.0 + Math.random() * 1.5;
      starPhases[i] = Math.random() * Math.PI * 2;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));

    const starMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: dpr },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float twinkle = 0.62 + 0.38 * sin(uTime * 1.35 + aPhase);
          vAlpha = twinkle;
          gl_PointSize = aSize * uPixelRatio;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.08, d);
          float alpha = pow(core, 1.8) * vAlpha;
          vec3 col = mix(vec3(0.84, 0.80, 1.0), vec3(1.0, 1.0, 1.0), core);
          gl_FragColor = vec4(col, alpha * 0.92);
        }
      `,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ------------------------------------------------------------------
    // 2. OUTER SOLAR-ECLIPSE VIOLET ATMOSPHERIC HALO (Exact Volumetric BackSide Sphere)
    // ------------------------------------------------------------------
    const HALO_SCALE = 1.28;
    const haloCosEdge = Math.sqrt(1 - 1 / (HALO_SCALE * HALO_SCALE)); // ~0.6242 right at exact planet silhouette
    const haloGeo = new THREE.SphereGeometry(GLOBE_RADIUS * HALO_SCALE, 96, 96);
    const haloMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uCosEdge: { value: haloCosEdge },
      },
      vertexShader: `
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        varying vec3 vObjNormal;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vNormalView = normalize(normalMatrix * normal);
          vObjNormal = normalize(normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uCosEdge;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        varying vec3 vObjNormal;
        void main() {
          vec3 N = normalize(vNormalView);
          vec3 V = normalize(vViewPos);
          // On BackSide wall: c == uCosEdge at exact planet silhouette, c == 0.0 at outer edge 1.28R
          float c = clamp(dot(-N, V), 0.0, 1.0);
          float outDist = clamp(1.0 - (c / uCosEdge), 0.0, 1.0);
          float outerFade = smoothstep(1.0, 0.58, outDist);

          // Luminous upper-horizon crown boost (blazing brightest across top arc, gracefully wrapping flanks)
          float dirY = vObjNormal.y;
          float crownBoost = 0.54 + 0.66 * smoothstep(-0.42, 0.90, dirY);
          float zenithFlare = pow(max(0.0, dirY), 2.2) * 0.55;

          float tightRim = exp(-outDist * 13.5);
          float midHalo  = exp(-outDist * 4.6);
          float wideAura = exp(-outDist * 2.1);

          vec3 colWhite  = vec3(1.00, 0.96, 1.00);
          vec3 colOrchid = vec3(0.76, 0.42, 1.00);
          vec3 colViolet = vec3(0.48, 0.16, 0.96);
          vec3 colDeep   = vec3(0.24, 0.05, 0.60);

          vec3 color =
            colWhite  * tightRim * (1.05 + zenithFlare) +
            colOrchid * midHalo  * 0.78 +
            colViolet * wideAura * 0.48 +
            colDeep   * wideAura * 0.25;

          float alpha = clamp((tightRim * 1.05 + midHalo * 0.62 + wideAura * 0.30) * crownBoost * outerFade, 0.0, 1.0);
          gl_FragColor = vec4(color * crownBoost * outerFade, alpha);
        }
      `,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.set(0, GLOBE_Y_OFFSET, 0);
    scene.add(haloMesh);

    // ------------------------------------------------------------------
    // 3. ROTATING GLOBE ROOT GROUP (Interactive Drag + Smooth Auto-Spin)
    // ------------------------------------------------------------------
    const globeRoot = new THREE.Group();
    globeRoot.position.set(0, GLOBE_Y_OFFSET, 0);
    // Start centered on Europe / Africa / Middle East (matching Image 1) and rotate smoothly into Asia / Australia (Image 2)!
    globeRoot.rotation.y = -0.28;
    globeRoot.rotation.x = 0.34;
    scene.add(globeRoot);

    // 3A. Pitch-Black Obsidian Core Sphere with Blazing Violet-White Fresnel Rim
    const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 0.996, 96, 96);
    const sphereMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        varying vec3 vWorldNormal;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vNormalView = normalize(normalMatrix * normal);
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        varying vec3 vWorldNormal;
        void main() {
          vec3 N = normalize(vNormalView);
          vec3 V = normalize(vViewPos);
          float ndotv = clamp(dot(N, V), 0.0, 1.0);
          float edge = 1.0 - ndotv;

          // Upper hemisphere atmospheric wash & blazing top-crown horizon
          float topGrad = smoothstep(-0.32, 0.96, N.y);
          float crownFocus = pow(max(0.0, N.y), 2.1);

          // Multi-band Fresnel profile:
          // Deep pure pitch-black center -> deep indigo -> vibrant electric violet -> white-hot horizon rim
          float deepWash = pow(edge, 2.2) * (0.55 + 0.55 * topGrad);
          float brightRim = pow(edge, 4.4) * (0.68 + 0.62 * topGrad);
          float hotEdge = pow(edge, 10.5) * (0.72 + 0.78 * topGrad);
          float topInnerGlow = smoothstep(0.28, 0.98, N.y) * pow(edge, 1.35) * 0.42;

          vec3 colObsidian = vec3(0.014, 0.008, 0.032);
          vec3 colIndigo   = vec3(0.22, 0.06, 0.52);
          vec3 colViolet   = vec3(0.54, 0.21, 0.96);
          vec3 colOrchid   = vec3(0.78, 0.48, 1.00);
          vec3 colWhite    = vec3(1.00, 0.96, 1.00);

          vec3 col = colObsidian;
          col += colIndigo * deepWash * 1.15;
          col += colViolet * (brightRim * 1.25 + topInnerGlow);
          col += colOrchid * pow(edge, 6.2) * (0.85 + 0.55 * crownFocus);
          col += colWhite * hotEdge * (1.2 + 0.65 * crownFocus);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    globeRoot.add(sphereMesh);

    // 3B. Real Natural Earth 1:110m High-Density Matrix Land Dots (~12,500 Crisp Dots!)
    const { data: maskData, width: maskW, height: maskH } = buildEarthLandMask();
    const hubVecs = GLOW_HUBS.map(h => ({
      vec: latLonToVec3(h.lat, h.lon, 1.0),
      intensity: h.intensity,
      radius: h.radius,
    }));

    const dotCoords: number[] = [];
    const dotSeeds: number[] = [];
    const dotHotspots: number[] = [];

    const LAT_ROWS = 164;
    const EQUATOR_COLS = 336;
    const DOT_RADIUS = GLOBE_RADIUS * 1.003;

    for (let r = 0; r < LAT_ROWS; r++) {
      // Span -58° (just below South America/NZ) to +78° (Greenland/Siberia)
      const latDeg = -58 + (r / (LAT_ROWS - 1)) * 136;
      const latRad = (latDeg * Math.PI) / 180;
      const cols = Math.max(12, Math.round(EQUATOR_COLS * Math.cos(latRad)));
      const my = Math.min(maskH - 1, Math.max(0, Math.floor(((90 - latDeg) / 180) * maskH)));

      for (let c = 0; c < cols; c++) {
        const lonDeg = -180 + ((c + 0.5) / cols) * 360;
        const mx = Math.min(maskW - 1, Math.max(0, Math.floor(((lonDeg + 180) / 360) * maskW)));
        const idx = (my * maskW + mx) * 4;
        if (maskData[idx] < 110) continue; // Ocean -> zero dots!

        const unitPos = latLonToVec3(latDeg, lonDeg, 1.0);
        dotCoords.push(unitPos.x * DOT_RADIUS, unitPos.y * DOT_RADIUS, unitPos.z * DOT_RADIUS);
        dotSeeds.push(0.72 + Math.random() * 0.28);

        let hotspot = 0;
        for (const h of hubVecs) {
          const dist = unitPos.distanceTo(h.vec);
          if (dist < h.radius) {
            const influence = Math.pow(1 - dist / h.radius, 1.8) * h.intensity;
            if (influence > hotspot) hotspot = influence;
          }
        }
        dotHotspots.push(Math.min(1.0, hotspot));
      }
    }

    const dotsGeo = new THREE.BufferGeometry();
    dotsGeo.setAttribute('position', new THREE.Float32BufferAttribute(dotCoords, 3));
    dotsGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(dotSeeds, 1));
    dotsGeo.setAttribute('aHotspot', new THREE.Float32BufferAttribute(dotHotspots, 1));

    const dotsMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: dpr },
        uDotScale: { value: 1.0 },
        uCameraZ: { value: 9.15 },
      },
      vertexShader: `
        attribute float aSeed;
        attribute float aHotspot;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uDotScale;
        uniform float uCameraZ;
        varying float vVisibility;
        varying float vHotspot;
        varying float vSeed;
        varying float vEdge;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vec3 N = normalize(normalMatrix * normalize(position));
          vec3 V = normalize(-mvPos.xyz);
          float ndotv = dot(N, V);

          gl_Position = projectionMatrix * mvPos;

          if (ndotv <= 0.015) {
            gl_PointSize = 0.0;
            vVisibility = 0.0;
            return;
          }

          // Smooth horizon foreshortening and subtle breathing on city clusters
          float pulse = 0.90 + 0.10 * sin(uTime * 1.9 + aSeed * 14.0);
          float horizonFade = smoothstep(0.015, 0.28, ndotv);
          vVisibility = horizonFade;
          vHotspot = aHotspot * pulse;
          vSeed = aSeed;
          vEdge = 1.0 - ndotv;

          float baseSize = mix(1.68, 2.55, horizonFade) + aHotspot * 0.62;
          gl_PointSize = baseSize * uPixelRatio * uDotScale * ((uCameraZ * 0.76) / max(-mvPos.z, 1.0));
        }
      `,
      fragmentShader: `
        varying float vVisibility;
        varying float vHotspot;
        varying float vSeed;
        varying float vEdge;
        void main() {
          if (vVisibility <= 0.005) discard;
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;

          // Razor-sharp crisp matrix dot with luminous center
          float shape = smoothstep(0.5, 0.22, d);

          vec3 colBase   = vec3(0.84, 0.77, 1.00);
          vec3 colRim    = vec3(0.75, 0.52, 1.00);
          vec3 colBright = vec3(1.00, 0.98, 1.00);

          vec3 col = mix(colBase, colRim, clamp(vEdge * 0.72, 0.0, 0.7));
          col = mix(col, colBright, clamp(vHotspot * 0.95 + (vSeed - 0.72) * 0.55, 0.0, 1.0));

          float alpha = shape * vVisibility * (0.68 + 0.22 * vSeed + 0.22 * vHotspot);
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.98));
        }
      `,
    });
    const dotsPoints = new THREE.Points(dotsGeo, dotsMat);
    globeRoot.add(dotsPoints);

    // 3C. Soft Electric-Violet City Hub Blooms Hugging the Continents (Sellix Holographic Depth!)
    const hubGlowTex = createRadialGlowTexture(
      'rgba(245, 224, 255, 0.58)',
      'rgba(168, 85, 247, 0.34)',
      'rgba(109, 40, 217, 0.10)'
    );
    const hubMeshes: Array<{ mesh: THREE.Mesh; unitDir: THREE.Vector3; baseOpacity: number }> = [];
    const hubPlaneGeo = new THREE.PlaneGeometry(1, 1);

    for (const h of GLOW_HUBS) {
      const unitDir = latLonToVec3(h.lat, h.lon, 1.0);
      const pos = unitDir.clone().multiplyScalar(GLOBE_RADIUS * 1.006);
      const mat = new THREE.MeshBasicMaterial({
        map: hubGlowTex,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.42 * h.intensity,
        side: THREE.FrontSide,
      });
      const decal = new THREE.Mesh(hubPlaneGeo, mat);
      decal.position.copy(pos);
      decal.scale.setScalar(h.radius * GLOBE_RADIUS * 1.15);
      decal.lookAt(unitDir.clone().multiplyScalar(GLOBE_RADIUS * 2.0));
      globeRoot.add(decal);
      hubMeshes.push({ mesh: decal, unitDir, baseOpacity: 0.42 * h.intensity });
    }

    // 3D. Four Unmistakable Luminous 3D Orbital Signal Arcs + Moving Comet Pulses + Pinpoint Rings!
    const beaconTex = createBeaconRingTexture();
    const cometTex = createRadialGlowTexture(
      'rgba(255, 255, 255, 1.0)',
      'rgba(233, 213, 255, 0.85)',
      'rgba(168, 85, 247, 0.25)'
    );
    const arcSpecs = [
      // Arc 1: Atlantic horizon sweeping cleanly into Cairo / Mediterranean
      { from: { lat: 12, lon: -58 }, to: { lat: 30, lon: 31 }, altitude: 1.28, speed: 0.27, phase: 0.0 },
      // Arc 2: Europe (London/Paris) sweeping gracefully into Riyadh / Mumbai
      { from: { lat: 50, lon: 2 }, to: { lat: 19, lon: 73 }, altitude: 1.25, speed: 0.24, phase: 0.35 },
      // Arc 3: Asia-Pacific sweeping cleanly from Mumbai to Tokyo
      { from: { lat: 19, lon: 73 }, to: { lat: 36, lon: 140 }, altitude: 1.27, speed: 0.26, phase: 0.65 },
      // Arc 4: Americas to Europe across North Atlantic
      { from: { lat: 41, lon: -74 }, to: { lat: 51, lon: 0 }, altitude: 1.26, speed: 0.23, phase: 0.18 },
    ];

    const arcDisposables: Array<{ dispose: () => void }> = [cometTex];
    const arcBeacons: Array<{ sprite: THREE.Sprite; unitDir: THREE.Vector3; phase: number }> = [];
    const arcComets: Array<{ sprite: THREE.Sprite; curve: THREE.CatmullRomCurve3; speed: number; phase: number }> = [];
    const arcPulseMaterials: THREE.ShaderMaterial[] = [];

    for (let aIdx = 0; aIdx < arcSpecs.length; aIdx++) {
      const spec = arcSpecs[aIdx];
      const start = latLonToVec3(spec.from.lat, spec.from.lon, GLOBE_RADIUS * 1.008);
      const end = latLonToVec3(spec.to.lat, spec.to.lon, GLOBE_RADIUS * 1.008);

      const mid1 = start.clone().lerp(end, 0.33).normalize().multiplyScalar(GLOBE_RADIUS * (1 + (spec.altitude - 1) * 0.88));
      const mid2 = start.clone().lerp(end, 0.67).normalize().multiplyScalar(GLOBE_RADIUS * spec.altitude);

      const curve = new THREE.CatmullRomCurve3([start, mid1, mid2, end]);
      const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.017, 6, false);
      arcDisposables.push(tubeGeo);

      const tubeMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: spec.phase },
          uSpeed: { value: spec.speed },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uPhase;
          uniform float uSpeed;
          varying vec2 vUv;
          void main() {
            float progress = fract(uTime * uSpeed + uPhase);
            // Smooth luminous comet tail trailing behind the moving light bead!
            float distBehind = fract(progress - vUv.x);
            float tail = exp(-distBehind * 6.5) * smoothstep(0.65, 0.0, distBehind);
            float head = exp(-pow((vUv.x - progress) * 14.0, 2.0));
            float endFade = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
            vec3 col = mix(vec3(0.74, 0.48, 1.0), vec3(1.0, 0.98, 1.0), clamp(0.32 + tail * 0.5 + head * 0.85, 0.0, 1.0));
            float alpha = (0.34 + tail * 0.55 + head * 0.65) * endFade;
            gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
          }
        `,
      });
      arcPulseMaterials.push(tubeMat);
      arcDisposables.push(tubeMat);

      const arcMesh = new THREE.Mesh(tubeGeo, tubeMat);
      globeRoot.add(arcMesh);

      // Moving incandescent comet bead gliding smoothly along the 3D arc!
      const cometMat = new THREE.SpriteMaterial({
        map: cometTex,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.95,
      });
      arcDisposables.push(cometMat);
      const cometSprite = new THREE.Sprite(cometMat);
      cometSprite.scale.setScalar(0.28);
      globeRoot.add(cometSprite);
      arcComets.push({ sprite: cometSprite, curve, speed: spec.speed, phase: spec.phase });

      // Pinpoint glowing target ring on landing hub
      const landing = spec.to;
      const landingUnit = latLonToVec3(landing.lat, landing.lon, 1.0);
      const spriteMat = new THREE.SpriteMaterial({
        map: beaconTex,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.96,
      });
      arcDisposables.push(spriteMat);
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(landingUnit.clone().multiplyScalar(GLOBE_RADIUS * 1.02));
      sprite.scale.setScalar(0.28);
      globeRoot.add(sprite);
      arcBeacons.push({ sprite, unitDir: landingUnit, phase: aIdx * 1.4 });
    }

    // ------------------------------------------------------------------
    // 4. RESPONSIVE FRAMING & INTERACTIVE DRAG-TO-SPIN PHYSICS
    // ------------------------------------------------------------------
    const updateCameraLayout = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const aspect = w / Math.max(h, 1);
      const isMobilePortrait = aspect < 0.88;

      renderer.setSize(w, h, false);
      camera.aspect = aspect;

      // Exact panoramic framing:
      // - Desktop: grand Sellix dome rising cleanly behind hero text (~16% from top)
      // - Mobile portrait: set slightly farther back & neatly positioned in lower half (~84% width)
      //   so BOTH curved violet glowing edges stay 100% visible below the compact mobile hero!
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(18));
      const responsiveZ = isMobilePortrait
        ? Math.min(22.5, Math.max(13.2, (GLOBE_RADIUS * 2.38) / (2 * tanHalfFov * Math.max(aspect, 0.42))))
        : aspect < 1.15
          ? 11.2
          : 9.15;

      const targetGlobeY = isMobilePortrait ? -2.15 : GLOBE_Y_OFFSET;
      globeRoot.position.y = targetGlobeY;
      haloMesh.position.y = targetGlobeY;

      camera.position.set(0, 0, responsiveZ);
      camera.updateProjectionMatrix();

      // Normalize dot pixel size across camera distances so mobile continents stay razor-sharp!
      dotsMat.uniforms.uCameraZ.value = responsiveZ;
      dotsMat.uniforms.uDotScale.value = isMobilePortrait ? 0.92 : 1.0;
    };

    updateCameraLayout();
    window.addEventListener('resize', updateCameraLayout);

    const drag = {
      active: false,
      lastX: 0,
      lastY: 0,
      velY: -0.00135, // Real Earth west-to-east rotation!
      velX: 0,
    };

    const onPointerDown = (e: PointerEvent) => {
      drag.active = true;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag.active) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.velY = dx * 0.0052;
      drag.velX = dy * 0.0038;
      globeRoot.rotation.y += drag.velY;
      globeRoot.rotation.x = Math.max(-0.48, Math.min(0.82, globeRoot.rotation.x + drag.velX));
    };
    const onPointerUp = () => {
      drag.active = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    // ------------------------------------------------------------------
    // 5. 60 FPS ANIMATION LOOP
    // ------------------------------------------------------------------
    let rafId = 0;
    const clock = new THREE.Clock();
    const worldDirTmp = new THREE.Vector3();
    const camDirTmp = new THREE.Vector3(0, 0, 1);

    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (!drag.active) {
        globeRoot.rotation.y += drag.velY;
        drag.velY += (-0.00135 - drag.velY) * 0.025;
        drag.velX *= 0.92;
        globeRoot.rotation.x = Math.max(-0.48, Math.min(0.82, globeRoot.rotation.x + drag.velX));
      }

      starMat.uniforms.uTime.value = t;
      dotsMat.uniforms.uTime.value = t;
      for (const m of arcPulseMaterials) {
        m.uniforms.uTime.value = t;
      }

      // Smoothly attenuate hub glows & beacon rings as they approach the globe's horizon
      const rotQuat = globeRoot.quaternion;
      for (const h of hubMeshes) {
        worldDirTmp.copy(h.unitDir).applyQuaternion(rotQuat);
        const ndotv = worldDirTmp.dot(camDirTmp);
        const vis = THREE.MathUtils.smoothstep(ndotv, 0.06, 0.45);
        (h.mesh.material as THREE.MeshBasicMaterial).opacity = h.baseOpacity * vis;
      }

      for (const b of arcBeacons) {
        worldDirTmp.copy(b.unitDir).applyQuaternion(rotQuat);
        const ndotv = worldDirTmp.dot(camDirTmp);
        const vis = THREE.MathUtils.smoothstep(ndotv, 0.05, 0.3);
        const pulse = 0.86 + 0.2 * Math.sin(t * 2.8 + b.phase);
        b.sprite.scale.setScalar(0.28 * pulse);
        (b.sprite.material as THREE.SpriteMaterial).opacity = 0.96 * vis;
      }

      // Advance glowing comet beads smoothly along each 3D orbital arc!
      for (const c of arcComets) {
        const u = (t * c.speed + c.phase) % 1;
        const pt = c.curve.getPointAt(u);
        c.sprite.position.copy(pt);
        worldDirTmp.copy(pt).normalize().applyQuaternion(rotQuat);
        const ndotv = worldDirTmp.dot(camDirTmp);
        const edgeFade = Math.sin(u * Math.PI);
        const vis = THREE.MathUtils.smoothstep(ndotv, -0.15, 0.2) * edgeFade;
        (c.sprite.material as THREE.SpriteMaterial).opacity = 0.96 * vis;
      }

      renderer.render(scene, camera);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateCameraLayout);
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      starGeo.dispose();
      starMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      dotsGeo.dispose();
      dotsMat.dispose();
      hubPlaneGeo.dispose();
      hubGlowTex.dispose();
      beaconTex.dispose();
      for (const h of hubMeshes) (h.mesh.material as THREE.Material).dispose();
      for (const d of arcDisposables) d.dispose();
      renderer.dispose();
      if (domEl.parentElement === container) {
        container.removeChild(domEl);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none"
      aria-hidden="true"
    />
  );
}
