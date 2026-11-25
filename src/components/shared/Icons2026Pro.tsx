import React from 'react';

interface NavIconProps {
  active?: boolean;
  className?: string;
}

/** 2026 Bespoke Duotone/Filled Navigation Icons (Apple SF Symbols / OpenAI 2026 style) */
export function NavCommunityIcon({ active, className = 'w-[22px] h-[22px]' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="3"
        y="3"
        width="8.5"
        height="11"
        rx="3.2"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? '1.6' : '1.75'}
      />
      <rect
        x="13.5"
        y="3"
        width="7.5"
        height="7.5"
        rx="3"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? '0.45' : '0'}
        stroke="currentColor"
        strokeWidth={active ? '1.6' : '1.75'}
      />
      <rect
        x="3"
        y="16"
        width="8.5"
        height="5"
        rx="2.5"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? '0.45' : '0'}
        stroke="currentColor"
        strokeWidth={active ? '1.6' : '1.75'}
      />
      <rect
        x="13.5"
        y="12.5"
        width="7.5"
        height="8.5"
        rx="3"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? '1.6' : '1.75'}
      />
    </svg>
  );
}

/** Pulse ("نبض") Short Video 2026 Sculpted Icon */
export function NavPulseIcon({ active, className = 'w-[22px] h-[22px]' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="5.5"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? '0.18' : '0'}
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M10.3 9.1C10.3 8.35 11.12 7.89 11.76 8.28L16.35 11.18C16.94 11.55 16.94 12.42 16.35 12.79L11.76 15.69C11.12 16.08 10.3 15.62 10.3 14.87V9.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Live ("مباشر") 2026 Signal Core Icon */
export function NavLiveIcon({ active, className = 'w-[22px] h-[22px]' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r={active ? '3.3' : '2.7'} fill="currentColor" />
      <path d="M7.8 8.2A6 6 0 0 0 7.8 15.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.2 8.2A6 6 0 0 1 16.2 15.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.8 5.4A9.8 9.8 0 0 0 4.8 18.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity={active ? '1' : '0.6'} />
      <path d="M19.2 5.4A9.8 9.8 0 0 1 19.2 18.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity={active ? '1' : '0.6'} />
    </svg>
  );
}

/** Chat ("الدردشة") 2026 Sculpted Speech Squircle */
export function NavChatIcon({ active, className = 'w-[22px] h-[22px]' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3.5C7 3.5 3 7.1 3 11.6C3 14 4.1 16.1 5.9 17.6L4.6 20.8L8.4 19.6C9.5 19.9 10.7 20.1 12 20.1C17 20.1 21 16.5 21 11.6C21 7.1 17 3.5 12 3.5Z"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? '0.18' : '0'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="8.8" cy="11.8" r="1.2" fill="currentColor" />
      <circle cx="12" cy="11.8" r="1.2" fill="currentColor" />
      <circle cx="15.2" cy="11.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** AI 2026 Neural Star Emblem */
export function NavAiIcon({ active, className = 'w-[22px] h-[22px]' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M11.5 3C12.2 7.9 15.1 10.8 20 11.5C15.1 12.2 12.2 15.1 11.5 20C10.8 15.1 7.9 12.2 3 11.5C7.9 10.8 10.8 7.9 11.5 3Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M18.8 3.2C19 4.7 19.8 5.5 21.3 5.7C19.8 5.9 19 6.7 18.8 8.2C18.6 6.7 17.8 5.9 16.3 5.7C17.8 5.5 18.6 4.7 18.8 3.2Z"
        fill="currentColor"
      />
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

/** Authentic Telegram-Style Circular Video Message Camera Icon (NOT CircleDot!) */
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
