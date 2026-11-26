import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ThumbsUp } from 'lucide-react';

export interface ReactionDef {
  id: string;
  label: string;
  labelEn: string;
  accent: string;
  extra?: boolean;
  particleColors: [string, string, string];
  idleMotion: {
    scale?: number[];
    scaleX?: number[];
    scaleY?: number[];
    rotate?: number[];
  };
  renderIcon: (size?: number) => React.ReactNode;
}

/**
 * 2026 Custom Sculpted Animated Reaction Badges
 * - Authentic IN-PLACE facial/expressive motion (NO awkward vertical bouncing/jumping!)
 * - 7 Core reactions + expandable '+' tray with 4 extra sculpted reactions
 */
export const REACTION_LIST: ReactionDef[] = [
  {
    id: 'like',
    label: 'إعجاب',
    labelEn: 'Like',
    accent: '#60A5FA',
    particleColors: ['#60A5FA', '#3B82F6', '#BFDBFE'],
    idleMotion: { rotate: [0, -10, 4, 0], scale: [1, 1.07, 1] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxLike" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxLike)" />
        <path
          d="M11.2 12.6L13.5 7.4C14 6.5 15.4 6.8 15.4 7.9V11.3H19.1C20.2 11.3 21 12.3 20.8 13.4L19.8 18.6C19.6 19.5 18.8 20.1 17.9 20.1H11.2V12.6ZM8 12.6H9.8V20.1H8V12.6Z"
          fill="#FFFFFF"
        />
      </svg>
    ),
  },
  {
    id: 'love',
    label: 'أحببته',
    labelEn: 'Love',
    accent: '#FB7185',
    particleColors: ['#FB7185', '#E11D48', '#FECDD3'],
    idleMotion: { scale: [1, 1.15, 0.96, 1.1, 1] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxLove" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="100%" stopColor="#E11D48" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxLove)" />
        <path
          d="M14 20.5S7.5 16.3 7.5 11.9C7.5 9.7 9.2 8.2 11.2 8.2c1.3 0 2.4.7 2.8 1.7.4-1 1.5-1.7 2.8-1.7 2 0 3.7 1.5 3.7 3.7 0 4.4-6.5 8.6-6.5 8.6z"
          fill="#FFFFFF"
        />
      </svg>
    ),
  },
  {
    id: 'haha',
    label: 'أضحكني',
    labelEn: 'Haha',
    accent: '#FDE047',
    particleColors: ['#FDE047', '#F59E0B', '#FEF9C3'],
    idleMotion: { rotate: [-8, 8, -7, 7, -3, 0], scale: [1, 1.08, 0.97, 1.07, 1] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxHaha" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxHaha)" />
        <path d="M8.5 11.2L11.2 12.4L8.5 13.6" stroke="#18181B" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19.5 11.2L16.8 12.4L19.5 13.6" stroke="#18181B" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.8 15.8H19.2C19 19 16.8 21 14 21C11.2 21 9 19 8.8 15.8Z" fill="#18181B" />
        <path d="M11 19.3C11.8 18.4 16.2 18.4 17 19.3C16.2 20.3 15.1 20.8 14 20.8C12.9 20.8 11.8 20.3 11 19.3Z" fill="#FB7185" />
      </svg>
    ),
  },
  {
    id: 'fire',
    label: 'مذهل',
    labelEn: 'Fire',
    accent: '#FBBF24',
    particleColors: ['#FBBF24', '#EA580C', '#FEF08A'],
    idleMotion: { scaleX: [1, 0.93, 1.06, 1], scaleY: [1, 1.09, 0.96, 1] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxFire" x1="5" y1="3" x2="23" y2="25" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxFire)" />
        <path
          d="M14.8 6.5C14.8 6.5 19.6 10 19.6 15.2C19.6 18.6 17.1 21.2 14 21.2C10.9 21.2 8.6 18.7 8.6 15.6C8.6 13.1 10.2 10.8 11.6 9.8C11.6 11.8 12.8 12.8 12.8 12.8C12.8 10 14.1 7.8 14.8 6.5Z"
          fill="#FFFFFF"
        />
      </svg>
    ),
  },
  {
    id: 'wow',
    label: 'واو',
    labelEn: 'Wow',
    accent: '#C084FC',
    particleColors: ['#C084FC', '#7C3AED', '#E9D5FF'],
    idleMotion: { scale: [1, 1.13, 0.95, 1.06, 1] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxWow" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C084FC" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxWow)" />
        <circle cx="10.2" cy="11.5" r="1.5" fill="#FFFFFF" />
        <circle cx="17.8" cy="11.5" r="1.5" fill="#FFFFFF" />
        <ellipse cx="14" cy="17.5" rx="2.6" ry="3.4" fill="#18181B" />
      </svg>
    ),
  },
  {
    id: 'zap',
    label: 'قوي',
    labelEn: 'Zap',
    accent: '#34D399',
    particleColors: ['#34D399', '#059669', '#A7F3D0'],
    idleMotion: { rotate: [0, 9, -8, 4, 0], scale: [1, 1.07, 1] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxZap" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxZap)" />
        <path d="M15.4 6.5L9.2 15.2H13.8L12.6 21.5L18.8 12.8H14.2L15.4 6.5Z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'sad',
    label: 'تأثر',
    labelEn: 'Sad',
    accent: '#7DD3FC',
    particleColors: ['#7DD3FC', '#0284C7', '#BAE6FD'],
    idleMotion: { rotate: [-6, 5, -6], scale: [1, 0.96, 1] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxSad" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7DD3FC" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxSad)" />
        <circle cx="10.3" cy="12" r="1.4" fill="#18181B" />
        <circle cx="17.7" cy="12" r="1.4" fill="#18181B" />
        <path d="M10.5 18.6C11.7 16.9 16.3 16.9 17.5 18.6" stroke="#18181B" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
  // ── Expandable '+' Extra Sculpted Reactions ──
  {
    id: 'support',
    label: 'دعم',
    labelEn: 'Care',
    accent: '#FDA4AF',
    extra: true,
    particleColors: ['#FDA4AF', '#F59E0B', '#FECDD3'],
    idleMotion: { rotate: [-5, 5, -5], scale: [1, 1.09, 1] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxSupport" x1="3" y1="3" x2="25" y2="25" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#FB7185" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxSupport)" />
        <path d="M9.6 10.5C10.2 9.7 11.4 9.7 12 10.5" stroke="#18181B" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16 10.5C16.6 9.7 17.8 9.7 18.4 10.5" stroke="#18181B" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M14 21.4S9.3 18.4 9.3 15.4C9.3 13.8 10.5 12.8 11.9 12.8c.9 0 1.7.5 2.1 1.2.4-.7 1.2-1.2 2.1-1.2 1.4 0 2.6 1 2.6 2.6 0 3-4.7 6-4.7 6z"
          fill="#E11D48"
        />
      </svg>
    ),
  },
  {
    id: 'celebrate',
    label: 'تهنئة',
    labelEn: 'Celebrate',
    accent: '#F59E0B',
    extra: true,
    particleColors: ['#F59E0B', '#34D399', '#FDE047'],
    idleMotion: { rotate: [-9, 9, -6, 6, 0], scale: [1, 1.1, 0.96, 1] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxCelebrate" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxCelebrate)" />
        <path d="M14 6.2L15.9 11.4L21.4 11.6L17 15L18.5 20.4L14 17.2L9.5 20.4L11 15L6.6 11.6L12.1 11.4L14 6.2Z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'mindblown',
    label: 'عبقري',
    labelEn: 'Genius',
    accent: '#2DD4BF',
    extra: true,
    particleColors: ['#2DD4BF', '#10B981', '#99F6E4'],
    idleMotion: { scale: [1, 1.14, 0.95, 1.09, 1], rotate: [0, 6, -6, 0] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxMind" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxMind)" />
        <path
          d="M14 7.2C11.1 7.2 8.8 9.5 8.8 12.4C8.8 14.3 9.9 16 11.4 16.9V18.4C11.4 18.9 11.8 19.3 12.3 19.3H15.7C16.2 19.3 16.6 18.9 16.6 18.4V16.9C18.1 16 19.2 14.3 19.2 12.4C19.2 9.5 16.9 7.2 14 7.2Z"
          fill="#FFFFFF"
        />
        <rect x="12" y="20.4" width="4" height="1.5" rx="0.75" fill="#18181B" />
      </svg>
    ),
  },
  {
    id: 'hundred',
    label: 'ممتاز',
    labelEn: '100%',
    accent: '#F43F5E',
    extra: true,
    particleColors: ['#F43F5E', '#FBBF24', '#FDA4AF'],
    idleMotion: { scale: [1, 1.12, 0.97, 1.08, 1], rotate: [-4, 4, -2, 0] },
    renderIcon: (size = 20) => (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient id="rxHundred" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="100%" stopColor="#BE123C" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#rxHundred)" />
        <text
          x="14"
          y="16.2"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="9.2"
          fontWeight="800"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
        >
          100
        </text>
        <path d="M8.4 19.4H19.6M9.6 21.6H18.4" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const KEY_ALIAS: Record<string, string> = {
  heart: 'love',
  thumbs: 'like',
  laugh: 'haha',
  eyes: 'wow',
};

export function resolveReaction(key: string): ReactionDef {
  const mapped = KEY_ALIAS[key] || key;
  return REACTION_LIST.find(r => r.id === mapped) || REACTION_LIST[0];
}

const BURST_VECTORS = [
  { x: -34, y: -38, rot: -28, size: 7, shape: 'star' },
  { x: -16, y: -50, rot: -12, size: 6, shape: 'dot' },
  { x: 4, y: -54, rot: 14, size: 8, shape: 'ring' },
  { x: 24, y: -44, rot: 26, size: 6, shape: 'star' },
  { x: 38, y: -26, rot: 40, size: 5, shape: 'dot' },
  { x: -38, y: -16, rot: -35, size: 6, shape: 'ring' },
  { x: 16, y: -24, rot: 18, size: 5, shape: 'dot' },
] as const;

interface BurstEvent {
  uid: number;
  reactionId: string;
}

/**
 * Multi-Effect Particle Burst Overlay triggered whenever a reaction is clicked!
 */
function ReactionBurstEffect({ bursts }: { bursts: BurstEvent[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible z-40">
      <AnimatePresence>
        {bursts.map(b => {
          const def = resolveReaction(b.reactionId);
          return (
            <div key={b.uid} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <motion.div
                initial={{ opacity: 0.95, y: 0, scale: 0.7 }}
                animate={{ opacity: 0, y: -46, scale: 1.28 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                className="absolute -left-3.5 -top-3.5"
              >
                {def.renderIcon(28)}
              </motion.div>

              <motion.span
                initial={{ opacity: 0.8, scale: 0.3 }}
                animate={{ opacity: 0, scale: 2.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.44, ease: 'easeOut' }}
                style={{ borderColor: def.accent }}
                className="absolute -left-3 -top-3 w-6 h-6 rounded-full border-2"
              />

              {BURST_VECTORS.map((vec, i) => {
                const color = def.particleColors[i % def.particleColors.length];
                return (
                  <motion.span
                    key={i}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 0.5, rotate: 0 }}
                    animate={{
                      opacity: [1, 1, 0],
                      x: vec.x,
                      y: vec.y,
                      scale: [0.6, 1.15, 0.3],
                      rotate: vec.rot,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.56 + (i % 3) * 0.06, ease: [0.2, 0.85, 0.3, 1] }}
                    className="absolute left-0 top-0"
                  >
                    {vec.shape === 'star' ? (
                      <svg width={vec.size + 4} height={vec.size + 4} viewBox="0 0 12 12" fill={color}>
                        <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5Z" />
                      </svg>
                    ) : vec.shape === 'ring' ? (
                      <span
                        style={{ width: vec.size, height: vec.size, borderColor: color }}
                        className="block rounded-full border-[1.75px]"
                      />
                    ) : (
                      <span
                        style={{ width: vec.size, height: vec.size, backgroundColor: color }}
                        className="block rounded-full"
                      />
                    )}
                  </motion.span>
                );
              })}
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/**
 * Floating Animated Facebook-Style Reaction Dock (Used in both Chat & Community!)
 * - Expressive IN-PLACE animations (ZERO vertical bouncing!)
 * - Single sleek horizontally swipeable / scrollable capsule (NO '+' button!)
 * - Floating label renders cleanly ABOVE the scroll viewport so it never clips
 */
export function TelegramReactionStrip({
  onSelect,
  activeReactionId,
  lang = 'ar',
}: {
  onSelect: (reactionId: string) => void;
  activeReactionId?: string | null;
  lang?: 'ar' | 'en';
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const hoveredDef = hoveredId ? REACTION_LIST.find(r => r.id === hoveredId) || null : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 460, damping: 28 }}
      className="relative inline-flex items-center select-none"
    >
      {/* Floating Tooltip Above Strip (Outside overflow container so it NEVER clips!) */}
      <AnimatePresence>
        {hoveredDef && (
          <motion.span
            key={hoveredDef.id}
            initial={{ opacity: 0, y: 4, scale: 0.88 }}
            animate={{ opacity: 1, y: -4, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.88 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/92 border border-white/[0.16] text-[10.5px] font-semibold text-white whitespace-nowrap shadow-xl z-30"
          >
            {lang === 'en' ? hoveredDef.labelEn : hoveredDef.label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Horizontally Swipeable / Scrollable Reaction Capsule */}
      <div
        ref={stripRef}
        onWheel={e => {
          const el = stripRef.current;
          if (!el) return;
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
            e.preventDefault();
            e.stopPropagation();
            el.scrollLeft += e.deltaY;
          }
        }}
        style={{ WebkitOverflowScrolling: 'touch' }}
        className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#15151C]/96 backdrop-blur-2xl border border-white/[0.15] shadow-[0_14px_40px_rgba(0,0,0,0.68)] max-w-[264px] sm:max-w-[308px] overflow-x-auto no-scrollbar scroll-smooth touch-pan-x"
      >
        {REACTION_LIST.map((r, idx) => {
          const isHovered = hoveredId === r.id;
          const isSelected = activeReactionId === r.id;
          return (
            <motion.button
              key={r.id}
              type="button"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 24, delay: Math.min(idx * 0.018, 0.14) }}
              onMouseEnter={() => setHoveredId(r.id)}
              onMouseLeave={() => setHoveredId(cur => (cur === r.id ? null : cur))}
              onClick={e => {
                e.stopPropagation();
                onSelect(r.id);
              }}
              className="relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
            >
              {/* In-Place Expressive Badge Animation (NO upward jumping!) */}
              <motion.span
                animate={
                  isHovered
                    ? {
                        scale: 1.28,
                        rotate: r.id === 'haha' ? [-8, 8, -6, 6, 0] : idx % 2 === 0 ? -5 : 5,
                      }
                    : {
                        scale: isSelected ? 1.1 : 1,
                        ...r.idleMotion,
                      }
                }
                transition={
                  isHovered
                    ? { type: 'spring', stiffness: 480, damping: 18 }
                    : {
                        duration: 1.9 + (idx % 3) * 0.35,
                        repeat: Infinity,
                        repeatType: 'mirror',
                        ease: 'easeInOut',
                        delay: idx * 0.1,
                      }
                }
                whileTap={{ scale: 0.88 }}
                className="flex items-center justify-center"
              >
                {r.renderIcon(26)}
              </motion.span>

              {isSelected && (
                <span
                  style={{ backgroundColor: r.accent }}
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * Facebook-Style Floating Multi-Effect Like / Reaction Trigger for Community Posts!
 */
export function FacebookReactionButton({
  reactions = {},
  myReaction,
  totalCount,
  onReact,
  lang = 'ar',
}: {
  reactions?: Record<string, number>;
  myReaction?: string | null;
  totalCount: number;
  onReact: (reactionId: string) => void;
  lang?: 'ar' | 'en';
}) {
  const [dockOpen, setDockOpen] = useState(false);
  const [bursts, setBursts] = useState<BurstEvent[]>([]);
  const closeTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const activeDef = myReaction ? resolveReaction(myReaction) : null;

  const topReactionKeys = Object.entries(reactions)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);

  function scheduleClose() {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setDockOpen(false), 320);
  }

  function keepOpen() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setDockOpen(true);
  }

  function triggerBurst(reactionId: string) {
    const uid = Date.now() + Math.random();
    setBursts(prev => [...prev.slice(-4), { uid, reactionId }]);
    window.setTimeout(() => {
      setBursts(prev => prev.filter(x => x.uid !== uid));
    }, 700);
  }

  function handleSelect(reactionId: string) {
    setDockOpen(false);
    if (myReaction !== reactionId) {
      triggerBurst(reactionId);
    }
    onReact(reactionId);
  }

  function handleQuickTap() {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    const targetId = myReaction || 'like';
    if (!myReaction) triggerBurst('like');
    onReact(targetId);
  }

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={keepOpen}
      onMouseLeave={scheduleClose}
    >
      <AnimatePresence>
        {dockOpen && (
          <div
            onMouseEnter={keepOpen}
            onMouseLeave={scheduleClose}
            className="absolute bottom-full start-0 pb-2.5 z-40"
          >
            <TelegramReactionStrip activeReactionId={myReaction} onSelect={handleSelect} lang={lang} />
          </div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onPointerDown={() => {
          longPressedRef.current = false;
          holdTimerRef.current = window.setTimeout(() => {
            longPressedRef.current = true;
            setDockOpen(true);
          }, 260);
        }}
        onPointerUp={() => {
          if (holdTimerRef.current) {
            window.clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
        }}
        onPointerCancel={() => {
          if (holdTimerRef.current) {
            window.clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
        }}
        onClick={handleQuickTap}
        className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-colors cursor-pointer select-none ${
          activeDef
            ? 'bg-white/[0.09] border-white/[0.18] text-white font-semibold'
            : 'bg-[#131318] border-white/[0.08] text-[#A1A1AA] hover:border-white/20 hover:text-white'
        }`}
      >
        <ReactionBurstEffect bursts={bursts} />

        <motion.span
          key={myReaction || 'none'}
          initial={{ scale: 0.65, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 20 }}
          className="flex items-center justify-center"
        >
          {activeDef ? activeDef.renderIcon(18) : <ThumbsUp className="w-3.5 h-3.5" strokeWidth={1.9} />}
        </motion.span>

        <span style={activeDef ? { color: activeDef.accent } : undefined} className="text-[11.5px]">
          {activeDef ? (lang === 'en' ? activeDef.labelEn : activeDef.label) : lang === 'en' ? 'Like' : 'إعجاب'}
        </span>

        {totalCount > 0 && (
          <span className="flex items-center gap-1 ms-0.5 ps-1.5 border-s border-white/[0.1]">
            {topReactionKeys.length > 0 && (
              <span className="flex items-center -space-x-1 rtl:space-x-reverse">
                {topReactionKeys.map(k => (
                  <span key={k} className="inline-flex rounded-full ring-1 ring-[#0A0A0C]">
                    {resolveReaction(k).renderIcon(13)}
                  </span>
                ))}
              </span>
            )}
            <span className="font-mono-num text-[11px] text-[#D4D4D8]">{totalCount}</span>
          </span>
        )}
      </motion.button>
    </div>
  );
}

/** Crisp Sculpted Reaction Counter Pill (Used on Chat Messages with Spark Burst!) */
export function TelegramReactionPill({
  reactionKey,
  count,
  active,
  onToggle,
}: {
  reactionKey: string;
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  const def = resolveReaction(reactionKey);
  const [bursts, setBursts] = useState<BurstEvent[]>([]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!active) {
      const uid = Date.now() + Math.random();
      setBursts(prev => [...prev.slice(-2), { uid, reactionId: def.id }]);
      window.setTimeout(() => setBursts(prev => prev.filter(x => x.uid !== uid)), 650);
    }
    onToggle();
  }

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      className={`relative ps-1.5 pe-2.5 py-0.5 rounded-full text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none ${
        active
          ? 'bg-white/[0.16] border border-white/[0.26] text-white'
          : 'bg-[#131318] border border-white/[0.08] text-[#A1A1AA] hover:border-white/[0.18]'
      }`}
    >
      <ReactionBurstEffect bursts={bursts} />
      <span className="flex items-center justify-center">{def.renderIcon(15)}</span>
      <span className="text-[11px] font-mono-num font-semibold">{count}</span>
    </motion.button>
  );
}
