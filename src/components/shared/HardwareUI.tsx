import React from 'react';
import { ArrowUp, Paperclip, Sparkles } from 'lucide-react';

/**
 * Exact implementation of Image 1:
 * Pitch-black spherical dome button ringed by a razor-sharp brushed chrome & micro-prism refraction bezel.
 */
export function ChromeArrowButton({
  onClick,
  type = 'button',
  disabled = false,
  size = 40,
  icon,
  title,
}: {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  size?: number;
  icon?: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ width: size, height: size }}
      className="chrome-rim-btn shrink-0 cursor-pointer disabled:opacity-35 disabled:pointer-events-none"
    >
      <span className="chrome-rim-btn-inner text-[#A1A1AA] hover:text-white transition-colors">
        {icon || <ArrowUp style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={2} />}
      </span>
    </button>
  );
}

/**
 * Exact Pitch-Black Pill Composer Bar (Image 1 reference)
 */
export function ObsidianComposerPill({
  value,
  onChange,
  onSubmit,
  placeholder,
  onAttach,
  onSparkle,
  sparkleActive = false,
  extraStart,
  extraEnd,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder: string;
  onAttach?: () => void;
  onSparkle?: () => void;
  sparkleActive?: boolean;
  extraStart?: React.ReactNode;
  extraEnd?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="w-full min-h-[52px] rounded-full bg-[#050506] border border-white/[0.1] ps-4 pe-1.5 py-1.5 flex items-center gap-2"
    >
      {extraStart}

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[14px] text-[#F5F5F7] placeholder:text-[#52525B] outline-none min-w-0"
      />

      {onAttach && (
        <button
          type="button"
          onClick={onAttach}
          title="إرفاق ملف"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#71717A] hover:text-[#E4E4E7] transition-colors cursor-pointer shrink-0"
        >
          <Paperclip className="w-[18px] h-[18px]" strokeWidth={1.8} />
        </button>
      )}

      {onSparkle && (
        <button
          type="button"
          onClick={onSparkle}
          title="LM AI"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
            sparkleActive ? 'text-white' : 'text-[#71717A] hover:text-[#E4E4E7]'
          }`}
        >
          <Sparkles className="w-[18px] h-[18px] fill-current" strokeWidth={1.4} />
        </button>
      )}

      {extraEnd}

      <ChromeArrowButton type="submit" disabled={disabled} size={40} />
    </form>
  );
}

/**
 * Exact implementation of Image 2:
 * YouMotion-inspired Dark OLED Squircle Tile with razor-sharp warm-amber / cool-lavender rim & zero outer haze.
 */
export function SpecularSquircleTile({
  glyph,
  label,
  sublabel,
  onClick,
  centered = false,
}: {
  glyph: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  centered?: boolean;
}) {
  return (
    <button onClick={onClick} type="button" className="squircle-rim-tile cursor-pointer group w-full">
      <div
        className={`squircle-rim-tile-inner p-4 flex flex-col ${
          centered ? 'items-center justify-center text-center min-h-[126px] gap-2.5' : 'justify-between text-start min-h-[118px]'
        }`}
      >
        <div className="w-12 h-12 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
          {glyph}
        </div>
        <div>
          <div className="text-[12.5px] font-semibold text-[#F5F5F7] tracking-tight">{label}</div>
          {sublabel && <div className="text-[11px] text-[#71717A] mt-0.5 line-clamp-1">{sublabel}</div>}
        </div>
      </div>
    </button>
  );
}

/**
 * Sculpted Tactile Glyphs directly inspired by Image 2 (YouMotion aesthetic — zero 3D toy clutter)
 */
export const SquircleGlyphs = {
  CloudBloom: (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="cbGrad" x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#C4B5FD" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
      </defs>
      <path
        d="M24 7C26.7 7 28.9 9.2 29.2 11.9C31.7 10.6 34.8 11.4 36.2 13.8C37.6 16.2 36.8 19.3 34.5 20.8C37.1 21.6 38.7 24.3 38 27C37.3 29.7 34.6 31.3 31.9 30.7C32.7 33.3 31.3 36.1 28.7 37C26.1 37.9 23.3 36.6 22.3 34.1C20.9 36.5 17.8 37.4 15.4 36C13 34.6 12.1 31.6 13.4 29.1C10.7 29.4 8.3 27.5 8 24.8C7.7 22.1 9.6 19.6 12.3 19.2C10.6 17.1 10.9 14 13 12.2C15.1 10.4 18.2 10.7 20 12.7C20.2 9.5 21.5 7 24 7Z"
        fill="url(#cbGrad)"
      />
      <path d="M20.5 23.5C21.5 25.3 26.5 25.3 27.5 23.5" stroke="#1E1B4B" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  LiquidFlame: (
    <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="lfGrad" x1="20" y1="8" x2="28" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E9D5FF" />
          <stop offset="45%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#6B21A8" />
        </linearGradient>
      </defs>
      <circle cx="25" cy="9" r="2.2" fill="#E9D5FF" />
      <path
        d="M25.5 14C21 16.5 18 21 19.5 25C20.5 27.6 18 29.5 17.5 32.5C17 36.5 20.5 40 25 40C30 40 33.5 36 32.5 31.5C31.8 28.4 28.5 27 29.2 23.5C29.8 20.5 32 18.5 29.5 15.5C28.2 14 26.8 13.3 25.5 14Z"
        fill="url(#lfGrad)"
      />
      <path d="M22 33.5C22 35.5 23.5 37 25.5 37" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
    </svg>
  ),
  LoopBubble: (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="lbGrad" x1="10" y1="12" x2="38" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#A5B4FC" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <path
        d="M24 12C15.7 12 9 17.4 9 24C9 27.4 10.8 30.5 13.7 32.6L11.5 36.5L17.8 35.1C19.7 35.7 21.8 36 24 36C32.3 36 39 30.6 39 24C39 17.4 32.3 12 24 12Z"
        fill="url(#lbGrad)"
      />
      <path
        d="M15.5 25.5C18.5 24.5 21.5 20.5 20 19.5C18.5 18.5 17.5 22.5 20.5 24.5C23.5 26.5 27.5 20.5 26 19.5C24.5 18.5 23.8 23 27 25C29.5 26.5 31.8 24 33 22.5"
        stroke="#1E1B4B"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  ),
  ThreeDots: (
    <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
      <circle cx="14" cy="26" r="3.2" fill="#FFFFFF" />
      <circle cx="24" cy="24" r="3.2" fill="#FFFFFF" />
      <circle cx="34" cy="22" r="3.2" fill="#FFFFFF" />
    </svg>
  ),
  PrismDiamond: (
    <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="pdGrad" x1="12" y1="12" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#D8B4FE" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
      </defs>
      <path d="M16 13H32L39 22L24 37L9 22L16 13Z" fill="url(#pdGrad)" />
      <path d="M9 22H39M16 13L20 22L24 37M32 13L28 22L24 37" stroke="#3B0764" strokeOpacity="0.35" strokeWidth="1.4" />
    </svg>
  ),
  IcePulse: (
    <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="ipGrad" x1="14" y1="12" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <path
        d="M24 36.5C24 36.5 11 28.2 11 19.5C11 15.4 14.2 12.5 18 12.5C20.6 12.5 22.8 13.9 24 16C25.2 13.9 27.4 12.5 30 12.5C33.8 12.5 37 15.4 37 19.5C37 28.2 24 36.5 24 36.5Z"
        fill="url(#ipGrad)"
      />
    </svg>
  ),
};
