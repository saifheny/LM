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

  const isNeutralAvatar = avatarUrl === 'lm:neutral';

  return (
    <div style={{ width: size, height: size }} className="relative shrink-0 select-none">
      {isNeutralAvatar ? (
        <div
          style={{ width: size, height: size }}
          className="rounded-full border border-white/[0.14] bg-gradient-to-b from-[#23232D] to-[#111117] flex items-center justify-center overflow-hidden shadow-inner"
        >
          {/* Universally Gender-Neutral Sculpted Silhouette Avatar (Zero gender markers) */}
          <svg
            width={Math.round(size * 0.62)}
            height={Math.round(size * 0.62)}
            viewBox="0 0 32 32"
            fill="none"
            className="text-[#D4D4DC]"
          >
            <circle cx="16" cy="11.5" r="5.2" fill="currentColor" fillOpacity="0.88" />
            <path
              d="M6.5 26.8C7.4 21.8 11.2 19 16 19C20.8 19 24.6 21.8 25.5 26.8"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="currentColor"
              fillOpacity="0.22"
            />
          </svg>
        </div>
      ) : avatarUrl && !imgErr ? (
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

const RICH_ENTITY_RX = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|@[A-Za-z0-9_]{2,30}|#[\p{L}\p{N}_]{2,40})/giu;

function renderTextWithRichEntities(
  str: string,
  keyPrefix: string,
  onMentionClick?: (username: string) => void,
  onHashtagClick?: (tag: string) => void
) {
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  RICH_ENTITY_RX.lastIndex = 0;

  let m: RegExpExecArray | null;
  let tokenIdx = 0;
  while ((m = RICH_ENTITY_RX.exec(str)) !== null) {
    const matchText = m[0];
    const start = m.index;
    const prevChar = start > 0 ? str[start - 1] : '';

    // Avoid matching emails like name@domain.com as @mentions
    if (matchText.startsWith('@') && /[A-Za-z0-9._+-]/.test(prevChar)) {
      continue;
    }

    if (start > lastIdx) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-txt-${tokenIdx++}`}>{str.slice(lastIdx, start)}</React.Fragment>
      );
    }

    if (/^(https?:\/\/|www\.)/i.test(matchText)) {
      const href = /^https?:\/\//i.test(matchText) ? matchText : `https://${matchText}`;
      nodes.push(
        <a
          key={`${keyPrefix}-lnk-${tokenIdx++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          dir="ltr"
          className="lm-link-shine"
        >
          {matchText}
        </a>
      );
    } else if (matchText.startsWith('@')) {
      const handle = matchText.slice(1);
      nodes.push(
        onMentionClick ? (
          <button
            key={`${keyPrefix}-mnt-${tokenIdx++}`}
            type="button"
            dir="ltr"
            onClick={e => {
              e.stopPropagation();
              onMentionClick(handle);
            }}
            className="inline font-semibold text-[#FBBF24] hover:text-[#FDE68A] hover:underline cursor-pointer transition-colors"
          >
            {matchText}
          </button>
        ) : (
          <span key={`${keyPrefix}-mnt-${tokenIdx++}`} dir="ltr" className="font-semibold text-[#FBBF24]">
            {matchText}
          </span>
        )
      );
    } else if (matchText.startsWith('#')) {
      const tag = matchText.slice(1);
      nodes.push(
        onHashtagClick ? (
          <button
            key={`${keyPrefix}-tag-${tokenIdx++}`}
            type="button"
            onClick={e => {
              e.stopPropagation();
              onHashtagClick(tag);
            }}
            className="inline font-medium text-[#FB7185] hover:text-[#FDA4AF] hover:underline cursor-pointer transition-colors"
          >
            {matchText}
          </button>
        ) : (
          <span key={`${keyPrefix}-tag-${tokenIdx++}`} className="font-medium text-[#FB7185]">
            {matchText}
          </span>
        )
      );
    }

    lastIdx = start + matchText.length;
  }

  if (lastIdx < str.length) {
    nodes.push(<React.Fragment key={`${keyPrefix}-end`}>{str.slice(lastIdx)}</React.Fragment>);
  }
  return nodes;
}

export function RichMessageText({
  text,
  onMentionClick,
  onHashtagClick,
  maxChars,
  lang = 'ar',
}: {
  text: string;
  onMentionClick?: (username: string) => void;
  onHashtagClick?: (tag: string) => void;
  maxChars?: number;
  lang?: 'ar' | 'en';
}) {
  const [expanded, setExpanded] = React.useState(false);
  const shouldClamp = Boolean(maxChars && text.length > maxChars && !expanded);
  const displayText = shouldClamp && maxChars ? `${text.slice(0, maxChars).trimEnd()}...` : text;
  const lines = displayText.split('\n');
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
      return (
        <React.Fragment key={i}>
          {renderTextWithRichEntities(tok, `${lineIdx}-${i}`, onMentionClick, onHashtagClick)}
        </React.Fragment>
      );
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
      {maxChars && text.length > maxChars && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            setExpanded(v => !v);
          }}
          className="text-xs font-semibold text-[#A1A1AA] hover:text-white cursor-pointer transition-colors pt-0.5"
        >
          {expanded ? (lang === 'ar' ? 'عرض أقل' : 'Show less') : (lang === 'ar' ? 'عرض المزيد' : 'Show more')}
        </button>
      )}
    </div>
  );
}
