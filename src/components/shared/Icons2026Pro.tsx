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

/** Flagship 2026 Multi-Layer Full-Bleed Vector Social Brand Medallions (ZERO Flat Generic Icons!) */
export const SharePlatformIcons = {
  copy: (
    <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
      <defs>
        <linearGradient id="sp_copy_bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2A2D38" />
          <stop offset="100%" stopColor="#161820" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="24" fill="url(#sp_copy_bg)" />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="23.25" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="1.5" />
      <path
        d="M21 26.5a5.5 5.5 0 0 0 7.78.38l3.1-3.1a5.5 5.5 0 0 0-7.78-7.78l-1.65 1.65"
        stroke="#25F4EE"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M27 21.5a5.5 5.5 0 0 0-7.78-.38l-3.1 3.1a5.5 5.5 0 0 0 7.78 7.78l1.65-1.65"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
      <defs>
        <linearGradient id="sp_wa_bg" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#42E66F" />
          <stop offset="55%" stopColor="#25D366" />
          <stop offset="100%" stopColor="#129E48" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="24" fill="url(#sp_wa_bg)" />
      <path
        d="M24.08 11.5C17.2 11.5 11.6 17.02 11.6 23.82C11.6 26.15 12.26 28.34 13.42 30.2L11.75 36.25L18.02 34.62C19.82 35.6 21.88 36.14 24.08 36.14C30.96 36.14 36.56 30.62 36.56 23.82C36.56 17.02 30.96 11.5 24.08 11.5Z"
        stroke="#FFFFFF"
        strokeWidth="2.35"
        strokeLinejoin="round"
      />
      <path
        d="M20.32 18.6C19.98 18.6 19.44 18.74 19.06 19.16C18.62 19.64 17.56 20.62 17.56 22.64C17.56 24.66 19.04 26.6 19.24 26.88C19.44 27.16 22.1 31.34 26.22 33.02C29.66 34.42 30.36 34.14 31.1 34.06C31.84 33.98 33.5 33.08 33.84 32.12C34.18 31.16 34.18 30.34 34.08 30.16C33.98 29.98 33.7 29.88 33.28 29.68C32.86 29.48 30.82 28.48 30.44 28.34C30.06 28.2 29.78 28.14 29.5 28.56C29.22 28.98 28.42 29.9 28.18 30.18C27.94 30.46 27.7 30.5 27.28 30.3C26.86 30.1 25.52 29.66 23.94 28.26C22.7 27.16 21.86 25.8 21.62 25.38C21.38 24.96 21.6 24.74 21.8 24.54C22 24.34 22.22 24.04 22.42 23.8C22.62 23.56 22.7 23.38 22.84 23.1C22.98 22.82 22.9 22.58 22.8 22.38C22.7 22.18 21.88 20.14 21.52 19.32C21.2 18.62 20.86 18.62 20.32 18.6Z"
        fill="#FFFFFF"
      />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
      <defs>
        <linearGradient id="sp_tg_bg" x1="24" y1="0" x2="24" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#37AEE2" />
          <stop offset="100%" stopColor="#1E96C8" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="24" fill="url(#sp_tg_bg)" />
      <path
        d="M34.8 14.3L11.6 23.25C10.55 23.66 10.6 25.14 11.68 25.48L17.4 27.28L30.85 18.85C31.35 18.54 31.82 19.2 31.38 19.6L20.52 29.42L20.1 34.95C20.1 35.62 20.9 35.95 21.38 35.48L24.78 32.18L30.52 36.42C31.46 37.1 32.8 36.58 33.05 35.44L36.55 15.95C36.8 14.62 35.96 13.85 34.8 14.3Z"
        fill="#FFFFFF"
      />
      <path d="M17.4 27.28L20.1 34.95L20.52 29.42L31.38 19.6L17.4 27.28Z" fill="#D2E8F5" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
      <defs>
        <radialGradient id="sp_ig_bg" cx="14" cy="42" r="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFDD55" />
          <stop offset="30%" stopColor="#FF543E" />
          <stop offset="65%" stopColor="#C837AB" />
          <stop offset="100%" stopColor="#5851DB" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="24" fill="url(#sp_ig_bg)" />
      <rect x="13" y="13" width="22" height="22" rx="6.5" stroke="#FFFFFF" strokeWidth="2.4" />
      <circle cx="24" cy="24" r="5.4" stroke="#FFFFFF" strokeWidth="2.4" />
      <circle cx="30.6" cy="17.4" r="1.5" fill="#FFFFFF" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
      <defs>
        <linearGradient id="sp_x_bg" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E2028" />
          <stop offset="100%" stopColor="#090A0D" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="24" fill="url(#sp_x_bg)" />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="23.25" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="1.5" />
      <path
        d="M29.9 14.5H33.55L25.55 23.62L34.95 36H27.58L21.82 28.48L15.22 36H11.56L20.12 26.22L11.1 14.5H18.66L23.86 21.38L29.9 14.5ZM28.62 33.82H30.65L17.52 16.56H15.35L28.62 33.82Z"
        fill="#FFFFFF"
      />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
      <defs>
        <linearGradient id="sp_fb_bg" x1="24" y1="0" x2="24" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E88FF" />
          <stop offset="100%" stopColor="#0D5BDD" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="24" fill="url(#sp_fb_bg)" />
      <path
        d="M26.5 39V26.5H30.7L31.4 21.6H26.5V18.5C26.5 17.08 26.9 16.12 28.95 16.12H31.5V11.75C31.05 11.68 29.52 11.55 27.75 11.55C24.02 11.55 21.5 13.82 21.5 17.98V21.6H17.3V26.5H21.5V39H26.5Z"
        fill="#FFFFFF"
      />
    </svg>
  ),
  sms: (
    <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
      <defs>
        <linearGradient id="sp_sms_bg" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="24" fill="url(#sp_sms_bg)" />
      <path
        d="M24 13C16.8 13 11.5 17.7 11.5 23.6C11.5 26.8 13.15 29.65 15.75 31.6L14 35.8L19.45 34.05C20.88 34.45 22.4 34.7 24 34.7C31.2 34.7 36.5 30 36.5 23.6C36.5 17.7 31.2 13 24 13Z"
        fill="#FFFFFF"
      />
      <circle cx="19.5" cy="23.8" r="1.75" fill="#059669" />
      <circle cx="24" cy="23.8" r="1.75" fill="#059669" />
      <circle cx="28.5" cy="23.8" r="1.75" fill="#059669" />
    </svg>
  ),
};
