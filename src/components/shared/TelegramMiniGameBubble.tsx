import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AnimatedEmoji, playInteractiveSound, triggerInteractiveFx } from './InteractiveEmojiEngine';

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function TelegramMiniGameBubble({
  meta,
}: {
  meta: Record<string, unknown> | null;
}) {
  const game = String(meta?.game || 'dice');
  const [rolling, setRolling] = useState(true);
  const [spinIdx, setSpinIdx] = useState(0);

  useEffect(() => {
    setRolling(true);
    let ticks = 0;
    const id = setInterval(() => {
      ticks++;
      setSpinIdx(ticks);
      if (ticks <= 6) playInteractiveSound('tick');
      if (ticks >= 10) {
        clearInterval(id);
        setRolling(false);
        const isWin =
          (game === 'dice' && Number(meta?.result) === 6) ||
          (game === 'slot' && Boolean(meta?.jackpot)) ||
          (game === 'target' && Number(meta?.score) === 100);
        if (isWin) triggerInteractiveFx('crown');
      }
    }, 95);
    return () => clearInterval(id);
  }, [game, meta]);

  if (game === 'slot') {
    const syms = ['💎', '👑', '⚡', '🔥', '7️⃣'];
    const finalReels = (meta?.reels as string[]) || ['7️⃣', '7️⃣', '7️⃣'];
    const shown = rolling
      ? [syms[spinIdx % syms.length], syms[(spinIdx + 2) % syms.length], syms[(spinIdx + 4) % syms.length]]
      : finalReels;
    const jackpot = !rolling && Boolean(meta?.jackpot);

    return (
      <div className="p-3.5 rounded-3xl liquid-glass flex flex-col items-center gap-2 min-w-[180px]">
        <div className="flex items-center gap-1.5">
          <AnimatedEmoji id="slot" size={24} />
          <span className="text-[11px] font-bold text-[#F5C451]">{jackpot ? 'JACKPOT! 👑' : 'LM Slots'}</span>
        </div>
        <div className="flex items-center gap-2">
          {shown.map((s, i) => (
            <motion.div
              key={i}
              animate={rolling ? { y: [-4, 4, -4] } : { scale: [1.2, 1] }}
              className="w-11 h-12 rounded-xl bg-black/50 border border-white/15 flex items-center justify-center text-2xl"
            >
              {s}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (game === 'target') {
    const score = Number(meta?.score || 100);
    return (
      <div className="p-3.5 rounded-3xl liquid-glass flex items-center gap-3">
        <AnimatedEmoji id="target" size={56} interactive onTrigger={(e) => triggerInteractiveFx('gem', e.clientX, e.clientY)} />
        <div>
          <div className="text-[11px] text-[var(--lm-text-muted)]">🎯 Target</div>
          <div className="text-xl font-extrabold font-mono-num text-[#FF2D55]">
            {rolling ? '...' : `${score}/100`}
          </div>
        </div>
      </div>
    );
  }

  // Default: Telegram Animated Dice 1–6
  const result = Math.max(1, Math.min(6, Number(meta?.result || 6)));
  const face = rolling ? DICE_FACES[spinIdx % 6] : DICE_FACES[result - 1];

  return (
    <motion.div
      animate={rolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.15, 1] } : { rotate: 0, scale: 1 }}
      transition={{ duration: 0.9 }}
      onClick={(e) => triggerInteractiveFx(result === 6 ? 'crown' : 'party', e.clientX, e.clientY)}
      className="p-4 rounded-3xl liquid-glass flex items-center gap-3.5 cursor-pointer select-none"
    >
      <div className="text-5xl leading-none drop-shadow-[0_6px_18px_rgba(124,92,255,0.6)]">{face}</div>
      <div>
        <div className="text-[10px] font-mono-num uppercase text-[var(--lm-text-muted)]">Interactive Dice</div>
        <div className="text-lg font-extrabold font-mono-num text-[#F5C451]">
          {rolling ? 'Rolling...' : `${result} / 6`}
        </div>
      </div>
    </motion.div>
  );
}
