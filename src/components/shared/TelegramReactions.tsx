import React from 'react';

export interface TgReactionDef {
  id: string;
  symbol: string;
  label: string;
}

export const TG_REACTIONS: TgReactionDef[] = [
  { id: 'heart', symbol: '❤️', label: 'Love' },
  { id: 'fire', symbol: '🔥', label: 'Fire' },
  { id: 'thumbs', symbol: '👍', label: 'Like' },
  { id: 'zap', symbol: '⚡', label: 'Zap' },
  { id: 'hundred', symbol: '💯', label: '100' },
  { id: 'laugh', symbol: '😂', label: 'Haha' },
  { id: 'eyes', symbol: '👀', label: 'Seen' },
];

export function resolveReaction(key: string): TgReactionDef {
  return (
    TG_REACTIONS.find(r => r.id === key || r.symbol === key) || {
      id: key,
      symbol: key.length <= 3 ? key : '❤️',
      label: key,
    }
  );
}

/** Crisp Instant Reaction Strip (Zero lag, zero excessive animations) */
export function TelegramReactionStrip({
  onSelect,
}: {
  onSelect: (reactionId: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-[#111114] border border-white/[0.12] select-none">
      {TG_REACTIONS.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(r.id);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[15px] hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          {r.symbol}
        </button>
      ))}
    </div>
  );
}

/** Clean Restrained Reaction Pill (Zero flying clutter / zero sloppy bounce) */
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

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none ${
        active
          ? 'bg-white/[0.16] border border-white/[0.26] text-white'
          : 'bg-[#0F0F12] border border-white/[0.08] text-[#A1A1AA] hover:border-white/[0.16]'
      }`}
    >
      <span className="text-[12.5px] leading-none">{def.symbol}</span>
      <span className="text-[11px] font-mono-num font-semibold">{count}</span>
    </button>
  );
}
