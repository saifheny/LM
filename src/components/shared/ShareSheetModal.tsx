import React, { useEffect, useState } from 'react';
import { Check, Flag, Image as ImageIcon, Link2, Send, Share2 } from 'lucide-react';
import { ConversationItem, UserProfile } from '../../types';
import { LmBrandMark, UserAvatar } from './LmBrandMark';
import { SharePlatformIcons } from './Icons2026Pro';
import { CloseOrbButton } from './ModalChrome2026';
import { apiGet, apiPost } from '../../lib/api';

export interface SharePayload {
  kind: 'app' | 'post' | 'profile' | 'video' | 'live';
  targetId?: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  avatarInitials?: string;
  badge?: string;
  path: string;
  onShared?: (sharesCount: number, counted: boolean) => void;
  onReport?: () => void;
}

const KIND_BADGES: Record<SharePayload['kind'], string> = {
  app: 'تطبيق LM',
  post: 'منشور',
  profile: 'ملف شخصي',
  video: 'فيديو نبض',
  live: 'بث مباشر',
};

function isUsableImageUrl(u?: string | null): u is string {
  return Boolean(u && typeof u === 'string' && !u.startsWith('lm:') && u.trim().length > 0);
}

/**
 * Generates a crisp 1080x560 PNG Share Card on the fly so even guest accounts
 * or users without custom photos can always share a real high-res image card!
 */
async function generateShareCardPng(opts: {
  title: string;
  subtitle?: string;
  snippet?: string;
  badge: string;
  fullUrl: string;
  imageUrl?: string | null;
  initials?: string;
}): Promise<File | null> {
  try {
    const W = 1080;
    const H = 560;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Rich midnight navy cosmic gradient background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0E1621');
    bg.addColorStop(0.55, '#172334');
    bg.addColorStop(1, '#1B1D36');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle cosmic violet + sky-blue atmospheric glows
    const g1 = ctx.createRadialGradient(W * 0.82, H * 0.2, 20, W * 0.82, H * 0.2, 360);
    g1.addColorStop(0, 'rgba(124, 92, 255, 0.38)');
    g1.addColorStop(1, 'rgba(124, 92, 255, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    const g2 = ctx.createRadialGradient(W * 0.16, H * 0.88, 20, W * 0.16, H * 0.88, 320);
    g2.addColorStop(0, 'rgba(73, 138, 245, 0.28)');
    g2.addColorStop(1, 'rgba(73, 138, 245, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // Outer glass card frame
    ctx.strokeStyle = 'rgba(148, 179, 214, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(36, 36, W - 72, H - 72, 34);
    ctx.stroke();

    // Top LM mark + kind pill
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('LM', 80, 108);

    ctx.fillStyle = 'rgba(124, 92, 255, 0.22)';
    ctx.beginPath();
    ctx.roundRect(W - 250, 72, 172, 42, 21);
    ctx.fill();
    ctx.fillStyle = '#E6E0FF';
    ctx.font = '600 21px "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.badge, W - 164, 100);
    ctx.textAlign = 'left';

    // Avatar / Thumbnail circle on left
    const cx = 170;
    const cy = 285;
    const r = 88;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    let drewImg = false;
    if (isUsableImageUrl(opts.imageUrl)) {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.crossOrigin = 'anonymous';
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = opts.imageUrl!;
        });
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
        drewImg = true;
      } catch {
        drewImg = false;
      }
    }

    if (!drewImg) {
      const avGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      avGrad.addColorStop(0, '#7C5CFF');
      avGrad.addColorStop(1, '#498AF5');
      ctx.fillStyle = avGrad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 54px "Plus Jakarta Sans", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((opts.initials || 'LM').slice(0, 2).toUpperCase(), cx, cy + 2);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Title, Handle & Snippet
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 44px "Plus Jakarta Sans", "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(opts.title.slice(0, 32), 296, 255);

    if (opts.subtitle) {
      ctx.fillStyle = '#9BB4D0';
      ctx.font = '500 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(opts.subtitle.slice(0, 42), 296, 300);
    }

    if (opts.snippet) {
      ctx.fillStyle = '#CFDCEB';
      ctx.font = '400 24px "IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif';
      const clean = opts.snippet.replace(/\s+/g, ' ').trim();
      ctx.fillText(clean.slice(0, 56) + (clean.length > 56 ? '...' : ''), 296, 352);
    }

    // Bottom link bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(80, H - 118, W - 160, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#A8C5E8';
    ctx.font = '500 21px "Plus Jakarta Sans", monospace';
    ctx.fillText(opts.fullUrl.slice(0, 68), 106, H - 85);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return new File([blob], 'lm-share-card.png', { type: 'image/png' });
  } catch {
    return null;
  }
}

export function ShareSheetModal({
  payload,
  currentUser,
  onClose,
}: {
  payload: SharePayload | null;
  currentUser: UserProfile;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<ConversationItem[]>([]);
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [sharingCard, setSharingCard] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!payload) return;
    setSentIds({});
    setCopied(false);
    setToast('');
    apiGet<{ ok: boolean; conversations: ConversationItem[] }>(`/api/conversations?userId=${currentUser.id}`)
      .then(r => setContacts(r.conversations))
      .catch(() => {});
  }, [payload, currentUser.id]);

  if (!payload) return null;
  const active = payload;

  const fullUrl = `${window.location.origin}${active.path.startsWith('/') ? active.path : `/${active.path}`}`;
  const shareText = active.snippet ? `${active.title}\n${active.snippet}` : active.title;
  const badgeLabel = active.badge || KIND_BADGES[active.kind];
  const validPreviewImg = isUsableImageUrl(active.imageUrl) ? active.imageUrl : null;

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(cur => (cur === msg ? '' : cur)), 2200);
  }

  function recordUniqueShare(channel: string) {
    if (active.kind === 'app') return;
    const derivedId =
      active.targetId ||
      active.path.replace(/^\/(post|pulse|live|u)\//, '').split(/[?#]/)[0] ||
      '';
    if (!derivedId) return;
    apiPost<{ ok: boolean; counted: boolean; sharesCount: number }>('/api/shares/track', {
      targetType: active.kind,
      targetId: derivedId,
      userId: currentUser.id,
      channel,
    })
      .then(res => {
        if (res.ok) active.onShared?.(res.sharesCount, res.counted);
      })
      .catch(() => {});
  }

  async function copyLink() {
    recordUniqueShare('copy');
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      flash('تم نسخ الرابط');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      flash(fullUrl);
    }
  }

  async function shareAsImageCard() {
    if (sharingCard) return;
    setSharingCard(true);
    try {
      const file = await generateShareCardPng({
        title: active.title,
        subtitle: active.subtitle,
        snippet: active.snippet,
        badge: badgeLabel,
        fullUrl,
        imageUrl: validPreviewImg || (isUsableImageUrl(active.avatarUrl) ? active.avatarUrl : null),
        initials: active.avatarInitials || active.title.slice(0, 2),
      });
      if (!file) {
        await copyLink();
        return;
      }
      recordUniqueShare('image_card');
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
        try {
          await nav.share({
            title: active.title,
            text: `${shareText}\n${fullUrl}`,
            files: [file],
          });
          onClose();
          return;
        } catch {
          // fall through to instant download
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lm-share-card.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash('تم حفظ صورة البطاقة للمشاركة');
    } finally {
      setSharingCard(false);
    }
  }

  async function triggerNativeShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: active.title,
          text: shareText,
          url: fullUrl,
        });
        recordUniqueShare('native');
        onClose();
        return;
      } catch {
        // user dismissed native sheet
      }
    }
    copyLink();
  }

  async function sendToLmChat(conv: ConversationItem) {
    setSentIds(prev => ({ ...prev, [conv.id]: true }));
    recordUniqueShare('lm_chat');
    const excerpt = active.snippet ? `\n${active.snippet.slice(0, 120)}` : '';
    await apiPost(`/api/conversations/${conv.id}/messages`, {
      senderId: currentUser.id,
      content: `${badgeLabel}: ${active.title}${excerpt}\n${fullUrl}`,
      msgType: 'text',
    });
    flash(`تم الإرسال إلى ${conv.title}`);
  }

  const externalTargets = [
    {
      id: 'whatsapp' as const,
      label: 'واتساب',
      bg: '#16A34A',
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${fullUrl}`)}`,
    },
    {
      id: 'telegram' as const,
      label: 'تيليجرام',
      bg: '#0EA5E9',
      href: `https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'x' as const,
      label: 'X',
      bg: '#1D2939',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}`,
    },
    {
      id: 'facebook' as const,
      label: 'فيسبوك',
      bg: '#2563EB',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}&quote=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'sms' as const,
      label: 'رسائل',
      bg: '#10B981',
      href: `sms:?body=${encodeURIComponent(`${shareText}\n${fullUrl}`)}`,
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[76] bg-black/62 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 12px))' }}
        className="w-full sm:max-w-[440px] rounded-t-[24px] sm:rounded-[24px] bg-[#181920] border-t sm:border border-white/[0.1] px-4 pt-2.5 space-y-4"
      >
        {/* Sleek Drag Handle + Compact Single-Line Title (ZERO Bulky Tall Box!) */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-1 rounded-full bg-white/25 sm:hidden" />
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {validPreviewImg ? (
                <img src={validPreviewImg} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0 bg-black" />
              ) : active.kind === 'app' ? (
                <LmBrandMark size={30} />
              ) : (
                <UserAvatar initials={active.avatarInitials || 'LM'} avatarUrl={active.avatarUrl} size={34} />
              )}
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-white truncate">{active.title}</div>
                <div className="text-[11px] text-[#8E8E93] truncate">{active.subtitle || badgeLabel}</div>
              </div>
            </div>
            <CloseOrbButton size="sm" onClick={onClose} />
          </div>
        </div>

        {/* Send Directly to LM Chat Contacts */}
        {contacts.length > 0 && (
          <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pb-0.5">
            {contacts.slice(0, 10).map(c => {
              const sent = Boolean(sentIds[c.id]);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => sendToLmChat(c)}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer group"
                >
                  <div className="relative">
                    <UserAvatar initials={c.title.slice(0, 2)} avatarUrl={c.avatarUrl} size={46} />
                    <span
                      className={`absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#181920] ${
                        sent ? 'bg-[#22C55E] text-black' : 'bg-[#FE2C55] text-white'
                      }`}
                    >
                      {sent ? <Check className="w-3 h-3" strokeWidth={2.6} /> : <Send className="w-2.5 h-2.5" />}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#E4E4E7] truncate w-full text-center">{c.title.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Compact Horizontal Share Actions Row (Uniform Flat Matte Circles — ZERO Glow!) */}
        <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={copyLink}
            className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-[#242630] hover:bg-[#2F3240] text-white flex items-center justify-center transition-colors">
              {copied ? <Check className="w-5 h-5 text-[#25F4EE]" /> : <Link2 className="w-5 h-5" />}
            </div>
            <span className="text-[10.5px] text-[#D4D4D8] truncate w-full text-center">
              {copied ? 'تم النسخ' : 'نسخ الرابط'}
            </span>
          </button>

          <button
            type="button"
            disabled={sharingCard}
            onClick={shareAsImageCard}
            className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-full bg-[#25F4EE] text-black flex items-center justify-center transition-transform active:scale-95">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="text-[10.5px] text-[#D4D4D8] truncate w-full text-center">
              {sharingCard ? 'جارٍ...' : 'صورة'}
            </span>
          </button>

          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={triggerNativeShare}
              className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center transition-transform active:scale-95">
                <Share2 className="w-5 h-5" />
              </div>
              <span className="text-[10.5px] text-[#D4D4D8] truncate w-full text-center">المزيد</span>
            </button>
          )}

          {externalTargets.map(t => (
            <a
              key={t.id}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                recordUniqueShare(t.id);
                setTimeout(onClose, 250);
              }}
              className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
            >
              <div
                style={{ backgroundColor: t.bg }}
                className="w-12 h-12 rounded-full flex items-center justify-center"
              >
                {SharePlatformIcons[t.id]}
              </div>
              <span className="text-[10.5px] text-[#A1A1AA] truncate w-full text-center">{t.label}</span>
            </a>
          ))}

          {active.onReport && (
            <button
              type="button"
              onClick={() => {
                const fn = active.onReport;
                onClose();
                fn?.();
              }}
              className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-[#FF595A]/15 hover:bg-[#FF595A]/25 text-[#FF595A] flex items-center justify-center transition-colors">
                <Flag className="w-5 h-5" />
              </div>
              <span className="text-[10.5px] text-[#FF595A] truncate w-full text-center">إبلاغ</span>
            </button>
          )}
        </div>

        {toast && (
          <div className="flex justify-center">
            <span className="px-3.5 py-1 rounded-full bg-white/[0.08] text-xs text-[#25F4EE] font-semibold">
              {toast}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
