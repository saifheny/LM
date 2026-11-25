import React, { useEffect, useRef, useState } from 'react';
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

/**
 * Centered & Auto-Expanding Multiline Composer Pill (ChatGPT / Gemini 2026 Precision):
 * - Single-line text & placeholder sit DEAD-CENTER vertically and cleanly aligned!
 * - Smoothly expands UPWARD line-by-line up to 148px as text wraps, then scrolls vertically.
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
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [multiline, setMultiline] = useState(false);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = '22px';
    const sh = el.scrollHeight;
    const nextH = Math.min(148, Math.max(22, sh));
    el.style.height = `${nextH}px`;
    setMultiline(sh > 30);
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSubmit(e as unknown as React.FormEvent);
      }
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`w-full min-h-[48px] rounded-[25px] bg-[#14141A]/95 backdrop-blur-xl border border-white/[0.11] ps-4 pe-1.5 py-1.5 flex gap-2 transition-all ${
        multiline ? 'items-end' : 'items-center'
      }`}
    >
      {extraStart && <div className="shrink-0 flex items-center">{extraStart}</div>}

      <textarea
        ref={taRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`flex-1 bg-transparent text-[14px] leading-[22px] text-[#F2F2F5] placeholder:text-[#686872] outline-none resize-none overflow-y-auto min-w-0 max-h-[148px] ${
          !value ? 'text-center placeholder:text-center' : 'text-start'
        } ${multiline ? 'py-1.5' : 'py-0'}`}
      />

      <div className="flex items-center gap-1 shrink-0">
        {onAttach && (
          <button
            type="button"
            onClick={onAttach}
            title="إرفاق"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#7A7A85] hover:text-[#F2F2F5] transition-colors cursor-pointer shrink-0"
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
              sparkleActive ? 'text-white' : 'text-[#7A7A85] hover:text-[#F2F2F5]'
            }`}
          >
            <Sparkles className="w-[18px] h-[18px] fill-current" strokeWidth={1.4} />
          </button>
        )}

        {extraEnd}

        {customAction ? customAction : <ChromeArrowButton type="submit" disabled={disabled} size={38} />}
      </div>
    </form>
  );
}
