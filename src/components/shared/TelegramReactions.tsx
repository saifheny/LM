import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Authentic 120fps Zero-Lag Telegram Reactions:
 * Clean vector animated reaction icons + localized micro-particle burst around the pill ONLY (zero screen-wide clutter, zero lag!).
 */
export interface TgReactionDef {
  id: string;
  symbol: string;
  accent: string;
  label: string;
}

export const TG_REACTIONS: TgReactionDef[] = [
  { id: 'heart', symbol: '❤️', accent: '#FF2D55', label: 'Love' },
  { id: 'fire', symbol: '🔥', accent: '#FF9500', label: 'Fire' },
  { id: 'thumbs', symbol: '👍', accent: '#38BDF8', label: 'Like' },
  { id: 'zap', symbol: '⚡', accent: '#FACC15', label: 'Zap' },
  { id: 'hundred', symbol: '💯', accent: '#F43F5E', label: '100' },
  { id: 'laugh', symbol: '😂', accent: '#FBBF24', label: 'Haha' },
  { id: 'eyes', symbol: '👀', accent: '#E4E4E7', label: 'Seen' },
];

const LEGACY_KEY_MAP: Record<string, string> = {
  heartfire: 'heart',
  bolt: 'zap',
  mindblown: 'hundred',
  crown: 'fire',
  gem: 'zap',
  party: 'thumbs',
  rocket: 'fire',
  starstruck: 'heart',
  clap: 'thumbs',
};

export function resolveReaction(key: string): TgReactionDef {
  const mapped = LEGACY_KEY_MAP[key] || key;
  return TG_REACTIONS.find(r => r.id === mapped || r.symbol === mapped) || {
    id: key,
    symbol: key.length <= 3 ? key : '🔥',
    accent: '#FF9500',
    label: key,
  };
}

/** Compact Hover Picker Bar — exact Telegram quick reaction strip */
export function TelegramReactionStrip({
  onSelect,
}: {
  onSelect: (reactionId: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 4 }}
      transition={{ duration: 0.14 }}
      className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-[#121215] border border-white/[0.12] shadow-xl select-none"
    >
      {TG_REACTIONS.map((r) => (
        <motion.button
          key={r.id}
          type="button"
          whileHover={{ scale: 1.32, y: -2 }}
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 520, damping: 22 }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(r.id);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[16px] cursor-pointer"
        >
          {r.symbol}
        </motion.button>
      ))}
    </motion.div>
  );
}

/** Individual Reaction Pill with localized Telegram micro-spark burst on click */
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
  const [burstKey, setBurstKey] = useState(0);

  const dots = [0, 60, 120, 180, 240, 300];

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={(e) => {
        e.stopPropagation();
        setBurstKey(k => k + 1);
        onToggle();
      }}
      className={`relative px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none ${
        active
          ? 'bg-white/[0.14] border border-white/[0.24] text-white'
          : 'bg-[#111114] border border-white/[0.08] text-[#A1A1AA] hover:border-white/[0.16]'
      }`}
    >
      <motion.span
        key={burstKey}
        initial={burstKey > 0 ? { scale: 1.55, rotate: -14 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        className="text-[13px] leading-none"
      >
        {def.symbol}
      </motion.span>
      <span className="text-[11px] font-mono-num font-semibold">{count}</span>

      {/* Localized Micro-Burst Dots (Strictly 18px around the pill — zero lag!) */}
      <AnimatePresence>
        {burstKey > 0 && (
          <span key={burstKey} className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {dots.map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <motion.span
                  key={deg}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(rad) * 18,
                    y: Math.sin(rad) * 18,
                    opacity: 0,
                    scale: 0.2,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.38, ease: 'easeOut' }}
                  style={{ backgroundColor: def.accent }}
                  className="absolute w-1 h-1 rounded-full"
                />
              );
            })}
          </span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
