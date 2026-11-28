import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, QrCode, X } from 'lucide-react';
import { Lang, UserProfile } from '../../types';
import { LmBrandMark, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';

export function ProfileQrModal({
  open,
  user,
  lang = 'ar',
  onClose,
}: {
  open: boolean;
  user: UserProfile;
  lang?: Lang;
  onClose: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const profileUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/u/${user.username}` : `https://lm.app/u/${user.username}`;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    QRCode.toDataURL(profileUrl, {
      width: 512,
      margin: 2,
      color: {
        dark: '#0E0F12',
        light: '#FAFAFA',
      },
      errorCorrectionLevel: 'M',
    })
      .then(url => {
        if (alive) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, profileUrl]);

  if (!open) return null;

  function copyLink() {
    navigator.clipboard?.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function downloadCard() {
    if (!qrDataUrl) return;
    try {
      const W = 720;
      const H = 920;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#0E0F12';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(28, 28, W - 56, H - 56, 36);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LM', W / 2, 92);

      const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = qrDataUrl;
      });
      ctx.fillStyle = '#FAFAFA';
      ctx.beginPath();
      ctx.roundRect(140, 140, 440, 440, 28);
      ctx.fill();
      ctx.drawImage(qrImg, 164, 164, 392, 392);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 34px "IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(user.displayName.slice(0, 26), W / 2, 668);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '600 24px "Plus Jakarta Sans", monospace';
      ctx.fillText(`@${user.username}`, W / 2, 714);

      ctx.fillStyle = '#71717A';
      ctx.font = '500 18px "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(lang === 'en' ? 'Scan to open profile on LM' : 'امسح الكود لفتح الملف الشخصي على منصة LM', W / 2, 825);

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `lm-qr-${user.username}.png`;
      a.click();
    } catch {
      // ignore
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[85] bg-black/72 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[350px] rounded-[28px] bg-[#14151A] border border-white/[0.12] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <QrCode className="w-4 h-4 text-[#25F4EE]" />
            <span>{lang === 'en' ? 'Profile QR Code' : 'بطاقة QR للحساب'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full hover:bg-white/[0.08] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-[24px] bg-[#0D0E12] border border-white/[0.08] p-5 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <LmBrandMark size={22} />
            <span className="text-xs font-bold tracking-widest text-[#A1A1AA]">LM IDENTITY</span>
          </div>

          <div className="w-52 h-52 rounded-2xl bg-[#FAFAFA] p-2.5 flex items-center justify-center shadow-lg">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain rounded-lg" />
            ) : (
              <span className="w-7 h-7 rounded-full border-2 border-black/20 border-t-black animate-spin" />
            )}
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={28} />
              <span className="text-sm font-bold text-white">{user.displayName}</span>
              {user.verified && <VerifiedIcon />}
            </div>
            <span className="text-xs font-mono-num text-[#8E8E93]">@{user.username}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={copyLink}
            className="h-10 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-[#25F4EE]" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? (lang === 'en' ? 'Copied' : 'تم النسخ') : lang === 'en' ? 'Copy Link' : 'نسخ الرابط'}</span>
          </button>
          <button
            type="button"
            onClick={downloadCard}
            className="h-10 rounded-xl bg-white text-black hover:opacity-90 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-opacity"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'en' ? 'Save Card' : 'حفظ الصورة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
