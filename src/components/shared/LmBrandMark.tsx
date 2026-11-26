import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { Components } from 'react-markdown';

export function LmBrandMark({ size = 34 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-xl bg-[#0A0A0C] border border-white/[0.14] text-[#F5F5F7] flex items-center justify-center shrink-0 select-none"
    >
      <svg width={size * 0.54} height={size * 0.54} viewBox="0 0 32 32" fill="none">
        <path d="M5 7V25H13.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 25V7L22 16.5L27.5 7V25" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/**
 * Luxury Distinct AI Summon Emblem — unmistakably marks any user message/comment/voice calling LM AI
 */
export function AiSummonBadge({ label = 'AI', compact = false }: { label?: string; compact?: boolean }) {
  return (
    <span className={`lm-ai-badge ${compact ? '!px-1.5 !py-[1px] !text-[9px]' : ''}`}>
      <Sparkles className={compact ? 'w-2.5 h-2.5 fill-current' : 'w-3 h-3 fill-current'} strokeWidth={1.8} />
      <span className="font-mono-num leading-none">{label}</span>
    </span>
  );
}

export function UserAvatar({
  initials,
  color = '#27272A',
  avatarUrl,
  size = 40,
  online = false,
}: {
  initials: string;
  color?: string;
  avatarUrl?: string | null;
  size?: number;
  online?: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div style={{ width: size, height: size }} className="relative shrink-0 select-none">
      {avatarUrl && !imgErr ? (
        <img
          src={avatarUrl}
          alt={initials}
          onError={() => setImgErr(true)}
          style={{ width: size, height: size }}
          className="rounded-full object-cover block border border-white/[0.1]"
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            backgroundColor: '#141417',
            borderColor: color ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.1)',
            fontSize: Math.max(11, Math.round(size * 0.34)),
          }}
          className="rounded-full border flex items-center justify-center font-semibold text-[#E4E4E7] tracking-tight"
        >
          {initials}
        </div>
      )}
      {online && (
        <span
          style={{ width: Math.max(9, size * 0.24), height: Math.max(9, size * 0.24) }}
          className="absolute bottom-0 end-0 rounded-full bg-[#22C55E] border-2 border-black"
        />
      )}
    </div>
  );
}

export function VerifiedIcon() {
  return (
    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#F5F5F7] text-black shrink-0">
      <Check className="w-2.5 h-2.5" strokeWidth={3.2} />
    </span>
  );
}

/** Shared ReactMarkdown link renderer with bright white specular shine effect */
export const MARKDOWN_LINK_COMPONENTS: Components = {
  a: ({ href, children, ...props }) => (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="lm-link-shine"
    >
      {children}
    </a>
  ),
};

const URL_TOKEN_RX = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/gi;

function renderTextWithShiningLinks(str: string, keyPrefix: string) {
  const parts = str.split(URL_TOKEN_RX);
  return parts.map((part, idx) => {
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const href = /^https?:\/\//i.test(part) ? part : `https://${part}`;
      return (
        <a
          key={`${keyPrefix}-lnk-${idx}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          dir="ltr"
          className="lm-link-shine"
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={`${keyPrefix}-txt-${idx}`}>{part}</React.Fragment>;
  });
}

export function RichMessageText({ text }: { text: string }) {
  const lines = text.split('\n');
  const renderInline = (line: string, lineIdx: number) => {
    const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
    return tokens.map((tok, i) => {
      if (tok.startsWith('**') && tok.endsWith('**')) {
        return <strong key={i} className="font-semibold text-white">{tok.slice(2, -2)}</strong>;
      }
      if (tok.startsWith('`') && tok.endsWith('`')) {
        return (
          <code key={i} dir="ltr" className="px-1.5 py-0.5 rounded bg-white/[0.07] font-mono-num text-[11px] inline-block">
            {tok.slice(1, -1)}
          </code>
        );
      }
      if (tok.startsWith('_') && tok.endsWith('_') && tok.length > 2) {
        return <em key={i} className="opacity-85">{tok.slice(1, -1)}</em>;
      }
      return <React.Fragment key={i}>{renderTextWithShiningLinks(tok, `${lineIdx}-${i}`)}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />;
        if (line.trim() === '---') return <hr key={idx} className="border-white/[0.08] my-1.5" />;
        if (line.startsWith('> ')) {
          return (
            <div key={idx} className="border-s-2 border-white/25 ps-2.5 py-0.5 text-[#A1A1AA]">
              {renderInline(line.slice(2), idx)}
            </div>
          );
        }
        return <div key={idx}>{renderInline(line, idx)}</div>;
      })}
    </div>
  );
}
