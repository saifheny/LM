import React, { useEffect, useRef, useState } from 'react';
import { Check, Flag, ShieldAlert } from 'lucide-react';
import { apiPost } from '../../lib/api';
import { CloseOrbButton, StudioModalOverlay } from './ModalChrome2026';

export type ReportTargetType = 'post' | 'post_comment' | 'video' | 'video_comment' | 'live';

/**
 * Sculpted Magic Eye Emblem for Telegram-Style Sensitive Content Blur
 */
function MagicEyeGlyph({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" className={className}>
      <path
        d="M3.5 18C6.7 11.4 12 8 18 8C24 8 29.3 11.4 32.5 18C29.3 24.6 24 28 18 28C12 28 6.7 24.6 3.5 18Z"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="rgba(255,255,255,0.08)"
      />
      <circle cx="18" cy="18" r="5.2" stroke="#FDE68A" strokeWidth="1.9" fill="rgba(253,230,138,0.16)" />
      <circle cx="18" cy="18" r="2.1" fill="#FFFFFF" />
      <path d="M18 3.5V5.8M18 30.2V32.5M6.2 7.5L8 9.2M29.8 7.5L28 9.2" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Authentic Telegram Animated Sparkling Micro-Particle Canvas Overlay
 * Renders gentle drifting luminous dust particles over heavy frosted backdrop blur!
 */
function TelegramSparkleCanvas({ dense = false }: { dense?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(120, Math.floor(rect.width * dpr));
      canvas.height = Math.max(40, Math.floor(rect.height * dpr));
    };
    resize();

    const count = dense ? 160 : 85;
    const particles = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0018,
      vy: (Math.random() - 0.5) * 0.0018,
      r: 0.7 + Math.random() * 1.45,
      phase: Math.random() * Math.PI * 2,
      speed: 0.025 + Math.random() * 0.04,
    }));

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x = (p.x + p.vx + 1) % 1;
        p.y = (p.y + p.vy + 1) % 1;
        p.phase += p.speed;
        const alpha = 0.22 + 0.68 * (0.5 + 0.5 * Math.sin(p.phase));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = window.requestAnimationFrame(render);
    };
    raf = window.requestAnimationFrame(render);
    window.addEventListener('resize', resize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [dense]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 w-full h-full" />;
}

/**
 * Telegram-Style Sensitive Media Shield (Covers photos, Pulse videos, and Live video while keeping UI interactive!)
 */
export function SensitiveMediaShield({
  revealed,
  onReveal,
  compact = false,
}: {
  revealed: boolean;
  onReveal: () => void;
  compact?: boolean;
}) {
  if (revealed) return null;

  return (
    <div
      onClick={e => {
        e.stopPropagation();
        onReveal();
      }}
      onPointerDown={e => e.stopPropagation()}
      className="absolute inset-0 z-10 bg-[#0A0A0E]/68 backdrop-blur-[34px] flex flex-col items-center justify-center p-5 text-center cursor-pointer select-none overflow-hidden transition-opacity"
    >
      <TelegramSparkleCanvas dense={!compact} />

      <div className="relative z-10 flex flex-col items-center gap-2.5 max-w-[260px]">
        <div
          className={`${
            compact ? 'w-12 h-12' : 'w-16 h-16'
          } rounded-full bg-black/55 backdrop-blur-xl border border-white/25 flex items-center justify-center shadow-[0_12px_36px_rgba(0,0,0,0.65)]`}
        >
          <MagicEyeGlyph className={compact ? 'w-7 h-7' : 'w-9 h-9'} />
        </div>
        <div className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-white drop-shadow`}>
          هذا المحتوى حساس
        </div>
        <div className="px-3.5 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/20 text-[11px] font-medium text-white/90 hover:bg-white hover:text-black transition-colors">
          اضغط لفتح المحتوى الحساس
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Inline Telegram Spoiler Shield for Sensitive Comments (3+ reports)
 */
export function SensitiveCommentShield({
  revealed,
  onReveal,
  children,
}: {
  revealed: boolean;
  onReveal: () => void;
  children: React.ReactNode;
}) {
  if (revealed) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onReveal();
      }}
      className="relative mt-1 w-full max-w-[320px] rounded-2xl overflow-hidden bg-[#14141B]/90 border border-white/[0.14] px-3 py-2 flex items-center gap-2.5 text-start cursor-pointer group"
    >
      <TelegramSparkleCanvas />
      <div className="relative z-10 w-7 h-7 rounded-full bg-black/60 border border-white/20 flex items-center justify-center shrink-0">
        <MagicEyeGlyph className="w-4 h-4" />
      </div>
      <div className="relative z-10 min-w-0">
        <div className="text-[11.5px] font-semibold text-white">تعليق حساس</div>
        <div className="text-[10px] text-white/75 group-hover:text-white transition-colors">
          اضغط لفتح المحتوى الحساس
        </div>
      </div>
    </button>
  );
}

const REPORT_REASONS = [
  { id: 'sexual', label: 'محتوى جنسي أو إيحائي', labelEn: 'Sexual or suggestive content' },
  { id: 'inappropriate', label: 'محتوى غير سوي أو غير لائق', labelEn: 'Inappropriate or harmful content' },
  { id: 'violent', label: 'عنف أو مشاهد حساسة / صادمة', labelEn: 'Violence or sensitive imagery' },
  { id: 'harassment', label: 'إساءة أو ألفاظ غير لائقة', labelEn: 'Abuse or harassment' },
];

export interface ReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
}

/**
 * Universal Discreet Content Reporting Sheet (Mobile bottom sheet + Desktop modal)
 * NEVER exposes internal thresholds, counts, or glowing neon buttons!
 */
export function ReportContentModal({
  request,
  reporterId,
  lang = 'ar',
  onClose,
  onReported,
}: {
  request: ReportRequest | null;
  reporterId: string;
  lang?: 'ar' | 'en';
  onClose: () => void;
  onReported?: (res: { targetType: ReportTargetType; targetId: string; reportsCount: number; isSensitive: boolean }) => void;
}) {
  const [selectedReason, setSelectedReason] = useState('sexual');
  const [submitting, setSubmitting] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setSelectedReason('sexual');
      setDoneMsg(null);
      setSubmitting(false);
    }
  }, [request]);

  if (!request) return null;
  const active = request;

  async function submitReport() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await apiPost<{ ok: boolean; reportsCount: number; isSensitive: boolean; threshold: number }>(
        '/api/reports',
        {
          targetType: active.targetType,
          targetId: active.targetId,
          reporterId,
          reason: selectedReason,
        }
      );
      onReported?.({
        targetType: active.targetType,
        targetId: active.targetId,
        reportsCount: res.reportsCount,
        isSensitive: res.isSensitive,
      });
      // Discreet confirmation: NEVER reveal internal report count or auto-shield threshold!
      setDoneMsg(
        lang === 'en'
          ? 'Thank you. Your report has been received.'
          : 'شكرًا لك، تم استلام إبلاغك وسيتم التعامل معه.'
      );
      setTimeout(onClose, 1300);
    } catch (err) {
      setDoneMsg(err instanceof Error ? err.message : lang === 'en' ? 'Could not submit report.' : 'تعذر إرسال الإبلاغ.');
      setTimeout(onClose, 1500);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StudioModalOverlay zClass="z-[85]" onClose={onClose}>
      <div className="p-5 space-y-4">
        {/* Mobile Sheet Drag Handle */}
        <div className="sm:hidden flex justify-center -mt-2 pb-0.5">
          <span className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5 text-sm font-bold text-white">
            <span className="w-8 h-8 rounded-full bg-white/[0.07] border border-white/[0.12] text-[#E4E4E7] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <span>
              {lang === 'en'
                ? `Report ${active.label || 'content'}`
                : `إبلاغ عن ${active.label || 'هذا المحتوى'}`}
            </span>
          </div>
          <CloseOrbButton onClick={onClose} />
        </div>

        {doneMsg ? (
          <div className="py-7 flex flex-col items-center gap-3 text-center">
            <div className="w-11 h-11 rounded-full bg-white/[0.09] border border-white/[0.18] text-white flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <p className="text-xs text-[#E4E4E7] leading-relaxed max-w-[260px]">{doneMsg}</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              {REPORT_REASONS.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedReason(r.id)}
                  className={`w-full px-4 py-3 rounded-2xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    selectedReason === r.id
                      ? 'bg-white/[0.1] border-white/[0.28] text-white font-semibold'
                      : 'bg-[#0B0B0F] border-white/[0.07] text-[#C4C4CC] hover:border-white/[0.18]'
                  }`}
                >
                  <span>{lang === 'en' ? r.labelEn : r.label}</span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      selectedReason === r.id ? 'border-white bg-white' : 'border-white/25'
                    }`}
                  >
                    {selectedReason === r.id && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-xs text-[#C4C4CC] hover:text-white cursor-pointer transition-colors"
              >
                {lang === 'en' ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitReport}
                className="h-9 px-5 rounded-full bg-white hover:bg-[#E4E4E7] text-black text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>
                  {submitting
                    ? lang === 'en'
                      ? 'Sending...'
                      : 'جارٍ الإرسال...'
                    : lang === 'en'
                      ? 'Submit Report'
                      : 'إرسال الإبلاغ'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </StudioModalOverlay>
  );
}
