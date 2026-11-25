import React from 'react';

interface IconProps {
  active?: boolean;
  size?: number;
}

/** 2026 Multi-Layer Duotone & Specular Glass SVG Icon System */
export function IconChat2026({ active, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="gChat" x1="3" y1="3" x2="25" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor={active ? '#A78BFA' : 'currentColor'} />
          <stop offset="1" stopColor={active ? '#38BDF8' : 'currentColor'} stopOpacity={active ? 1 : 0.65} />
        </linearGradient>
      </defs>
      <path
        d="M14 4C8.2 4 3.5 8.1 3.5 13.2C3.5 15.8 4.7 18.1 6.7 19.8L5.3 24.1C5.1 24.6 5.6 25 6.1 24.8L10.7 22.9C11.8 23.2 12.9 23.4 14 23.4C19.8 23.4 24.5 19.3 24.5 14.2C24.5 9.1 19.8 4 14 4Z"
        fill={active ? 'url(#gChat)' : 'currentColor'}
        fillOpacity={active ? 0.95 : 0.2}
        stroke={active ? 'url(#gChat)' : 'currentColor'}
        strokeWidth="1.7"
      />
      <circle cx="10" cy="13.8" r="1.4" fill={active ? '#FFFFFF' : 'currentColor'} />
      <circle cx="14" cy="13.8" r="1.4" fill={active ? '#FFFFFF' : 'currentColor'} />
      <circle cx="18" cy="13.8" r="1.4" fill={active ? '#FFFFFF' : 'currentColor'} />
    </svg>
  );
}

export function IconReels2026({ active, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="gReels" x1="4" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF2D55" />
          <stop offset="1" stopColor="#FF9500" />
        </linearGradient>
      </defs>
      <rect
        x="4.5"
        y="3.5"
        width="19"
        height="21"
        rx="6"
        fill={active ? 'url(#gReels)' : 'currentColor'}
        fillOpacity={active ? 0.92 : 0.16}
        stroke={active ? 'url(#gReels)' : 'currentColor'}
        strokeWidth="1.7"
      />
      <path
        d="M11.8 10.2L18.2 14L11.8 17.8V10.2Z"
        fill={active ? '#FFFFFF' : 'currentColor'}
      />
    </svg>
  );
}

export function IconFeed2026({ active, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="gFeed" x1="4" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EC4899" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="8.5" height="8.5" rx="3" fill={active ? 'url(#gFeed)' : 'currentColor'} fillOpacity={active ? 0.95 : 0.2} stroke={active ? 'url(#gFeed)' : 'currentColor'} strokeWidth="1.6" />
      <rect x="15.5" y="4" width="8.5" height="8.5" rx="3" fill={active ? 'url(#gFeed)' : 'currentColor'} fillOpacity={active ? 0.65 : 0.1} stroke={active ? 'url(#gFeed)' : 'currentColor'} strokeWidth="1.6" />
      <rect x="4" y="15.5" width="8.5" height="8.5" rx="3" fill={active ? 'url(#gFeed)' : 'currentColor'} fillOpacity={active ? 0.65 : 0.1} stroke={active ? 'url(#gFeed)' : 'currentColor'} strokeWidth="1.6" />
      <rect x="15.5" y="15.5" width="8.5" height="8.5" rx="3" fill={active ? 'url(#gFeed)' : 'currentColor'} fillOpacity={active ? 0.95 : 0.2} stroke={active ? 'url(#gFeed)' : 'currentColor'} strokeWidth="1.6" />
    </svg>
  );
}

export function IconLive2026({ active, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="4.2" fill={active ? '#FF2D55' : 'currentColor'} />
      <path d="M8.5 8.5C5.5 11.5 5.5 16.5 8.5 19.5" stroke={active ? '#FF2D55' : 'currentColor'} strokeWidth="2" strokeLinecap="round" />
      <path d="M19.5 8.5C22.5 11.5 22.5 16.5 19.5 19.5" stroke={active ? '#FF2D55' : 'currentColor'} strokeWidth="2" strokeLinecap="round" />
      <path d="M5.2 5.2C0.5 9.9 0.5 18.1 5.2 22.8" stroke={active ? '#FF6B8B' : 'currentColor'} strokeOpacity="0.55" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M22.8 5.2C27.5 9.9 27.5 18.1 22.8 22.8" stroke={active ? '#FF6B8B' : 'currentColor'} strokeOpacity="0.55" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconAiOrb2026({ active, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <defs>
        <radialGradient id="gOrb" cx="35%" cy="30%" r="70%">
          <stop stopColor="#E0E7FF" />
          <stop offset="0.45" stopColor="#818CF8" />
          <stop offset="1" stopColor="#06B6D4" />
        </radialGradient>
      </defs>
      <circle cx="14" cy="14" r="9.5" fill={active ? 'url(#gOrb)' : 'currentColor'} fillOpacity={active ? 0.95 : 0.18} stroke={active ? '#818CF8' : 'currentColor'} strokeWidth="1.6" />
      <ellipse cx="14" cy="14" rx="12" ry="4.5" transform="rotate(-24 14 14)" stroke={active ? '#38BDF8' : 'currentColor'} strokeOpacity="0.75" strokeWidth="1.3" />
      <circle cx="11.2" cy="13.2" r="1.2" fill={active ? '#0B1020' : 'currentColor'} />
      <circle cx="16.8" cy="13.2" r="1.2" fill={active ? '#0B1020' : 'currentColor'} />
    </svg>
  );
}

export function IconCrown2026({ active, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="gCrown" x1="4" y1="6" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <path
        d="M4.5 19.5L3.5 8.5L9.8 13.2L14 6.5L18.2 13.2L24.5 8.5L23.5 19.5H4.5Z"
        fill={active ? 'url(#gCrown)' : 'currentColor'}
        fillOpacity={active ? 0.95 : 0.18}
        stroke={active ? '#F5C451' : 'currentColor'}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <rect x="5" y="21.5" width="18" height="2.2" rx="1.1" fill={active ? '#F5C451' : 'currentColor'} />
    </svg>
  );
}

export function IconMarkets2026({ active, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="5" y="15" width="3.8" height="8" rx="1.5" fill={active ? '#10B981' : 'currentColor'} fillOpacity={active ? 0.9 : 0.35} />
      <rect x="12.1" y="10" width="3.8" height="13" rx="1.5" fill={active ? '#34D399' : 'currentColor'} fillOpacity={active ? 0.95 : 0.55} />
      <rect x="19.2" y="5.5" width="3.8" height="17.5" rx="1.5" fill={active ? '#06B6D4' : 'currentColor'} fillOpacity={active ? 1 : 0.8} />
    </svg>
  );
}

export function IconSystems2026({ active, size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="9.5" cy="9.5" r="3" fill={active ? '#38BDF8' : 'currentColor'} />
      <path d="M14 9.5H23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18.5" cy="18.5" r="3" fill={active ? '#A78BFA' : 'currentColor'} />
      <path d="M5 18.5H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
