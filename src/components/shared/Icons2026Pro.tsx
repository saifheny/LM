import React, { useId } from 'react';

interface NavIconProps {
  active?: boolean;
  className?: string;
}

/**
 * 2026 Luminous Jewel-Toned Duotone Icon System
 * - Every SVG uses a unique React useId() gradient ID so display:none duplicates NEVER break url(#...)!
 * - Active icons pair a vivid translucent jewel core with a bright luminous outer silhouette stroke
 *   so outer shapes pop cleanly against pitch-black (#000000) and obsidian (#0A0A0C) surfaces!
 * - ZERO electric blue on AI or voice icons!
 */
export function NavCommunityIcon({ active, className = 'w-[22px] h-[22px]' }: NavIconProps) {
  const gid = `comm_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#FB7185" />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="3"
        width="8.5"
        height="11"
        rx="3.2"
        fill={active ? `url(#${gid})` : 'none'}
        fillOpacity={active ? '0.28' : '0'}
        stroke={active ? `url(#${gid})` : 'currentColor'}
        strokeWidth="1.8"
      />
      <rect
        x="13.5"
        y="3"
        width="7.5"
        height="7.5"
        rx="3"
        fill={active ? '#FBBF24' : 'none'}
        fillOpacity={active ? '0.92' : '0'}
        stroke={active ? '#FDE68A' : 'currentColor'}
        strokeWidth={active ? '1.3' : '1.8'}
      />
      <rect
        x="3"
        y="16"
        width="8.5"
        height="5"
        rx="2.5"
        fill={active ? '#FB7185' : 'none'}
        fillOpacity={active ? '0.92' : '0'}
        stroke={active ? '#FECDD3' : 'currentColor'}
        strokeWidth={active ? '1.3' : '1.8'}
      />
      <rect
        x="13.5"
        y="12.5"
        width="7.5"
        height="8.5"
        rx="3"
        fill={active ? `url(#${gid})` : 'none'}
        fillOpacity={active ? '0.28' : '0'}
        stroke={active ? `url(#${gid})` : 'currentColor'}
        strokeWidth="1.8"
      />
    </svg>
  );
}

/** Pulse ("نبض") Short Video 2026 Sculpted Icon — Crimson-Rose Outer Frame + Luminous Core Play Glyph */
export function NavPulseIcon({ active, className = 'w-[22px] h-[22px]' }: NavIconProps) {
  const gid = `pulse_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF2D55" />
          <stop offset="55%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
      </defs>
      <rect
        x="3.2"
        y="3.2"
        width="17.6"
        height="17.6"
        rx="5.6"
        fill={active ? `url(#${gid})` : 'none'}
        fillOpacity={active ? '0.24' : '0'}
        stroke={active ? `url(#${gid})` : 'currentColor'}
        strokeWidth="1.85"
      />
      <path
        d="M9.65 9.12C9.65 8.42 10.42 7.98 11.02 8.34L15.46 11.02C16.04 11.37 16.04 12.21 15.46 12.56L11.02 15.24C10.42 15.6 9.65 15.16 9.65 14.46V9.12Z"
        fill={active ? '#FFFFFF' : 'currentColor'}
      />
    </svg>
  );
}

/** Live ("مباشر") 2026 Signal Core Icon — Ruby Core + Vivid Orange-Amber Outer Signal Arcs */
export function NavLiveIcon({ active, className = 'w-[22px] h-[22px]' }: NavIconProps) {
  const gid = `live_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="4" y1="5" x2="20" y2="19" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF3B30" />
          <stop offset="55%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r={active ? '3.4' : '2.7'} fill={active ? '#FF3B30' : 'currentColor'} />
      <path d="M7.8 8.2A6 6 0 0 0 7.8 15.8" stroke={active ? `url(#${gid})` : 'currentColor'} strokeWidth="1.9" strokeLinecap="round" />
      <path d="M16.2 8.2A6 6 0 0 1 16.2 15.8" stroke={active ? `url(#${gid})` : 'currentColor'} strokeWidth="1.9" strokeLinecap="round" />
      <path d="M4.8 5.4A9.8 9.8 0 0 0 4.8 18.6" stroke={active ? '#FBBF24' : 'currentColor'} strokeWidth="1.75" strokeLinecap="round" opacity={active ? '0.95' : '0.55'} />
      <path d="M19.2 5.4A9.8 9.8 0 0 1 19.2 18.6" stroke={active ? '#FBBF24' : 'currentColor'} strokeWidth="1.75" strokeLinecap="round" opacity={active ? '0.95' : '0.55'} />
    </svg>
  );
}

/** Chat ("الدردشة") 2026 Sculpted Speech Squircle — Luminous Mint-Emerald Rim + Glowing White/Mint Dots */
export function NavChatIcon({ active, className = 'w-[22px] h-[22px]' }: NavIconProps) {
  const gid = `chat_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A7F3D0" />
          <stop offset="45%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <path
        d="M12 3.3C6.9 3.3 2.9 6.95 2.9 11.5C2.9 13.95 4.05 16.1 5.9 17.65L4.55 20.9L8.45 19.65C9.55 19.95 10.75 20.15 12 20.15C17.1 20.15 21.1 16.5 21.1 11.5C21.1 6.95 17.1 3.3 12 3.3Z"
        fill={active ? `url(#${gid})` : 'none'}
        fillOpacity={active ? '0.24' : '0'}
        stroke={active ? `url(#${gid})` : 'currentColor'}
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <circle cx="8.6" cy="11.7" r="1.25" fill={active ? '#ECFDF5' : 'currentColor'} />
      <circle cx="12" cy="11.7" r="1.25" fill={active ? '#6EE7B7' : 'currentColor'} />
      <circle cx="15.4" cy="11.7" r="1.25" fill={active ? '#ECFDF5' : 'currentColor'} />
    </svg>
  );
}

/** AI 2026 Neural Star Emblem — Luminous Pearl-White & Champagne-Gold (ZERO Blue!) */
export function NavAiIcon({ active, className = 'w-[22px] h-[22px]' }: NavIconProps) {
  const gid = `ai_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M11.5 3C12.2 7.9 15.1 10.8 20 11.5C15.1 12.2 12.2 15.1 11.5 20C10.8 15.1 7.9 12.2 3 11.5C7.9 10.8 10.8 7.9 11.5 3Z"
        fill={active ? `url(#${gid})` : 'none'}
        fillOpacity={active ? '0.32' : '0'}
        stroke={active ? `url(#${gid})` : 'currentColor'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M18.8 3.2C19 4.7 19.8 5.5 21.3 5.7C19.8 5.9 19 6.7 18.8 8.2C18.6 6.7 17.8 5.9 16.3 5.7C17.8 5.5 18.6 4.7 18.8 3.2Z"
        fill={active ? '#FEF3C7' : 'currentColor'}
      />
    </svg>
  );
}

/** 2026 Sculpted Portrait Studio Glyph (Replaces generic Lucide Camera on Avatar Edit!) */
export function PortraitStudioIcon({ className = 'w-4 h-4' }: { className?: string }) {
  const gid = `portrait_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#FB7185" />
        </linearGradient>
      </defs>
      <path d="M4 8.5V6.5C4 5.1 5.1 4 6.5 4H8.5" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
      <path d="M15.5 4H17.5C18.9 4 20 5.1 20 6.5V8.5" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
      <path d="M20 15.5V17.5C20 18.9 18.9 20 17.5 20H15.5" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 20H6.5C5.1 20 4 18.9 4 17.5V15.5" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="10.2" r="2.7" fill={`url(#${gid})`} />
      <path d="M8.2 16.5C8.9 14.7 10.3 13.8 12 13.8C13.7 13.8 15.1 14.7 15.8 16.5" stroke={`url(#${gid})`} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/** 2026 Editorial Cover Canvas Icon */
export function CoverCanvasIcon({ className = 'w-4 h-4' }: { className?: string }) {
  const gid = `cover_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
      </defs>
      <rect x="3" y="4.5" width="18" height="15" rx="4" stroke={`url(#${gid})`} strokeWidth="1.8" fill={`url(#${gid})`} fillOpacity="0.18" />
      <circle cx="8.5" cy="9.5" r="1.6" fill="#FDE68A" />
      <path d="M4.8 17.2L9.4 12.7C10.1 12 11.2 12 11.9 12.7L14.2 15L16.3 13C17 12.3 18.1 12.3 18.8 13L20.2 14.5" stroke={`url(#${gid})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 2026 Precision Calligraphic Stylus Edit Icon */
export function StylusEditIcon({ className = 'w-4 h-4' }: { className?: string }) {
  const gid = `stylus_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M15.8 4.4L19.6 8.2L9.4 18.4L4.5 19.5L5.6 14.6L15.8 4.4Z"
        fill={`url(#${gid})`}
        fillOpacity="0.24"
        stroke={`url(#${gid})`}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.7L17.3 10.5" stroke={`url(#${gid})`} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 2026 Futuristic Remove Emblem (Replaces Ugly Trash Can Icon Everywhere!) */
export function RemoveCrossIcon({ className = 'w-4 h-4' }: { className?: string }) {
  const gid = `remove_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDA4AF" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
      </defs>
      <rect x="3.5" y="3.5" width="17" height="17" rx="6" fill={`url(#${gid})`} fillOpacity="0.2" stroke={`url(#${gid})`} strokeWidth="1.75" />
      <path d="M9.2 9.2L14.8 14.8M14.8 9.2L9.2 14.8" stroke="#FFE4E6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 2026 Sculpted Jewel Notification Bell */
export function NavBellIcon({ active, className = 'w-[20px] h-[20px]' }: NavIconProps) {
  const gid = `bell_${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="5" y1="3" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#FB7185" />
        </linearGradient>
      </defs>
      <path
        d="M18 10A6 6 0 0 0 6 10C6 15.2 4 17 4 17H20C20 17 18 15.2 18 10Z"
        fill={active ? `url(#${gid})` : 'none'}
        fillOpacity={active ? '0.28' : '0'}
        stroke={active ? `url(#${gid})` : 'currentColor'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 20A2.2 2.2 0 0 0 14 20" stroke={active ? '#FDA4AF' : 'currentColor'} strokeWidth="1.85" strokeLinecap="round" />
    </svg>
  );
}

/** Sleek 2026 Organic Curved Translucent Play Glyph for Pulse Videos */
export function PulsePlayGlyph({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <path
        d="M22.5 15.8C22.5 12.4 26.2 10.3 29.1 12.1L51.3 25.8C54 27.5 54 31.5 51.3 33.2L29.1 46.9C26.2 48.7 22.5 46.6 22.5 43.2V15.8Z"
        fill="rgba(255,255,255,0.62)"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Authentic Telegram-Style Circular Video Message Camera Icon */
export function TelegramVideoNoteIcon({ className = 'w-[19px] h-[19px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="4.5" width="18" height="15" rx="5.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="8.2" r="1" fill="currentColor" />
    </svg>
  );
}

/** Authentic Vector Platform Share Icons (ZERO Emojis!) */
export const SharePlatformIcons = {
  copy: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 13.5a4.5 4.5 0 0 0 6.36.32l2.32-2.32a4.5 4.5 0 0 0-6.36-6.36L11 6.45"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 10.5a4.5 4.5 0 0 0-6.36-.32l-2.32 2.32a4.5 4.5 0 0 0 6.36 6.36L13 17.55"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  whatsapp: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.5A9.4 9.4 0 0 0 3.9 16.7L2.6 21.4L7.5 20.1A9.4 9.4 0 1 0 12 2.5Z"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.4 8.5C9.1 8.5 8.6 8.9 8.5 9.5C8.3 10.6 9 12.2 10.4 13.6C11.8 15 13.4 15.7 14.5 15.5C15.1 15.4 15.5 14.9 15.5 14.6L15.7 13.6C15.7 13.3 15.5 13.1 15.2 13L13.9 12.4C13.6 12.3 13.3 12.4 13.1 12.6L12.6 13.2C11.9 12.9 11.1 12.1 10.8 11.4L11.4 10.9C11.6 10.7 11.7 10.4 11.6 10.1L11 8.8C10.9 8.6 10.7 8.5 10.4 8.5H9.4Z"
        fill="#FFFFFF"
      />
    </svg>
  ),
  telegram: (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.6 4.6L3.4 11.2C2.6 11.5 2.7 12.6 3.5 12.9L7.9 14.2L17.4 8.3L10.3 15L10 19.3C10.6 19.3 10.9 19 11.3 18.6L13.5 16.5L17.6 19.5C18.3 19.9 19 19.6 19.2 18.7L21.8 5.9C22 4.9 21.4 4.3 20.6 4.6Z"
        fill="#FFFFFF"
      />
    </svg>
  ),
  instagram: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="#FFFFFF" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="3.9" stroke="#FFFFFF" strokeWidth="1.9" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="#FFFFFF" />
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
        fill="#FFFFFF"
      />
    </svg>
  ),
  facebook: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 13.5H16.5L17.5 9.5H14V7.5C14 6.47 14 5.5 16 5.5H17.5V2.14C17.17 2.1 15.94 2 14.64 2C11.93 2 10 3.66 10 6.7V9.5H7V13.5H10V22H14V13.5Z"
        fill="#FFFFFF"
      />
    </svg>
  ),
  sms: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.5C6.8 3.5 3 7 3 11.4C3 13.8 4.2 16 6.1 17.5L4.8 20.6L8.7 19.3C9.7 19.6 10.8 19.8 12 19.8C17.2 19.8 21 16.3 21 11.4C21 7 17.2 3.5 12 3.5Z"
        fill="#FFFFFF"
      />
    </svg>
  ),
};
