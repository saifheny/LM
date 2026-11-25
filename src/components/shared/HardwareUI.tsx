import React from 'react';
import { ArrowUp, Paperclip, Sparkles } from 'lucide-react';

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
  customAction,
  disabled = false,
  onFocus,
  onBlur,
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
  customAction?: React.ReactNode;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="w-full min-h-[52px] rounded-full bg-[#070709]/95 backdrop-blur-md border border-white/[0.11] ps-4 pe-1.5 py-1.5 flex items-center gap-2"
    >
      {extraStart}

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[14px] text-[#F5F5F7] placeholder:text-[#52525B] outline-none min-w-0"
      />

      {onAttach && (
        <button
          type="button"
          onClick={onAttach}
          title="إرفاق"
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

      {customAction ? customAction : <ChromeArrowButton type="submit" disabled={disabled} size={40} />}
    </form>
  );
}
