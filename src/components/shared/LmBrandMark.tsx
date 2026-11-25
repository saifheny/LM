import React from 'react';
import { Crown, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Lang, RANK_META, RankId, VipTier } from '../../types';

export const APP_ICON_STYLES: Record<string, { bg: string; fg: string; ring: string; labelAr: string; labelEn: string }> = {
  default: { bg: '#151923', fg: '#F8FAFC', ring: 'rgba(47,107,255,0.45)', labelAr: 'LM الكلاسيكي', labelEn: 'LM Classic' },
  cobalt: { bg: '#2F6BFF', fg: '#FFFFFF', ring: 'rgba(47,107,255,0.55)', labelAr: 'أزرق ياقوتي', labelEn: 'Cobalt Blue' },
  platinum: { bg: '#0D0E12', fg: '#E6C35C', ring: 'rgba(212,175,55,0.65)', labelAr: 'أونيكس بلاتيني', labelEn: 'Imperial Onyx' },
  emerald: { bg: '#064E3B', fg: '#A7F3D0', ring: 'rgba(16,185,129,0.55)', labelAr: 'زمردي خاص', labelEn: 'Emerald Reserve' },
  gold: { bg: '#D4AF37', fg: '#0B0A08', ring: 'rgba(212,175,55,0.75)', labelAr: 'ذهبي ملكي', labelEn: 'Royal Gold' },
  minimal: { bg: '#F8FAFC', fg: '#090A0D', ring: 'rgba(148,163,184,0.5)', labelAr: 'أبيض مصقول', labelEn: 'Alabaster' },
};

export function LmBrandMark({ iconStyle = 'default', size = 34 }: { iconStyle?: string; size?: number }) {
  const s = APP_ICON_STYLES[iconStyle] || APP_ICON_STYLES.default;
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: s.bg,
        color: s.fg,
        boxShadow: `0 0 0 1px ${s.ring}`,
      }}
      className="rounded-xl flex items-center justify-center shrink-0 select-none transition-all duration-200"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" fill="none">
        <path d="M5 7V25H13.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 25V7L22 16.5L27.5 7V25" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function UserAvatar({
  initials,
  color,
  size = 38,
  vipTier = 0,
}: {
  initials: string;
  color: string;
  size?: number;
  vipTier?: VipTier;
}) {
  const ring =
    vipTier === 1
      ? '0 0 0 2px #D4AF37'
      : vipTier === 2
      ? '0 0 0 2px #60A5FA'
      : vipTier === 3
      ? '0 0 0 2px #10B981'
      : '0 0 0 1px rgba(255,255,255,0.12)';
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: ring,
        fontSize: Math.max(11, Math.round(size * 0.34)),
      }}
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0 select-none tracking-tight"
    >
      {initials}
    </div>
  );
}

export function VipBadge({ tier, compact = false }: { tier: VipTier; compact?: boolean }) {
  if (!tier) return null;
  const styles: Record<Exclude<VipTier, 0>, string> = {
    1: 'bg-[#D4AF37]/15 text-[#E8C85E] border-[#D4AF37]/40',
    2: 'bg-[#2F6BFF]/15 text-[#7CA4FF] border-[#2F6BFF]/40',
    3: 'bg-[#10B981]/15 text-[#4ADEB0] border-[#10B981]/40',
    4: 'bg-slate-400/15 text-slate-200 border-slate-400/35',
    5: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/35',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-mono-num font-semibold shrink-0 ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${styles[tier]}`}
    >
      {tier <= 2 && <Crown className="w-3 h-3" />}
      VIP {tier}
    </span>
  );
}

export function RankBadge({ rankId, lang }: { rankId: RankId; lang: Lang }) {
  const meta = RANK_META[rankId] || RANK_META.soldier;
  if (rankId === 'soldier') return null;
  return (
    <span
      style={{
        color: meta.color,
        borderColor: `${meta.color}44`,
        backgroundColor: `${meta.color}14`,
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium shrink-0"
    >
      {meta.supreme && <Crown className="w-3 h-3" />}
      {lang === 'ar' ? meta.ar : meta.en}
    </span>
  );
}

export function VerifiedIcon() {
  return <CheckCircle2 className="w-3.5 h-3.5 text-[#2F6BFF] shrink-0" />;
}

/** Clean, safe lightweight rich-text renderer (parses **bold**, `code`, and > quotes without raw Markdown markers) */
export function RichMessageText({ text }: { text: string }) {
  const lines = text.split('\n');
  const renderInline = (line: string) => {
    const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
    return tokens.map((tok, i) => {
      if (tok.startsWith('**') && tok.endsWith('**')) {
        return <strong key={i} className="font-semibold text-[var(--lm-text)]">{tok.slice(2, -2)}</strong>;
      }
      if (tok.startsWith('`') && tok.endsWith('`')) {
        return (
          <code key={i} dir="ltr" className="px-1.5 py-0.5 rounded bg-black/25 font-mono-num text-[11px] inline-block">
            {tok.slice(1, -1)}
          </code>
        );
      }
      if (tok.startsWith('_') && tok.endsWith('_') && tok.length > 2) {
        return <em key={i} className="opacity-90">{tok.slice(1, -1)}</em>;
      }
      return <React.Fragment key={i}>{tok}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />;
        if (line.trim() === '---') return <hr key={idx} className="border-white/10 my-1.5" />;
        if (line.startsWith('> ')) {
          return (
            <div key={idx} className="border-s-2 border-[var(--lm-accent)]/60 ps-3 py-0.5 opacity-85">
              {renderInline(line.slice(2))}
            </div>
          );
        }
        return <div key={idx}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

export function EditorialMediaCard({ styleKey, caption }: { styleKey: string; caption?: string | null }) {
  const configs: Record<string, { bg: string; accent: string; tag: string; metric: string }> = {
    'editorial-architecture': {
      bg: 'linear-gradient(135deg, #0E1320 0%, #151E32 55%, #0D111A 100%)',
      accent: '#2F6BFF',
      tag: 'UNIFIED ECOSYSTEM',
      metric: '12 Modular Services • 1 Account',
    },
    'studio-live': {
      bg: 'linear-gradient(135deg, #0D1917 0%, #112A24 55%, #0B1211 100%)',
      accent: '#10B981',
      tag: 'LIVE BROADCAST ENGINE',
      metric: 'VIP 1 (15s) • VIP 2 (10s) • VIP 3 (5s)',
    },
    'market-pulse': {
      bg: 'linear-gradient(135deg, #17140D 0%, #241E12 55%, #0F0D09 100%)',
      accent: '#D4AF37',
      tag: 'MENA MARKET RESEARCH',
      metric: 'EGX30 • Global Equities • Live Charts',
    },
    'visual-craft': {
      bg: 'linear-gradient(135deg, #13141B 0%, #1D202C 55%, #0C0D12 100%)',
      accent: '#94A3B8',
      tag: 'DESIGN SYSTEM',
      metric: 'Obsidian • Royal Gold • Alabaster',
    },
  };
  const c = configs[styleKey] || configs['editorial-architecture'];
  return (
    <div
      style={{ background: c.bg }}
      className="relative rounded-xl border border-white/10 overflow-hidden p-5 min-h-[175px] flex flex-col justify-between select-none"
    >
      <div
        style={{
          backgroundImage: `radial-gradient(circle at 85% 20%, ${c.accent}28, transparent 52%)`,
        }}
        className="absolute inset-0 pointer-events-none"
      />
      <div className="relative flex items-center justify-between gap-2">
        <span
          style={{ color: c.accent, borderColor: `${c.accent}40`, backgroundColor: `${c.accent}12` }}
          className="text-[10px] font-mono-num tracking-wider uppercase px-2.5 py-1 rounded-md border"
        >
          {c.tag}
        </span>
        <ShieldCheck className="w-4 h-4 text-white/40" />
      </div>
      <div className="relative mt-8">
        <p className="text-base font-semibold text-white tracking-tight">{caption || 'LM Platform'}</p>
        <p className="text-xs text-white/60 mt-1 font-mono-num">{c.metric}</p>
      </div>
    </div>
  );
}
