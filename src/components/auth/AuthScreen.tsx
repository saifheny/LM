import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Radio, MessageCircle, Sparkles, X } from 'lucide-react';
import { Lang, UserProfile } from '../../types';
import { LmBrandMark, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { apiPost, setAuthToken } from '../../lib/api';

interface AuthScreenProps {
  users: UserProfile[];
  lang: Lang;
  onToggleLang: () => void;
  onAuthenticated: (u: UserProfile) => void;
}

/**
 * Analytic lightweight continent cluster mask so the 3D dotted globe forms recognizable glowing world landmasses!
 */
function isApproxLand(latDeg: number, lonDeg: number): boolean {
  const regions: Array<[number, number, number, number]> = [
    // Africa & Middle East
    [12, 20, 26, 24],
    [-16, 24, 20, 14],
    [24, 44, 14, 18],
    // Europe
    [49, 14, 13, 24],
    [60, 22, 9, 18],
    // Asia
    [46, 86, 22, 42],
    [24, 102, 16, 24],
    [20, 78, 12, 10],
    // North America
    [45, -100, 20, 32],
    [24, -102, 10, 12],
    // South America
    [-14, -60, 24, 16],
    [-38, -68, 14, 8],
    // Australia
    [-25, 134, 11, 18],
  ];
  for (const [cLat, cLon, rLat, rLon] of regions) {
    const dLat = (latDeg - cLat) / rLat;
    const dLon = (lonDeg - cLon) / rLon;
    if (dLat * dLat + dLon * dLon <= 1.0) return true;
  }
  return false;
}

interface GlobePoint {
  x: number;
  y: number;
  z: number;
  land: boolean;
  bright: number;
}

/**
 * 60 FPS Interactive 3D Dotted Cosmic Planet Canvas (Inspired by the reference space globe!)
 * - Drag with mouse or touch to spin interactively with smooth inertia
 * - Subtle pointer tilt + luminous violet horizon atmosphere glow + animated live orbital signal arcs
 */
function InteractiveLmPlanet() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0, velX: 0.0022, tiltX: 0.24 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Precompute 1,450 Fibonacci-sphere points for silky-smooth 60 FPS projection
    const NUM_POINTS = 1450;
    const points: GlobePoint[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NUM_POINTS; i++) {
      const y = 1 - (i / (NUM_POINTS - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      const latDeg = Math.asin(y) * (180 / Math.PI);
      const lonDeg = Math.atan2(z, x) * (180 / Math.PI);
      const land = isApproxLand(latDeg, lonDeg);
      points.push({ x, y, z, land, bright: 0.55 + Math.random() * 0.45 });
    }

    // Background cosmic stars
    const stars = Array.from({ length: 150 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 1.35,
      phase: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.025,
    }));

    // Live animated signal arcs between glowing nodes on the globe
    const arcSpecs = [
      { lat1: 30, lon1: 31, lat2: 51, lon2: 0, phase: 0.0 },     // Cairo -> London
      { lat1: 24, lon1: 46, lat2: 35, lon2: 139, phase: 0.35 },  // Riyadh -> Tokyo
      { lat1: 30, lon1: 31, lat2: 40, lon2: -74, phase: 0.68 },  // Cairo -> New York
      { lat1: 25, lon1: 55, lat2: -23, lon2: -46, phase: 0.18 }, // Dubai -> Sao Paulo
    ];

    function latLonToVec(latDeg: number, lonDeg: number) {
      const lat = (latDeg * Math.PI) / 180;
      const lon = (lonDeg * Math.PI) / 180;
      return {
        x: Math.cos(lat) * Math.cos(lon),
        y: Math.sin(lat),
        z: Math.cos(lat) * Math.sin(lon),
      };
    }

    let rotY = 0.8;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let tick = 0;
    const render = () => {
      tick += 0.008;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      // 1. Deep Obsidian Space Backdrop
      ctx.fillStyle = '#040407';
      ctx.fillRect(0, 0, w, h);

      // 2. Twinkling Starfield
      for (const s of stars) {
        s.phase += s.speed;
        const alpha = 0.18 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase));
        ctx.fillStyle = `rgba(235, 230, 255, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Giant Horizon Planet Geometry (Matches the dramatic lower-centered dome composition!)
      const R = Math.min(w * 0.58, h * 0.64, 520);
      const cx = w * 0.5;
      const cy = h * 0.72;

      // Update interactive inertia rotation
      if (!dragRef.current.active) {
        rotY += dragRef.current.velX;
        dragRef.current.velX += (0.0022 - dragRef.current.velX) * 0.03;
      }
      const tiltX = dragRef.current.tiltX;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(tiltX);
      const sinX = Math.sin(tiltX);

      // 4. Outer Atmospheric Halo Glow
      const outerHalo = ctx.createRadialGradient(cx, cy, R * 0.84, cx, cy, R * 1.24);
      outerHalo.addColorStop(0, 'rgba(139, 92, 246, 0.42)');
      outerHalo.addColorStop(0.45, 'rgba(124, 58, 237, 0.18)');
      outerHalo.addColorStop(1, 'rgba(4, 4, 7, 0)');
      ctx.fillStyle = outerHalo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.24, 0, Math.PI * 2);
      ctx.fill();

      // 5. Planet Core Sphere & Luminous Top Atmosphere Rim
      const sphereGrad = ctx.createRadialGradient(cx, cy - R * 0.65, R * 0.08, cx, cy, R);
      sphereGrad.addColorStop(0, 'rgba(167, 139, 250, 0.34)');
      sphereGrad.addColorStop(0.42, 'rgba(59, 24, 128, 0.36)');
      sphereGrad.addColorStop(0.84, 'rgba(12, 8, 24, 0.94)');
      sphereGrad.addColorStop(1, 'rgba(196, 181, 253, 0.55)');
      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Crisp Glowing Horizon Rim Stroke
      const rimGrad = ctx.createLinearGradient(cx, cy - R, cx, cy + R * 0.4);
      rimGrad.addColorStop(0, 'rgba(233, 213, 255, 0.95)');
      rimGrad.addColorStop(0.38, 'rgba(139, 92, 246, 0.72)');
      rimGrad.addColorStop(1, 'rgba(76, 29, 149, 0.08)');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // 6. Project 3D Dotted World Matrix
      const project = (vx: number, vy: number, vz: number) => {
        const x1 = vx * cosY - vz * sinY;
        const z1 = vx * sinY + vz * cosY;
        const y2 = vy * cosX - z1 * sinX;
        const z2 = vy * sinX + z1 * cosX;
        return { px: cx + x1 * R, py: cy - y2 * R, z: z2 };
      };

      for (const pt of points) {
        const { px, py, z } = project(pt.x, pt.y, pt.z);
        if (z < -0.08) continue;
        const depth = Math.max(0, Math.min(1, (z + 0.08) / 1.08));
        if (pt.land) {
          const r = 1.15 + depth * 1.55;
          const alpha = (0.28 + depth * 0.72) * pt.bright;
          ctx.fillStyle = depth > 0.72 ? `rgba(243, 232, 255, ${alpha.toFixed(2)})` : `rgba(192, 132, 252, ${alpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const alpha = 0.06 + depth * 0.14;
          ctx.fillStyle = `rgba(139, 92, 246, ${alpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(px, py, 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 7. Animated Glowing Orbital Signal Arcs Across the Globe!
      for (const arc of arcSpecs) {
        const a = latLonToVec(arc.lat1, arc.lon1);
        const b = latLonToVec(arc.lat2, arc.lon2);
        const pa = project(a.x, a.y, a.z);
        const pb = project(b.x, b.y, b.z);
        if (pa.z < 0 && pb.z < 0) continue;

        const midX = (a.x + b.x) * 0.5 * 1.36;
        const midY = (a.y + b.y) * 0.5 * 1.36;
        const midZ = (a.z + b.z) * 0.5 * 1.36;
        const pm = project(midX, midY, midZ);

        const grad = ctx.createLinearGradient(pa.px, pa.py, pb.px, pb.py);
        grad.addColorStop(0, 'rgba(196, 181, 253, 0.12)');
        grad.addColorStop(0.5, 'rgba(233, 213, 255, 0.82)');
        grad.addColorStop(1, 'rgba(167, 139, 250, 0.18)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(pa.px, pa.py);
        ctx.quadraticCurveTo(pm.px, pm.py, pb.px, pb.py);
        ctx.stroke();

        // Moving luminous pulse packet traveling along the Bezier arc!
        const t = (tick * 0.55 + arc.phase) % 1;
        const inv = 1 - t;
        const tx = inv * inv * pa.px + 2 * inv * t * pm.px + t * t * pb.px;
        const ty = inv * inv * pa.py + 2 * inv * t * pm.py + t * t * pb.py;

        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#C084FC';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(tx, ty, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Glowing endpoint beacons
        if (pa.z > 0.05) {
          ctx.fillStyle = 'rgba(245, 208, 254, 0.9)';
          ctx.beginPath();
          ctx.arc(pa.px, pa.py, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
        if (pb.z > 0.05) {
          ctx.fillStyle = 'rgba(245, 208, 254, 0.9)';
          ctx.beginPath();
          ctx.arc(pb.px, pb.py, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={e => {
        dragRef.current.active = true;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
      }}
      onPointerMove={e => {
        if (dragRef.current.active) {
          const dx = e.clientX - dragRef.current.lastX;
          const dy = e.clientY - dragRef.current.lastY;
          dragRef.current.velX = dx * 0.0055;
          dragRef.current.tiltX = Math.max(-0.55, Math.min(0.65, dragRef.current.tiltX + dy * 0.003));
          dragRef.current.lastX = e.clientX;
          dragRef.current.lastY = e.clientY;
        }
      }}
      onPointerUp={() => {
        dragRef.current.active = false;
      }}
      onPointerLeave={() => {
        dragRef.current.active = false;
      }}
      className="fixed inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none"
    />
  );
}

export function AuthScreen({ users, lang, onToggleLang, onAuthenticated }: AuthScreenProps) {
  const [registerInlineOpen, setRegisterInlineOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [submittingName, setSubmittingName] = useState(false);
  const [enteringGuest, setEnteringGuest] = useState(false);
  const [inlineErr, setInlineErr] = useState('');

  // Optional Login Modal for returning users
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const normalizedWords = nameInput.trim().split(/\s+/).filter(Boolean);
  const wordCount = normalizedWords.length;
  const tooManyWords = wordCount > 3;

  const ForwardIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  async function handleQuickNameRegister(e: React.FormEvent) {
    e.preventDefault();
    setInlineErr('');
    const clean = nameInput.trim().replace(/\s+/g, ' ');
    if (clean.length < 2) {
      setInlineErr(lang === 'en' ? 'Please enter your name.' : 'يرجى كتابة اسمك أولًا.');
      return;
    }
    if (clean.split(' ').filter(Boolean).length > 3) {
      setInlineErr(
        lang === 'en'
          ? 'Maximum 3 words allowed (first, middle, last).'
          : 'الاسم يجب ألا يتعدى 3 كلمات (الاسم الثلاثي كحد أقصى).'
      );
      return;
    }
    setSubmittingName(true);
    try {
      const res = await apiPost<{ ok: boolean; user: UserProfile; token?: string }>('/api/auth/quick-register', {
        displayName: clean,
      });
      if (res.token) setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setInlineErr(err instanceof Error ? err.message : lang === 'en' ? 'Could not register' : 'تعذر التسجيل الآن.');
    } finally {
      setSubmittingName(false);
    }
  }

  async function handleEnterAsGuest() {
    if (enteringGuest) return;
    setEnteringGuest(true);
    setInlineErr('');
    try {
      const res = await apiPost<{ ok: boolean; user: UserProfile; token?: string }>('/api/auth/guest', {});
      if (res.token) setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setInlineErr(err instanceof Error ? err.message : lang === 'en' ? 'Connection error' : 'تعذر الدخول التجريبي.');
    } finally {
      setEnteringGuest(false);
    }
  }

  async function handleReturningLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginUsername.trim() || loggingIn) return;
    setLoginErr('');
    setLoggingIn(true);
    try {
      const res = await apiPost<{ ok: boolean; user: UserProfile; token?: string }>('/api/auth/login', {
        username: loginUsername.trim(),
        password: loginPassword,
      });
      if (res.token) setAuthToken(res.token);
      setLoginModalOpen(false);
      onAuthenticated(res.user);
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : lang === 'en' ? 'Sign in failed' : 'تعذر تسجيل الدخول.');
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="relative min-h-screen w-full overflow-hidden bg-[#040407] text-[#F5F5F7] flex flex-col justify-between select-none"
    >
      {/* Interactive 3D Rotating Luminous Space Planet Background */}
      <InteractiveLmPlanet />

      {/* Top Navigation Bar — ONLY LM Brand + Auth Actions (ZERO 5 middle links!) */}
      <header className="relative z-20 w-full max-w-[1180px] mx-auto px-5 sm:px-8 pt-5 sm:pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LmBrandMark size={34} />
          <span className="text-lg font-extrabold tracking-tight text-white">LM</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onToggleLang}
            className="h-9 px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-mono-num text-[#D4D4D8] hover:text-white cursor-pointer transition-colors"
          >
            {lang === 'ar' ? 'EN' : 'AR'}
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginErr('');
              setLoginModalOpen(true);
            }}
            className="h-9 px-4 rounded-full bg-black/50 hover:bg-white/[0.1] backdrop-blur-xl border border-white/[0.14] text-xs font-medium text-white cursor-pointer transition-colors"
          >
            {lang === 'en' ? 'Sign In' : 'دخول'}
          </button>

          <button
            type="button"
            onClick={() => {
              setRegisterInlineOpen(true);
              setInlineErr('');
            }}
            className="h-9 px-4 rounded-full bg-white hover:bg-[#E4E4E7] text-black text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-[0_6px_22px_rgba(255,255,255,0.2)]"
          >
            <span>{lang === 'en' ? 'Sign Up' : 'تسجيل'}</span>
            <ForwardIcon className="w-3.5 h-3.5" strokeWidth={2.4} />
          </button>
        </div>
      </header>

      {/* Center Cosmic Hero Overlay Above the Interactive Planet */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-5 text-center pb-16 sm:pb-24 pointer-events-none">
        <div className="max-w-[660px] mx-auto space-y-5 pointer-events-auto">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.15] text-white drop-shadow-[0_6px_32px_rgba(0,0,0,0.65)]"
          >
            {lang === 'en' ? (
              <>
                Your Digital World
                <br />
                In One Space
              </>
            ) : (
              <>
                عالمك الرقمي
                <br />
                في منصة واحدة
              </>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="text-xs sm:text-[15px] text-white/75 max-w-[490px] mx-auto leading-relaxed drop-shadow"
          >
            {lang === 'en'
              ? 'Community, Pulse short videos, Live streams, Voice calls, Instant Chat, and LM AI — all connected seamlessly on one interactive world.'
              : 'المجتمع، نبض، البث المباشر، المكالمات الصوتية، الدردشة الفورية، وLM AI — عالم تفاعلي واحد يجمعك بأصدقائك بلا حدود.'}
          </motion.p>

          {/* Morphing CTA Zone: Two Pills ("تسجيل" + "مشاهدة الموقع") <-> Inline 3-Word Name Input + Next Arrow */}
          <div className="pt-2 min-h-[82px] flex flex-col items-center justify-start">
            <AnimatePresence mode="wait">
              {!registerInlineOpen ? (
                <motion.div
                  key="cta_buttons"
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.22 }}
                  className="flex items-center justify-center gap-3 flex-wrap"
                >
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setRegisterInlineOpen(true);
                      setInlineErr('');
                    }}
                    className="h-12 px-7 rounded-full bg-white hover:bg-[#F2F2F5] text-black text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-[0_12px_36px_rgba(255,255,255,0.22)] transition-colors"
                  >
                    <span>{lang === 'en' ? 'Sign Up' : 'تسجيل'}</span>
                    <ForwardIcon className="w-4 h-4" strokeWidth={2.5} />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    disabled={enteringGuest}
                    onClick={handleEnterAsGuest}
                    className="h-12 px-7 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-xl border border-white/[0.2] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer shadow-[0_12px_36px_rgba(0,0,0,0.55)] transition-colors disabled:opacity-60"
                  >
                    <span>
                      {enteringGuest
                        ? lang === 'en'
                          ? 'Entering...'
                          : 'جارٍ الدخول...'
                        : lang === 'en'
                          ? 'Explore Site'
                          : 'مشاهدة الموقع'}
                    </span>
                    <ForwardIcon className="w-4 h-4 text-white/80" strokeWidth={2.2} />
                  </motion.button>
                </motion.div>
              ) : (
                <motion.form
                  key="name_input_box"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  onSubmit={handleQuickNameRegister}
                  className="w-full max-w-[410px] mx-auto space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex-1 h-12 rounded-full bg-[#0C0C14]/88 backdrop-blur-2xl border px-4 flex items-center gap-2 shadow-[0_16px_44px_rgba(0,0,0,0.65)] transition-colors ${
                        tooManyWords
                          ? 'border-[#FB7185]/70'
                          : 'border-white/[0.22] focus-within:border-[#C084FC]/80'
                      }`}
                    >
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={e => {
                          setNameInput(e.target.value);
                          setInlineErr('');
                        }}
                        placeholder={
                          lang === 'en'
                            ? 'Enter your name (max 3 words)...'
                            : 'اكتب اسمك هنا (بحد أقصى ثلاثي)...'
                        }
                        className="flex-1 bg-transparent text-sm text-white placeholder:text-white/50 outline-none min-w-0"
                      />
                      <span
                        className={`text-[10.5px] font-mono-num shrink-0 ${
                          tooManyWords ? 'text-[#FB7185] font-bold' : 'text-white/45'
                        }`}
                      >
                        {wordCount}/3
                      </span>
                    </div>

                    {/* Next / Advance Circular Action Button Right Beside the Name Container */}
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.92 }}
                      disabled={submittingName || tooManyWords || nameInput.trim().length < 2}
                      title={lang === 'en' ? 'Continue to LM' : 'التالي والدخول للمنصة'}
                      className="w-12 h-12 rounded-full bg-white hover:bg-[#F2F2F5] text-black flex items-center justify-center shrink-0 cursor-pointer shadow-[0_10px_30px_rgba(255,255,255,0.28)] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      {submittingName ? (
                        <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      ) : (
                        <ForwardIcon className="w-5 h-5" strokeWidth={2.5} />
                      )}
                    </motion.button>
                  </div>

                  {tooManyWords ? (
                    <div className="text-[11.5px] text-[#FDA4AF] font-medium">
                      {lang === 'en'
                        ? 'Maximum 3 words allowed for your name.'
                        : 'الحد الأقصى هو الاسم الثلاثي فقط (3 كلمات).'}
                    </div>
                  ) : inlineErr ? (
                    <div className="text-[11.5px] text-[#FDA4AF] font-medium">{inlineErr}</div>
                  ) : (
                    <div className="flex items-center justify-center gap-4 text-[11px] text-white/60">
                      <button
                        type="button"
                        onClick={() => {
                          setRegisterInlineOpen(false);
                          setInlineErr('');
                        }}
                        className="hover:text-white cursor-pointer transition-colors"
                      >
                        {lang === 'en' ? 'Back' : 'رجوع'}
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        disabled={enteringGuest}
                        onClick={handleEnterAsGuest}
                        className="hover:text-white cursor-pointer transition-colors"
                      >
                        {lang === 'en' ? 'Or explore without signing up' : 'أو تصفّح مباشرة بحساب تجريبي'}
                      </button>
                    </div>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Live Floating Interactive Activity Pings Over the Rotating Planet (Matches reference floating event cards!) */}
        <div className="pointer-events-none hidden sm:flex items-center justify-between w-full max-w-[760px] mt-10 px-4">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            className="px-3.5 py-2.5 rounded-2xl bg-[#11101C]/75 backdrop-blur-xl border border-[#C084FC]/25 shadow-2xl flex items-center gap-2.5 text-start"
          >
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#EF4444] to-[#F97316] text-white flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4" />
            </span>
            <div>
              <div className="text-[11.5px] font-semibold text-white">
                {lang === 'en' ? 'Live Broadcast' : 'بث مباشر نشط الآن'}
              </div>
              <div className="text-[10px] text-white/60">
                {lang === 'en' ? 'Cairo • 4.8K watching' : 'القاهرة • 4.8K مشاهد'}
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            className="px-3.5 py-2.5 rounded-2xl bg-[#11101C]/75 backdrop-blur-xl border border-[#C084FC]/25 shadow-2xl flex items-center gap-2.5 text-start"
          >
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#10B981] to-[#34D399] text-black flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4" />
            </span>
            <div>
              <div className="text-[11.5px] font-semibold text-white">
                {lang === 'en' ? 'Instant Voice & Chat' : 'دردشة ومكالمات فورية'}
              </div>
              <div className="text-[10px] text-white/60 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-[#C084FC]" />
                <span>{lang === 'en' ? 'Powered by LM AI' : 'مدعوم بـ LM AI'}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Subtle Bottom Drag Hint */}
      <footer className="relative z-20 pb-5 px-6 text-center pointer-events-none">
        <span className="text-[10.5px] text-white/40 font-mono-num">
          {lang === 'en' ? 'LM 2026 · Drag planet to interact' : 'LM 2026 · اسحب الكوكب للتفاعل'}
        </span>
      </footer>

      {/* Returning Member Sign-In Modal (Opened from top-bar "دخول") */}
      <AnimatePresence>
        {loginModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLoginModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/78 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-[420px] rounded-t-[28px] sm:rounded-[28px] bg-[#121219]/98 border-t sm:border border-white/[0.14] p-5 space-y-4 shadow-2xl text-start"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
                <span className="text-sm font-bold text-white">
                  {lang === 'en' ? 'Sign in to LM' : 'تسجيل الدخول إلى LM'}
                </span>
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleReturningLogin} className="space-y-3">
                <input
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  placeholder={lang === 'en' ? 'Username (@handle)' : 'اسم المستخدم (مثال: youssef)'}
                  className="w-full h-11 rounded-2xl bg-[#09090D] border border-white/[0.1] px-4 text-xs text-white placeholder:text-[#63636C] outline-none focus:border-[#C084FC]/60"
                />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder={lang === 'en' ? 'Password' : 'كلمة المرور'}
                  className="w-full h-11 rounded-2xl bg-[#09090D] border border-white/[0.1] px-4 text-xs text-white placeholder:text-[#63636C] outline-none focus:border-[#C084FC]/60"
                />
                {loginErr && <div className="text-xs text-[#FB7185] px-1">{loginErr}</div>}
                <button
                  type="submit"
                  disabled={loggingIn || !loginUsername.trim()}
                  className="w-full h-11 rounded-full bg-white hover:bg-[#E4E4E7] text-black text-xs font-bold cursor-pointer disabled:opacity-45 transition-colors"
                >
                  {loggingIn ? (lang === 'en' ? 'Signing in...' : 'جارٍ الدخول...') : lang === 'en' ? 'Sign In' : 'دخول'}
                </button>
              </form>

              {users.length > 0 && (
                <div className="pt-2 border-t border-white/[0.08] space-y-2">
                  <div className="text-[11px] text-[#8E8E93]">
                    {lang === 'en' ? 'Quick access accounts' : 'أو الدخول السريع بحساب جاهز'}
                  </div>
                  <div className="max-h-[160px] overflow-y-auto divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-[#0B0B10]">
                    {users.slice(0, 5).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setLoginModalOpen(false);
                          onAuthenticated(u);
                        }}
                        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-white/[0.05] text-start cursor-pointer transition-colors"
                      >
                        <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate flex items-center gap-1">
                            <span>{u.displayName}</span>
                            {u.verified && <VerifiedIcon />}
                          </div>
                          <div className="text-[10.5px] text-[#7A7A85] font-mono-num truncate">@{u.username}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
