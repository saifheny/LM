import React from 'react';

export interface ReactionDef {
  id: string;
  label: string;
  renderIcon: (size?: number) => React.ReactNode;
}

/**
 * 2026 Custom Sculpted Vector Reaction Badges (Facebook-Grade Glossy Vector Design — ZERO generic OS Emoji!)
 */
export const REACTION_LIST: ReactionDef[] = [
  {
    id: 'like',
    label: 'إعجاب',
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
    id: 'fire',
    label: 'مذهل',
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
    id: 'haha',
    label: 'أضحكني',
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
    id: 'wow',
    label: 'واو',
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
];

const KEY_ALIAS: Record<string, string> = {
  heart: 'love',
  thumbs: 'like',
  laugh: 'haha',
  hundred: 'zap',
  eyes: 'wow',
};

export function resolveReaction(key: string): ReactionDef {
  const mapped = KEY_ALIAS[key] || key;
  return REACTION_LIST.find(r => r.id === mapped) || REACTION_LIST[1];
}

/** Crisp 2026 Vector Reaction Bar */
export function TelegramReactionStrip({
  onSelect,
}: {
  onSelect: (reactionId: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#16161C]/96 backdrop-blur-xl border border-white/[0.14] shadow-2xl select-none">
      {REACTION_LIST.map((r) => (
        <button
          key={r.id}
          type="button"
          title={r.label}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(r.id);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-115 transition-transform cursor-pointer"
        >
          {r.renderIcon(22)}
        </button>
      ))}
    </div>
  );
}

/** Crisp Sculpted Reaction Counter Pill */
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
      className={`ps-1.5 pe-2.5 py-0.5 rounded-full text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none ${
        active
          ? 'bg-white/[0.16] border border-white/[0.26] text-white'
          : 'bg-[#131318] border border-white/[0.08] text-[#A1A1AA] hover:border-white/[0.18]'
      }`}
    >
      <span className="flex items-center justify-center">{def.renderIcon(15)}</span>
      <span className="text-[11px] font-mono-num font-semibold">{count}</span>
    </button>
  );
}
