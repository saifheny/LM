import React, { useState } from 'react';
import { Crown, CheckCircle2 } from 'lucide-react';
import { Lang, RANK_META, RankId, VipTier } from '../../types';

export const APP_ICON_STYLES: Record<string, { bg: string; fg: string; ring: string; labelAr: string; labelEn: string }> = {
  default: { bg: 'linear-gradient(135deg, #3390EC, #8774E1)', fg: '#FFFFFF', ring: 'rgba(135,116,225,0.45)', labelAr: 'LM تيليجرام', labelEn: 'LM Signature' },
  cobalt: { bg: '#2F6BFF', fg: '#FFFFFF', ring: 'rgba(47,107,255,0.55)', labelAr: 'أزرق ياقوتي', labelEn: 'Cobalt Blue' },
  platinum: { bg: 'linear-gradient(135deg, #161821, #090A0E)', fg: '#E6C35C', ring: 'rgba(212,175,55,0.65)', labelAr: 'أونيكس ملكي', labelEn: 'Imperial Onyx' },
  emerald: { bg: 'linear-gradient(135deg, #059669, #064E3B)', fg: '#ECFDF5', ring: 'rgba(16,185,129,0.55)', labelAr: 'زمردي خاص', labelEn: 'Emerald Reserve' },
  gold: { bg: 'linear-gradient(135deg, #E5C158, #B8860B)', fg: '#0B0A08', ring: 'rgba(212,175,55,0.75)', labelAr: 'ذهبي خالص', labelEn: 'Royal Gold' },
  minimal: { bg: '#F8FAFC', fg: '#090A0D', ring: 'rgba(148,163,184,0.5)', labelAr: 'أبيض نقي', labelEn: 'Alabaster' },
};

export function LmBrandMark({ iconStyle = 'default', size = 38 }: { iconStyle?: string; size?: number }) {
  const s = APP_ICON_STYLES[iconStyle] || APP_ICON_STYLES.default;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: s.bg,
        color: s.fg,
        boxShadow: `0 4px 14px -2px ${s.ring}`,
      }}
      className="rounded-2xl flex items-center justify-center shrink-0 select-none transition-transform duration-200 hover:scale-105"
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 32 32" fill="none">
        <path d="M5 7V25H13.5" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 25V7L22 16.5L27.5 7V25" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function UserAvatar({
  initials,
  color,
  avatarUrl,
  size = 42,
  vipTier = 0,
  online = false,
}: {
  initials: string;
  color: string;
  avatarUrl?: string | null;
  size?: number;
  vipTier?: VipTier;
  online?: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);
  const ring =
    vipTier === 1
      ? '0 0 0 2px #D4AF37'
      : vipTier === 2
      ? '0 0 0 2px #3390EC'
      : vipTier === 3
      ? '0 0 0 2px #10B981'
      : 'none';

  return (
    <div style={{ width: size, height: size }} className="relative shrink-0 select-none">
      {avatarUrl && !imgErr ? (
        <img
          src={avatarUrl}
          alt={initials}
          onError={() => setImgErr(true)}
          style={{ width: size, height: size, boxShadow: ring }}
          className="rounded-full object-cover block"
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            boxShadow: ring,
            fontSize: Math.max(11, Math.round(size * 0.35)),
          }}
          className="rounded-full flex items-center justify-center font-bold text-white tracking-tight"
        >
          {initials}
        </div>
      )}
      {online && (
        <span
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
          className="absolute bottom-0 end-0 rounded-full bg-[#00C73E] border-2 border-[#212121]"
        />
      )}
    </div>
  );
}

export function VipBadge({ tier, compact = false }: { tier: VipTier; compact?: boolean }) {
  if (!tier) return null;
  const styles: Record<Exclude<VipTier, 0>, string> = {
    1: 'bg-[#D4AF37]/20 text-[#F3D26B] border-[#D4AF37]/45',
    2: 'bg-[#3390EC]/20 text-[#6CB6FF] border-[#3390EC]/45',
    3: 'bg-[#10B981]/20 text-[#4ADEB0] border-[#10B981]/45',
    4: 'bg-purple-500/20 text-purple-300 border-purple-400/35',
    5: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/35',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-mono-num font-semibold shrink-0 ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${styles[tier]}`}
    >
      {tier <= 2 && <Crown className="w-2.5 h-2.5" />}
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
        backgroundColor: `${meta.color}16`,
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0"
    >
      {meta.supreme && <Crown className="w-2.5 h-2.5" />}
      {lang === 'ar' ? meta.ar : meta.en}
    </span>
  );
}

export function VerifiedIcon() {
  return <CheckCircle2 className="w-4 h-4 text-[#3390EC] fill-[#3390EC]/20 shrink-0" />;
}

export function RichMessageText({ text }: { text: string }) {
  const lines = text.split('\n');
  const renderInline = (line: string) => {
    const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
    return tokens.map((tok, i) => {
      if (tok.startsWith('**') && tok.endsWith('**')) {
        return <strong key={i} className="font-semibold">{tok.slice(2, -2)}</strong>;
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
    <div className="space-y-1">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />;
        if (line.trim() === '---') return <hr key={idx} className="border-white/10 my-1.5" />;
        if (line.startsWith('> ')) {
          return (
            <div key={idx} className="border-s-2 border-[var(--lm-accent)] ps-2.5 py-0.5 opacity-90">
              {renderInline(line.slice(2))}
            </div>
          );
        }
        return <div key={idx}>{renderInline(line)}</div>;
      })}
    </div>
  );
}
