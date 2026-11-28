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

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1).trimEnd()}…`;
  }
  return lines;
}

/**
 * Generates a Museum-Grade 1200x675 Architectural Editorial Magazine Share Card PNG:
 * - Matte architectural obsidian stock with fine micro-grain & hairline geometry (ZERO AI-slop purple/blue glows!)
 * - Proper RTL Arabic typography, crisp wrapped editorial headline & pull-quote, studio-framed media card!
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
    const W = 1200;
    const H = 675;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const hasArabic = /[\u0600-\u06FF]/.test(`${opts.title} ${opts.snippet || ''} ${opts.badge}`);

    // 1. Matte Editorial Architectural Obsidian Paper Stock (ZERO neon AI-slop blobs!)
    const baseGrad = ctx.createLinearGradient(0, 0, W, H);
    baseGrad.addColorStop(0, '#101114');
    baseGrad.addColorStop(0.55, '#0C0D10');
    baseGrad.addColorStop(1, '#141519');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle warm spotlight from top-right architectural studio keylight (ultra-refined neutral ivory, 6% opacity)
    const keyLight = ctx.createRadialGradient(W * 0.85, H * 0.14, 10, W * 0.85, H * 0.14, 520);
    keyLight.addColorStop(0, 'rgba(255, 250, 240, 0.065)');
    keyLight.addColorStop(1, 'rgba(255, 250, 240, 0)');
    ctx.fillStyle = keyLight;
    ctx.fillRect(0, 0, W, H);

    // 2. Ultra-fine Architectural Blueprint Grid Lines (barely-there Swiss typography discipline)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.032)';
    ctx.lineWidth = 1;
    for (let x = 64; x < W; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 64; y < H; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Fine deterministic matte film grain dots
    let seed = 4219;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let i = 0; i < 420; i++) {
      seed = (seed * 16807) % 2147483647;
      const gx = seed % W;
      seed = (seed * 16807) % 2147483647;
      const gy = seed % H;
      ctx.fillRect(gx, gy, 1.4, 1.4);
    }

    // 3. Outer Architectural Hairline Frame + Corner Registration Marks
    const pad = 38;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(pad, pad, W - pad * 2, H - pad * 2, 26);
    ctx.stroke();

    // Inner subtle accent rule on top bar
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.beginPath();
    ctx.moveTo(pad + 34, 122);
    ctx.lineTo(W - pad - 34, 122);
    ctx.stroke();

    // 4. Top Editorial Header: Crisp Solid Monograph LM Badge (left) + Minimalist Category Stamp (right)
    ctx.fillStyle = '#F5F5F4';
    ctx.beginPath();
    ctx.roundRect(pad + 34, 64, 48, 38, 10);
    ctx.fill();
    ctx.fillStyle = '#0C0D10';
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LM', pad + 58, 84);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#8F939E';
    ctx.font = '600 14px "Plus Jakarta Sans", monospace';
    ctx.fillText('LM PLATFORM  ·  CURATED EDITION', pad + 98, 84);

    // Category Badge Pill (Matte Warm Ivory Rim — ZERO Neon!)
    ctx.font = '600 19px "IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif';
    const badgeW = Math.max(126, ctx.measureText(opts.badge).width + 44);
    ctx.fillStyle = '#1B1D23';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(W - pad - 34 - badgeW, 65, badgeW, 36, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F5F5F4';
    ctx.textAlign = 'center';
    ctx.fillText(opts.badge, W - pad - 34 - badgeW / 2, 84);

    // 5. Left Studio-Framed Visual Portrait / Media Card (360x360 Matte Frame)
    const imgX = pad + 36;
    const imgY = 158;
    const imgSize = 368;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imgX, imgY, imgSize, imgSize, 24);
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
        // Aspect-ratio-preserving center cover crop (NEVER stretches portraits!)
        const scale = Math.max(imgSize / img.naturalWidth, imgSize / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, imgX + (imgSize - dw) / 2, imgY + (imgSize - dh) / 2, dw, dh);
        drewImg = true;
      } catch {
        drewImg = false;
      }
    }

    if (!drewImg) {
      // Architectural Monogram Studio Tile (Matte Obsidian + Fine Concentric Orbit Hairlines)
      const tileGrad = ctx.createLinearGradient(imgX, imgY, imgX + imgSize, imgY + imgSize);
      tileGrad.addColorStop(0, '#1A1C22');
      tileGrad.addColorStop(1, '#121318');
      ctx.fillStyle = tileGrad;
      ctx.fillRect(imgX, imgY, imgSize, imgSize);

      const cx = imgX + imgSize / 2;
      const cy = imgY + imgSize / 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.2;
      [68, 108, 148].forEach(rad => {
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
      });
      // Delicate diagonal editorial crosshair
      ctx.beginPath();
      ctx.moveTo(imgX + 24, imgY + imgSize - 24);
      ctx.lineTo(imgX + imgSize - 24, imgY + 24);
      ctx.stroke();

      ctx.fillStyle = '#F5F5F4';
      ctx.font = '800 96px "Plus Jakarta Sans", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((opts.initials || 'LM').slice(0, 2).toUpperCase(), cx, cy + 4);
    }
    ctx.restore();

    // Subtle crisp inner hairline border on image card
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(imgX, imgY, imgSize, imgSize, 24);
    ctx.stroke();

    // 6. Right Editorial Copy Block (True RTL when Arabic!)
    const textAreaLeft = imgX + imgSize + 48;
    const textAreaRight = W - pad - 42;
    const textMaxW = textAreaRight - textAreaLeft;
    const anchorX = hasArabic ? textAreaRight : textAreaLeft;

    ctx.save();
    ctx.direction = hasArabic ? 'rtl' : 'ltr';
    ctx.textAlign = hasArabic ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';

    // Thin crimson-ivory editorial accent marker bar
    ctx.fillStyle = '#E11D48';
    ctx.fillRect(hasArabic ? textAreaRight - 46 : textAreaLeft, 174, 46, 4);

    // Bold Editorial Display Headline (Up to 2 crisp wrapped lines)
    ctx.fillStyle = '#FAFAFA';
    ctx.font = '700 44px "IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif';
    const titleLines = wrapCanvasText(ctx, opts.title, textMaxW, 2);
    let cursorY = 236;
    for (const line of titleLines) {
      ctx.fillText(line, anchorX, cursorY);
      cursorY += 56;
    }

    // Handle / Subtitle
    if (opts.subtitle) {
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '500 23px "Plus Jakarta Sans", "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(opts.subtitle.slice(0, 44), anchorX, cursorY + 4);
      cursorY += 46;
    } else {
      cursorY += 16;
    }

    // Editorial Snippet / Pull Quote (Up to 3 wrapped lines with vertical quote rule)
    if (opts.snippet) {
      ctx.font = '400 24px "IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif';
      const snippetLines = wrapCanvasText(ctx, opts.snippet, textMaxW - 22, 3);
      if (snippetLines.length > 0) {
        const quoteTop = cursorY + 4;
        const quoteHeight = snippetLines.length * 38;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.fillRect(hasArabic ? textAreaRight - 3 : textAreaLeft, quoteTop - 22, 3, quoteHeight);

        ctx.fillStyle = '#D4D4D8';
        const qAnchorX = hasArabic ? textAreaRight - 18 : textAreaLeft + 18;
        let qY = quoteTop + 4;
        for (const sl of snippetLines) {
          ctx.fillText(sl, qAnchorX, qY);
          qY += 38;
        }
      }
    }
    ctx.restore();

    // 7. Bottom Architectural Footer Strip
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad + 34, H - 108);
    ctx.lineTo(W - pad - 34, H - 108);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#A1A1AA';
    ctx.font = '500 18px "Plus Jakarta Sans", monospace';
    const cleanHost = opts.fullUrl.replace(/^https?:\/\//i, '').slice(0, 58);
    ctx.fillText(cleanHost, pad + 36, H - 72);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#F5F5F4';
    ctx.font = '600 18px "IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(hasArabic ? 'افتح الرابط على منصة LM' : 'Open on LM', W - pad - 36, H - 72);

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
        imageUrl:
          validPreviewImg ||
          (active.kind === 'post' ? null : isUsableImageUrl(active.avatarUrl) ? active.avatarUrl : null),
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
      msgType: active.kind === 'video' ? 'video_note' : 'text',
      mediaUrl: validPreviewImg || undefined,
    });
    flash(`تم الإرسال إلى ${conv.title}`);
  }

  const externalTargets = [
    {
      id: 'whatsapp' as const,
      label: 'واتساب',
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${fullUrl}`)}`,
    },
    {
      id: 'telegram' as const,
      label: 'تيليجرام',
      href: `https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'instagram' as const,
      label: 'إنستغرام',
      href: '',
    },
    {
      id: 'x' as const,
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}`,
    },
    {
      id: 'facebook' as const,
      label: 'فيسبوك',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}&quote=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'sms' as const,
      label: 'رسائل',
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

          {externalTargets.map(t =>
            t.href ? (
              <a
                key={t.id}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  recordUniqueShare(t.id);
                  setTimeout(onClose, 250);
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden shadow-md group-hover:scale-105 transition-transform">
                  {SharePlatformIcons[t.id]}
                </div>
                <span className="text-[10.5px] text-[#C4C4CC] truncate w-full text-center">{t.label}</span>
              </a>
            ) : (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  recordUniqueShare(t.id);
                  navigator.clipboard?.writeText(fullUrl);
                  flash('تم نسخ الرابط للمشاركة على إنستغرام');
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden shadow-md group-hover:scale-105 transition-transform">
                  {SharePlatformIcons[t.id]}
                </div>
                <span className="text-[10.5px] text-[#C4C4CC] truncate w-full text-center">{t.label}</span>
              </button>
            )
          )}

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
