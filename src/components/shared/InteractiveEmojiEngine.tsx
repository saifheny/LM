import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export interface InteractiveEmojiDef {
  id: string;
  src: string;
  unicode: string;
  labelAr: string;
  labelEn: string;
  fxType: 'fire' | 'bolt' | 'rocket' | 'crown' | 'gem' | 'shockwave' | 'party';
  glow: string;
}

export const INTERACTIVE_EMOJIS: InteractiveEmojiDef[] = [
  { id: 'fire', src: '/uploads/emojis/fire.png', unicode: '🔥', labelAr: 'لهب بلازما', labelEn: 'Plasma Fire', fxType: 'fire', glow: '#FF6B00' },
  { id: 'bolt', src: '/uploads/emojis/bolt.png', unicode: '⚡', labelAr: 'صاعقة كهربائية', labelEn: 'Lightning', fxType: 'bolt', glow: '#38BDF8' },
  { id: 'rocket', src: '/uploads/emojis/rocket.png', unicode: '🚀', labelAr: 'إطلاق صاروخي', labelEn: 'Warp Launch', fxType: 'rocket', glow: '#F97316' },
  { id: 'heartfire', src: '/uploads/emojis/heartfire.png', unicode: '❤️‍🔥', labelAr: 'قلب مشتعل', labelEn: 'Heart on Fire', fxType: 'fire', glow: '#FF2D55' },
  { id: 'mindblown', src: '/uploads/emojis/mindblown.png', unicode: '🤯', labelAr: 'صدمة كونية', labelEn: 'Mind Blown', fxType: 'shockwave', glow: '#A855F7' },
  { id: 'starstruck', src: '/uploads/emojis/starstruck.png', unicode: '🤩', labelAr: 'انبهار نجمي', labelEn: 'Star Struck', fxType: 'crown', glow: '#F5C451' },
  { id: 'crown', src: '/uploads/emojis/crown.png', unicode: '👑', labelAr: 'تاج إمبراطوري', labelEn: 'Imperial Crown', fxType: 'crown', glow: '#F5C451' },
  { id: 'gem', src: '/uploads/emojis/gem.png', unicode: '💎', labelAr: 'كريستال ماسي', labelEn: 'Prism Diamond', fxType: 'gem', glow: '#22D3EE' },
  { id: 'party', src: '/uploads/emojis/party.png', unicode: '🎉', labelAr: 'احتفال', labelEn: 'Celebration', fxType: 'party', glow: '#EC4899' },
  { id: 'laugh', src: '/uploads/emojis/laugh.png', unicode: '😂', labelAr: 'ضحك هستيري', labelEn: 'LOL', fxType: 'party', glow: '#FACC15' },
  { id: 'cool', src: '/uploads/emojis/cool.png', unicode: '😎', labelAr: 'رايق', labelEn: 'Cool', fxType: 'shockwave', glow: '#3B82F6' },
  { id: 'ghost', src: '/uploads/emojis/ghost.png', unicode: '👻', labelAr: 'شبح طيفي', labelEn: 'Phantom', fxType: 'shockwave', glow: '#C084FC' },
  { id: 'alien', src: '/uploads/emojis/alien.png', unicode: '👽', labelAr: 'فضائي', labelEn: 'Alien', fxType: 'shockwave', glow: '#10B981' },
  { id: 'clap', src: '/uploads/emojis/clap.png', unicode: '👏', labelAr: 'تصفيق', labelEn: 'Applause', fxType: 'party', glow: '#FBBF24' },
  { id: 'hundred', src: '/uploads/emojis/hundred.png', unicode: '💯', labelAr: 'مية في المية', labelEn: '100%', fxType: 'fire', glow: '#EF4444' },
  { id: 'target', src: '/uploads/emojis/target.webp', unicode: '🎯', labelAr: 'إصابة الهدف', labelEn: 'Bullseye', fxType: 'gem', glow: '#F43F5E' },
  { id: 'dice', src: '/uploads/emojis/dice.png', unicode: '🎲', labelAr: 'نرد تفاعلي', labelEn: 'Dice', fxType: 'party', glow: '#A78BFA' },
  { id: 'slot', src: '/uploads/emojis/slot.png', unicode: '🎰', labelAr: 'ماكينة الحظ', labelEn: 'Jackpot', fxType: 'crown', glow: '#F59E0B' },
];

export const EMOJI_MAP: Record<string, InteractiveEmojiDef> = Object.fromEntries(
  INTERACTIVE_EMOJIS.map(e => [e.id, e])
);

// Also allow lookup by unicode fallback
export function findEmojiDef(idOrUnicode: string): InteractiveEmojiDef | null {
  if (EMOJI_MAP[idOrUnicode]) return EMOJI_MAP[idOrUnicode];
  return INTERACTIVE_EMOJIS.find(e => e.unicode === idOrUnicode) || null;
}

/** Synthesize crisp tactile Web Audio API SFX tailored to each interactive emoji */
export function playInteractiveSound(fxType: InteractiveEmojiDef['fxType'] | 'tick' | 'spoiler') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (fxType === 'bolt') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.22);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (fxType === 'crown' || fxType === 'gem' || fxType === 'party') {
      const notes = fxType === 'gem' ? [880, 1174, 1568, 2093] : [523, 659, 784, 1046];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.045);
        gain.gain.setValueAtTime(0.09, now + i * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.045);
        osc.stop(now + i * 0.045 + 0.36);
      });
    } else if (fxType === 'rocket' || fxType === 'fire') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.32);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.37);
    } else if (fxType === 'tick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
    } else {
      // Shockwave / Spoiler pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.34);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    }
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // ignore autoplay policies
  }
}

/** Fire a global 60fps interactive full-screen particle & physics animation from anywhere! */
export function triggerInteractiveFx(emojiId: string, x?: number, y?: number) {
  const def = findEmojiDef(emojiId) || INTERACTIVE_EMOJIS[0];
  playInteractiveSound(def.fxType);
  window.dispatchEvent(
    new CustomEvent('lm:fx', {
      detail: {
        emojiId: def.id,
        fxType: def.fxType,
        glow: def.glow,
        x: x ?? window.innerWidth / 2,
        y: y ?? window.innerHeight / 2,
      },
    })
  );
}

/** Renders a glossy 3D Animated Fluent / Noto Emoji image */
export function AnimatedEmoji({
  id,
  size = 32,
  className = '',
  interactive = false,
  onTrigger,
}: {
  id: string;
  size?: number;
  className?: string;
  interactive?: boolean;
  onTrigger?: (e: React.MouseEvent) => void;
}) {
  const def = findEmojiDef(id);
  const [failed, setFailed] = useState(false);

  if (!def || failed) {
    return (
      <span style={{ fontSize: size * 0.78, lineHeight: 1 }} className={`inline-block select-none ${className}`}>
        {def?.unicode || id}
      </span>
    );
  }

  return (
    <motion.img
      src={def.src}
      alt={def.labelEn}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      whileHover={interactive ? { scale: 1.15, rotate: [0, -6, 6, 0] } : undefined}
      whileTap={interactive ? { scale: 0.82 } : undefined}
      onClick={onTrigger}
      style={{
        width: size,
        height: size,
        filter: interactive ? `drop-shadow(0 8px 24px ${def.glow}66)` : undefined,
      }}
      className={`object-contain select-none inline-block ${interactive ? 'cursor-pointer' : ''} ${className}`}
      draggable={false}
    />
  );
}

/**
 * Full-Screen 60fps Canvas Physics Overlay (mounted once in App.tsx)
 * Renders plasma embers, forked lightning bolts, warp rockets, diamond shards & shockwaves!
 */
export function InteractiveFxOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    type Particle = {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; alpha: number; decay: number;
      shape: 'orb' | 'diamond' | 'ring' | 'star' | 'streak';
      rot: number; vrot: number;
    };
    type Bolt = { points: Array<[number, number]>; alpha: number; color: string };

    const particles: Particle[] = [];
    const bolts: Bolt[] = [];

    const spawnBolt = (ox: number, oy: number) => {
      for (let b = 0; b < 4; b++) {
        const pts: Array<[number, number]> = [[ox, oy]];
        let cx = ox;
        let cy = oy;
        const angle = (Math.PI * 2 * b) / 4 + (Math.random() - 0.5) * 0.7;
        for (let s = 0; s < 9; s++) {
          cx += Math.cos(angle) * (35 + Math.random() * 40) + (Math.random() - 0.5) * 35;
          cy += Math.sin(angle) * (35 + Math.random() * 40) + (Math.random() - 0.5) * 35;
          pts.push([cx, cy]);
        }
        bolts.push({ points: pts, alpha: 1, color: b % 2 === 0 ? '#38BDF8' : '#E0F2FE' });
      }
    };

    const onFx = (ev: Event) => {
      const { fxType, x, y } = (ev as CustomEvent).detail as {
        fxType: InteractiveEmojiDef['fxType'];
        x: number;
        y: number;
      };

      if (fxType === 'bolt' || fxType === 'shockwave' || fxType === 'rocket') {
        setShaking(true);
        setTimeout(() => setShaking(false), 260);
      }

      if (fxType === 'fire') {
        const colors = ['#FF2D55', '#FF6B00', '#F5C451', '#FEF08A'];
        for (let i = 0; i < 65; i++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
          const spd = 2.5 + Math.random() * 8.5;
          particles.push({
            x: x + (Math.random() - 0.5) * 40,
            y: y + (Math.random() - 0.5) * 20,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 2,
            size: 3 + Math.random() * 8,
            color: colors[i % colors.length],
            alpha: 1,
            decay: 0.016 + Math.random() * 0.014,
            shape: 'orb',
            rot: 0,
            vrot: 0,
          });
        }
      } else if (fxType === 'bolt') {
        spawnBolt(x, y);
        for (let i = 0; i < 45; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 3 + Math.random() * 11;
          particles.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            size: 2 + Math.random() * 5,
            color: i % 2 === 0 ? '#38BDF8' : '#FFFFFF',
            alpha: 1,
            decay: 0.025,
            shape: 'streak',
            rot: ang,
            vrot: 0,
          });
        }
      } else if (fxType === 'rocket') {
        for (let i = 0; i < 70; i++) {
          particles.push({
            x: x + (Math.random() - 0.5) * 30,
            y: y + Math.random() * 50,
            vx: (Math.random() - 0.5) * 4,
            vy: -6 - Math.random() * 14,
            size: 3 + Math.random() * 7,
            color: i % 3 === 0 ? '#F97316' : i % 3 === 1 ? '#FDE047' : '#38BDF8',
            alpha: 1,
            decay: 0.015,
            shape: 'orb',
            rot: 0,
            vrot: 0,
          });
        }
      } else if (fxType === 'gem') {
        const colors = ['#22D3EE', '#818CF8', '#F472B6', '#FFFFFF'];
        for (let i = 0; i < 50; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 2.5 + Math.random() * 9;
          particles.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 1.5,
            size: 6 + Math.random() * 9,
            color: colors[i % colors.length],
            alpha: 1,
            decay: 0.016,
            shape: 'diamond',
            rot: Math.random() * Math.PI,
            vrot: (Math.random() - 0.5) * 0.25,
          });
        }
      } else if (fxType === 'shockwave') {
        for (let r = 0; r < 3; r++) {
          particles.push({
            x, y, vx: 0, vy: 0,
            size: 16 + r * 28,
            color: r === 0 ? '#A855F7' : r === 1 ? '#38BDF8' : '#EC4899',
            alpha: 0.95,
            decay: 0.022,
            shape: 'ring',
            rot: 0,
            vrot: 0,
          });
        }
        for (let i = 0; i < 42; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 3 + Math.random() * 8;
          particles.push({
            x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
            size: 3 + Math.random() * 6,
            color: i % 2 === 0 ? '#C084FC' : '#38BDF8',
            alpha: 1,
            decay: 0.02,
            shape: 'orb',
            rot: 0,
            vrot: 0,
          });
        }
      } else {
        // Crown / Party golden star shower
        const colors = ['#F5C451', '#FDE68A', '#EC4899', '#38BDF8', '#A78BFA'];
        for (let i = 0; i < 65; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 2 + Math.random() * 10;
          particles.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 3,
            size: 5 + Math.random() * 8,
            color: colors[i % colors.length],
            alpha: 1,
            decay: 0.014,
            shape: 'star',
            rot: Math.random() * Math.PI,
            vrot: (Math.random() - 0.5) * 0.2,
          });
        }
      }
    };

    window.addEventListener('lm:fx', onFx);

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Lightning Bolts
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#38BDF8';
        ctx.beginPath();
        b.points.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
        ctx.stroke();
        ctx.restore();
        b.alpha -= 0.065;
        if (b.alpha <= 0) bolts.splice(i, 1);
      }

      // Draw Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;

        if (p.shape === 'ring') {
          p.size += 11;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.shape === 'diamond') {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.16;
          p.rot += p.vrot;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.65, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.65, 0);
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'star') {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.18;
          p.rot += p.vrot;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          for (let k = 0; k < 5; k++) {
            const a1 = (k * 4 * Math.PI) / 5 - Math.PI / 2;
            ctx.lineTo(Math.cos(a1) * p.size, Math.sin(a1) * p.size);
          }
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'streak') {
          p.x += p.vx;
          p.y += p.vy;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
          ctx.stroke();
        } else {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.985;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
        p.alpha -= p.decay;
        if (p.alpha <= 0) particles.splice(i, 1);
      }

      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('lm:fx', onFx);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 z-[100] pointer-events-none transition-transform duration-75 ${
        shaking ? 'translate-x-1 -translate-y-0.5' : ''
      }`}
    />
  );
}

/**
 * Authentic Telegram Shimmering Stardust Spoiler Overlay
 * Covers hidden text or media with animated floating sparkles; tapping bursts the cloud open!
 */
export function TelegramSpoilerBox({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = (canvas.width = 280);
    const h = (canvas.height = 72);
    const dots = Array.from({ length: 95 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.85,
      vy: (Math.random() - 0.5) * 0.85,
      r: 0.8 + Math.random() * 1.4,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.06,
    }));

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x = (d.x + d.vx + w) % w;
        d.y = (d.y + d.vy + h) % h;
        d.a += d.da;
        if (d.a > 1 || d.a < 0.15) d.da *= -1;
        ctx.fillStyle = `rgba(255,255,255,${d.a.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [revealed]);

  if (revealed) {
    return (
      <motion.div initial={{ opacity: 0, filter: 'blur(8px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }}>
        {children}
      </motion.div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        playInteractiveSound('spoiler');
        const rect = e.currentTarget.getBoundingClientRect();
        triggerInteractiveFx('gem', rect.left + rect.width / 2, rect.top + rect.height / 2);
        setRevealed(true);
      }}
      title="اضغط لكشف المحتوى المخفي"
      className="relative rounded-xl overflow-hidden cursor-pointer select-none"
    >
      <div className="opacity-0 pointer-events-none">{children}</div>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full bg-white/10 backdrop-blur-md" />
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white/85 drop-shadow">
        ✨ اضغط لكشف الحبر السري
      </span>
    </div>
  );
}
