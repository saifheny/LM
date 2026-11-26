import React, { useEffect, useState } from 'react';
import { Check, Link2, Send, Share2 } from 'lucide-react';
import { ConversationItem, UserProfile } from '../../types';
import { LmBrandMark, UserAvatar } from './LmBrandMark';
import { SharePlatformIcons } from './Icons2026Pro';
import { CloseOrbButton, StudioModalOverlay } from './ModalChrome2026';
import { apiGet, apiPost } from '../../lib/api';

export interface SharePayload {
  kind: 'app' | 'post' | 'profile' | 'video' | 'live';
  title: string;
  subtitle?: string;
  snippet?: string;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  avatarInitials?: string;
  badge?: string;
  path: string;
}

const KIND_BADGES: Record<SharePayload['kind'], string> = {
  app: 'تطبيق LM',
  post: 'منشور',
  profile: 'ملف شخصي',
  video: 'فيديو نبض',
  live: 'بث مباشر',
};

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

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(cur => (cur === msg ? '' : cur)), 2000);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      flash('تم نسخ الرابط');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      flash(fullUrl);
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
      bg: '#18181D',
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
    <StudioModalOverlay zClass="z-[75]" onClose={onClose}>
      <div className="p-5 space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Share2 className="w-4 h-4 text-[#E4E4E7]" />
            <span>مشاركة {badgeLabel}</span>
          </div>
          <CloseOrbButton onClick={onClose} />
        </div>

        {/* Rich Live Link Preview Card (Shows EXACT Post / Profile / Video / Live / App being shared!) */}
        <div className="rounded-2xl overflow-hidden bg-[#0A0A0D] border border-white/[0.1] flex items-stretch">
          {payload.imageUrl ? (
            <img
              src={payload.imageUrl}
              alt=""
              className="w-24 h-24 object-cover shrink-0 bg-black"
            />
          ) : (
            <div className="w-20 shrink-0 bg-[#09090B] flex items-center justify-center border-e border-white/[0.07]">
              {payload.kind === 'app' ? (
                <LmBrandMark size={42} />
              ) : (
                <UserAvatar
                  initials={payload.avatarInitials || 'LM'}
                  avatarUrl={payload.avatarUrl}
                  size={44}
                />
              )}
            </div>
          )}

          <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] text-[#D4D4D8]">
                {badgeLabel}
              </span>
              {payload.subtitle && (
                <span className="text-[10.5px] text-[#7A7A85] font-mono-num truncate">{payload.subtitle}</span>
              )}
            </div>
            <div className="text-xs font-bold text-white line-clamp-1">{payload.title}</div>
            {payload.snippet && (
              <div className="text-[11.5px] text-[#A1A1AA] line-clamp-2 leading-snug">{payload.snippet}</div>
            )}
            <div dir="ltr" className="text-[10px] font-mono-num text-[#7A7A85] truncate pt-0.5">
              {fullUrl}
            </div>
          </div>
        </div>

        {/* Send Directly to LM Chat Contacts */}
        {contacts.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-[#8E8E93]">إرسال مباشر داخل LM</div>
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
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
                        className={`absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#111116] ${
                          sent ? 'bg-[#10B981] text-black' : 'bg-white text-black group-hover:scale-110 transition-transform'
                        }`}
                      >
                        {sent ? <Check className="w-3 h-3" strokeWidth={2.6} /> : <Send className="w-2.5 h-2.5" />}
                      </span>
                    </div>
                    <span className="text-[10.5px] text-[#D4D4D8] truncate w-full text-center">{c.title.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* External Platforms + Copy + Native Share */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={copyLink}
            className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-full bg-white/[0.1] hover:bg-white/[0.18] text-white flex items-center justify-center border border-white/[0.1] transition-colors">
              {copied ? <Check className="w-4 h-4 text-[#34D399]" /> : <Link2 className="w-4 h-4" />}
            </div>
            <span className="text-[10.5px] text-[#D4D4D8] truncate w-full text-center">
              {copied ? 'تم النسخ' : 'نسخ الرابط'}
            </span>
          </button>

          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={triggerNativeShare}
              className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
            >
              <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center transition-transform active:scale-95">
                <Share2 className="w-4 h-4" />
              </div>
              <span className="text-[10.5px] text-[#D4D4D8] truncate w-full text-center">مشاركة</span>
            </button>
          )}

          {externalTargets.map(t => (
            <a
              key={t.id}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTimeout(onClose, 250)}
              className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
            >
              <div
                style={{ backgroundColor: t.bg }}
                className="w-11 h-11 rounded-full flex items-center justify-center border border-white/[0.08]"
              >
                {SharePlatformIcons[t.id]}
              </div>
              <span className="text-[10.5px] text-[#A1A1AA] truncate w-full text-center">{t.label}</span>
            </a>
          ))}
        </div>

        {toast && (
          <div className="text-center text-xs text-[#6EE7B7] font-medium pt-0.5">{toast}</div>
        )}
      </div>
    </StudioModalOverlay>
  );
}
