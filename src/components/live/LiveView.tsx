import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Radio,
  Users,
  Crown,
  Gift,
  Shield,
  Send,
  Sparkles,
  Trash2,
  Power,
  Video,
  VideoOff,
  Clock,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { LiveRoomItem, LiveRoomState } from '../../types';
import { RankBadge, UserAvatar, VipBadge } from '../shared/LmBrandMark';

const GIFTS = [
  { name: 'وردة LM', valueEgp: 25, emoji: '🌹' },
  { name: 'تاج ذهبي', valueEgp: 150, emoji: '👑' },
  { name: 'صقر ملكي', valueEgp: 500, emoji: '🦅' },
  { name: 'قلعة الإمبراطور', valueEgp: 1000, emoji: '🏰' },
];

export function LiveView() {
  const { user, lang, toast, wsListeners } = useApp();
  const isAr = lang === 'ar';

  const [rooms, setRooms] = useState<LiveRoomItem[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('live_1');
  const [roomState, setRoomState] = useState<LiveRoomState | null>(null);
  const [commentText, setCommentText] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const [giftBanner, setGiftBanner] = useState<{ sender: string; giftName: string; giftValueEgp: number; creatorShare: number; platformShare: number } | null>(null);

  // Local camera preview ("Go Live")
  const [webcamActive, setWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadRooms = useCallback(async () => {
    const data = await api<{ rooms: LiveRoomItem[] }>('/api/live/rooms');
    setRooms(data.rooms);
  }, []);

  const loadRoomState = useCallback(async (roomId: string) => {
    const data = await api<{ state: LiveRoomState }>(`/api/live/rooms/${roomId}/state`);
    setRoomState(data.state);
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (activeRoomId) loadRoomState(activeRoomId);
  }, [activeRoomId, loadRoomState]);

  // Real-time WebSocket updates for live VIP highlight queue & gifts
  useEffect(() => {
    const handler = (event: string, payload: unknown) => {
      if (event === 'live:state') {
        const st = payload as LiveRoomState;
        if (st.roomId === activeRoomId) setRoomState(st);
      } else if (event === 'live:gift') {
        const g = payload as { roomId: string; sender: string; giftName: string; giftValueEgp: number; creatorShare: number; platformShare: number };
        if (g.roomId === activeRoomId) {
          setGiftBanner(g);
          setTimeout(() => setGiftBanner(null), 4200);
        }
      }
    };
    const listeners = wsListeners.current;
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [activeRoomId, wsListeners]);

  // Smooth 100ms UI countdown tick for active VIP highlight progress bar
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  if (!user) return null;

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0];
  const canHighlight = user.vipTier === 1 || user.vipTier === 2 || user.vipTier === 3;
  const userHighlightSec = user.vipTier === 1 ? 15 : user.vipTier === 2 ? 10 : user.vipTier === 3 ? 5 : 0;

  async function toggleWebcam() {
    if (webcamActive) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setWebcamActive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setWebcamActive(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
      toast(isAr ? 'تم تشغيل البث التجريبي عبر كاميرتك المحلية' : 'Local WebRTC camera preview started', 'success');
    } catch {
      toast(isAr ? 'تعذر الوصول للكاميرا أو الميكروفون — يرجى السماح من المتصفح' : 'Camera/mic permission denied', 'warning');
    }
  }

  async function sendNormal() {
    if (!user || !commentText.trim()) return;
    try {
      await api(`/api/live/rooms/${activeRoomId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, text: commentText }),
      });
      setCommentText('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error');
    }
  }

  async function sendHighlight() {
    if (!user || !commentText.trim()) return;
    try {
      const res = await api<{ queuePosition: number }>(`/api/live/rooms/${activeRoomId}/highlight`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, text: commentText }),
      });
      setCommentText('');
      toast(
        res.queuePosition === 0
          ? (isAr ? `تم إبراز تعليقك الآن لمدة ${userHighlightSec} ثوانٍ!` : `Highlighted now for ${userHighlightSec}s!`)
          : (isAr ? `تمت إضافة تعليقك المميز في الطابور (المركز #${res.queuePosition})` : `Queued at #${res.queuePosition}`),
        'success'
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'warning');
    }
  }

  async function runPrioritySimulation() {
    const res = await api<{ state: LiveRoomState }>(`/api/live/rooms/${activeRoomId}/simulate-burst`, {
      method: 'POST',
    });
    setRoomState(res.state);
    toast(
      isAr
        ? 'تم إرسال 3 تعليقات متزامنة (VIP 3 ثم VIP 2 ثم VIP 1) — شاهد تصدّر VIP 1 تلقائيًا!'
        : 'Burst sent (VIP 3, 2, 1) — Watch VIP 1 take #1 priority automatically!',
      'info'
    );
  }

  async function sendGift(giftName: string, giftValueEgp: number) {
    if (!user) return;
    const res = await api<{ creatorShare: number; platformShare: number }>(`/api/live/rooms/${activeRoomId}/gift`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, giftName, giftValueEgp }),
    });
    toast(
      isAr
        ? `تم إرسال "${giftName}" • حصة صانع المحتوى ${res.creatorShare} ج.م | حصة LM ${res.platformShare} ج.م`
        : `Sent ${giftName} • Creator ${res.creatorShare} EGP | LM ${res.platformShare} EGP`,
      'success'
    );
  }

  async function moderate(action: 'delete_active' | 'toggle_highlights' | 'set_cooldown', cooldownSec?: number) {
    const res = await api<{ state: LiveRoomState }>(`/api/live/rooms/${activeRoomId}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action, cooldownSec }),
    });
    setRoomState(res.state);
    toast(isAr ? 'تم تطبيق إجراء إدارة البث فورًا' : 'Moderation updated', 'info');
  }

  // Calculate remaining highlight progress
  const activeH = roomState?.activeHighlight || null;
  const remainingMs = activeH?.expiresAt ? Math.max(0, activeH.expiresAt - nowMs) : 0;
  const remainingSec = (remainingMs / 1000).toFixed(1);
  const progressPct = activeH ? Math.min(100, Math.max(0, (remainingMs / (activeH.durationSec * 1000)) * 100)) : 0;

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Room Selector & Go-Live Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRoomId(r.id)}
                className={`px-3.5 py-2 rounded-xl border text-xs flex items-center gap-2 shrink-0 cursor-pointer transition-colors ${
                  r.id === activeRoomId
                    ? 'bg-[var(--lm-accent-soft)] border-[var(--lm-accent)]/40 text-[var(--lm-text)] font-semibold'
                    : 'lm-card text-[var(--lm-text-secondary)] hover:bg-[var(--lm-surface-hover)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>{r.title}</span>
              </button>
            ))}
          </div>

          <button
            onClick={toggleWebcam}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 ${
              webcamActive ? 'bg-red-500 text-white' : 'lm-btn-primary'
            }`}
          >
            {webcamActive ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
            {webcamActive
              ? (isAr ? 'إيقاف البث المحلي' : 'Stop Local Cam')
              : (isAr ? 'جرّب البث بكاميرتك الآن' : 'Go Live (Local Cam)')}
          </button>
        </div>

        {/* Main 2-Column Broadcast Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT: BROADCAST STAGE + GIFTS + HOST CONTROLS (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* 16:9 Stage */}
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-[var(--lm-border-strong)] bg-[#0A0D14]">
              {webcamActive ? (
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full relative flex flex-col justify-between p-5 bg-gradient-to-br from-[#0B1220] via-[#101829] to-[#0A0E17]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                      <UserAvatar
                        initials={activeRoom?.hostInitials || 'LM'}
                        color={activeRoom?.hostColor || '#10B981'}
                        size={28}
                        vipTier={activeRoom?.hostVip || 3}
                      />
                      <div className="leading-tight">
                        <div className="text-xs font-semibold text-white">{activeRoom?.hostName}</div>
                        <div className="text-[10px] text-white/60">{activeRoom?.category}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-mono-num font-bold flex items-center gap-1">
                        <Radio className="w-3 h-3" /> LIVE
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-white text-[11px] font-mono-num flex items-center gap-1 border border-white/10">
                        <Users className="w-3 h-3" /> {(roomState?.viewersCount || 3840).toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>

                  {/* Center Live Studio Readout */}
                  <div className="text-center space-y-2 my-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-mono-num">
                      WebRTC / LiveKit Ready • Ultra-Low Latency
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white max-w-md mx-auto">
                      {activeRoom?.title}
                    </h2>
                    <p className="text-xs text-white/60">
                      {isAr
                        ? 'محرك التعليقات المميزة شغال لحظيًا عبر WebSocket — جرّب زر المحاكاة بالأسفل أو أرسل تعليقًا مميزًا'
                        : 'Realtime WebSocket VIP Highlight Engine active — test burst simulation or submit a VIP comment'}
                    </p>
                  </div>

                  {/* Bottom Gift Revenue Transparency Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-black/50 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-white/80">
                    <span className="flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-[#D4AF37]" />
                      {isAr ? 'إجمالي الهدايا:' : 'Total Gifts:'}{' '}
                      <strong className="font-mono-num text-white">
                        {(roomState?.totalGiftsEgp || 0).toLocaleString('en-US')} EGP
                      </strong>
                    </span>
                    <span className="font-mono-num text-[10px] text-white/65">
                      {isAr
                        ? `التوزيع: ${100 - (roomState?.platformCutPct || 25)}% لصانع المحتوى • ${roomState?.platformCutPct || 25}% للمنصة`
                        : `Split: ${100 - (roomState?.platformCutPct || 25)}% Creator • ${roomState?.platformCutPct || 25}% LM`}
                    </span>
                  </div>
                </div>
              )}

              {/* Floating Gift Toast Overlay */}
              {giftBanner && (
                <div className="absolute bottom-14 inset-x-4 flex justify-center pointer-events-none">
                  <div className="px-4 py-2 rounded-2xl bg-[#14120E]/95 border border-[#D4AF37]/60 shadow-2xl flex items-center gap-3 text-xs text-white">
                    <Gift className="w-4 h-4 text-[#D4AF37]" />
                    <span>
                      <strong>{giftBanner.sender}</strong> {isAr ? 'أرسل' : 'sent'}{' '}
                      <strong className="text-[#E8C85E]">{giftBanner.giftName}</strong> ({giftBanner.giftValueEgp} EGP)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Virtual Gifts Strip */}
            <div className="lm-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-[#D4AF37]" />
                  {isAr ? 'دعم صانع المحتوى بالهدايا الافتراضية (تقسيم 75% / 25%)' : 'Virtual Gifts (75% Creator / 25% LM)'}
                </h3>
                <span className="text-[10px] text-[var(--lm-text-muted)]">{isAr ? 'تسجل في الدفتر التجريبي' : 'Sandbox Ledger'}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GIFTS.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => sendGift(g.name, g.valueEgp)}
                    className="p-2.5 rounded-xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] border border-[var(--lm-border)] hover:border-[#D4AF37]/40 transition-all text-center cursor-pointer"
                  >
                    <div className="text-xl">{g.emoji}</div>
                    <div className="text-xs font-semibold mt-1">{g.name}</div>
                    <div className="text-[11px] font-mono-num text-[#D4AF37]">{g.valueEgp} EGP</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Host Controls & Priority Queue Demo Panel */}
            <div className="lm-card rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[var(--lm-accent)]" />
                  {isAr ? 'أدوات صاحب البث واختبار الأولوية' : 'Host Controls & Priority Test'}
                </h3>
                <button
                  onClick={runPrioritySimulation}
                  className="px-3 py-1.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/45 text-[#E8C85E] hover:bg-[#D4AF37]/25 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAr ? 'محاكاة تزاحم VIP (1 / 2 / 3)' : 'Simulate VIP 1/2/3 Burst'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => moderate('delete_active')}
                  disabled={!activeH}
                  className="lm-btn-ghost px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  {isAr ? 'حذف التعليق المميز الحالي' : 'Remove Active Highlight'}
                </button>
                <button
                  onClick={() => moderate('toggle_highlights')}
                  className="lm-btn-ghost px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Power className={`w-3.5 h-3.5 ${roomState?.highlightsEnabled ? 'text-emerald-400' : 'text-red-400'}`} />
                  {roomState?.highlightsEnabled
                    ? (isAr ? 'تعطيل التعليقات المميزة' : 'Disable Highlights')
                    : (isAr ? 'تفعيل التعليقات المميزة' : 'Enable Highlights')}
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)] text-xs">
                  <Clock className="w-3.5 h-3.5 text-[var(--lm-text-muted)]" />
                  <span className="text-[var(--lm-text-secondary)]">{isAr ? 'فترة الانتظار:' : 'Cooldown:'}</span>
                  <select
                    value={roomState?.cooldownSec || 15}
                    onChange={(e) => moderate('set_cooldown', Number(e.target.value))}
                    className="bg-transparent font-mono-num font-semibold outline-none"
                  >
                    <option value={5}>5s</option>
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: DEDICATED VIP HIGHLIGHT STAGE + LIVE CHAT STREAM (5 cols) */}
          <div className="lg:col-span-5 lm-card rounded-2xl flex flex-col h-[590px] overflow-hidden">
            {/* 1. SEPARATE VIP HIGHLIGHTED COMMENT SLOT ABOVE NORMAL CHAT */}
            <div className="p-3.5 border-b border-[var(--lm-border)] bg-[var(--lm-surface-2)] space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {isAr ? 'مساحة التعليقات المميزة (VIP 1 > 2 > 3)' : 'VIP Highlighted Stage (VIP 1 > 2 > 3)'}
                </span>
                <span className="text-[10px] font-mono-num text-[var(--lm-text-muted)] flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {isAr ? `في الطابور: ${roomState?.highlightQueue.length || 0}` : `Queued: ${roomState?.highlightQueue.length || 0}`}
                </span>
              </div>

              {activeH ? (
                <div
                  className={`rounded-xl p-3 border relative overflow-hidden ${
                    activeH.vipTier === 1
                      ? 'bg-[#D4AF37]/12 border-[#D4AF37]/50'
                      : activeH.vipTier === 2
                      ? 'bg-[#2F6BFF]/12 border-[#2F6BFF]/50'
                      : 'bg-[#10B981]/12 border-[#10B981]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar initials={activeH.avatarInitials} color={activeH.avatarColor} size={28} vipTier={activeH.vipTier} />
                      <span className="text-xs font-bold truncate">{activeH.displayName}</span>
                      <VipBadge tier={activeH.vipTier} compact />
                    </div>
                    <span className="text-xs font-mono-num font-bold text-[var(--lm-text)] shrink-0">
                      {remainingSec}s / {activeH.durationSec}s
                    </span>
                  </div>
                  <p className="text-xs mt-2 leading-relaxed text-[var(--lm-text)]">{activeH.text}</p>
                  {/* Smooth Countdown Bar */}
                  <div className="mt-2.5 h-1 rounded-full bg-black/30 overflow-hidden">
                    <div
                      style={{
                        width: `${progressPct}%`,
                        backgroundColor: activeH.vipTier === 1 ? '#D4AF37' : activeH.vipTier === 2 ? '#2F6BFF' : '#10B981',
                      }}
                      className="h-full transition-all duration-100"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-3 border border-dashed border-[var(--lm-border-strong)] text-center text-[11px] text-[var(--lm-text-muted)]">
                  {roomState?.highlightsEnabled
                    ? (isAr ? 'لا يوجد تعليق مميز حاليًا — VIP 1 (15ث) • VIP 2 (10ث) • VIP 3 (5ث)' : 'Slot open — VIP 1 (15s) • VIP 2 (10s) • VIP 3 (5s)')
                    : (isAr ? 'تم إيقاف التعليقات المميزة بواسطة صاحب البث' : 'Highlights paused by host')}
                </div>
              )}

              {/* Priority Queue Chips */}
              {roomState && roomState.highlightQueue.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-[var(--lm-text-muted)] shrink-0">{isAr ? 'التالي:' : 'Next:'}</span>
                  {roomState.highlightQueue.map((q, idx) => (
                    <span
                      key={q.id}
                      className="text-[10px] font-mono-num px-2 py-0.5 rounded-md bg-[var(--lm-surface)] border border-[var(--lm-border)]"
                    >
                      #{idx + 1} VIP {q.vipTier} ({q.durationSec}s) • {q.displayName}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 2. NORMAL LIVE CHAT STREAM */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {(roomState?.recentMessages || []).map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 text-xs p-2 rounded-xl ${
                    m.isGift ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/30' : 'hover:bg-[var(--lm-surface-2)]'
                  }`}
                >
                  <UserAvatar initials={m.avatarInitials} color={m.avatarColor} size={26} vipTier={m.vipTier} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">{m.displayName}</span>
                      <VipBadge tier={m.vipTier} compact />
                      <RankBadge rankId={m.rankId} lang={lang} />
                    </div>
                    <p className="text-[var(--lm-text-secondary)] mt-0.5 leading-relaxed">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 3. INPUT + VIP HIGHLIGHT SUBMIT */}
            <div className="p-3 border-t border-[var(--lm-border)] bg-[var(--lm-surface)] space-y-2 shrink-0">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendNormal()}
                placeholder={isAr ? 'اكتب تعليقًا (جرّب كلمة "تهديد" لاختبار فلتر الفحص المسبق)...' : 'Write a live comment...'}
                className="lm-input w-full rounded-xl px-3 py-2 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={sendNormal}
                  disabled={!commentText.trim()}
                  className="lm-btn-ghost py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isAr ? 'تعليق عادي' : 'Normal Comment'}
                </button>
                <button
                  onClick={sendHighlight}
                  disabled={!commentText.trim() || !canHighlight}
                  title={!canHighlight ? (isAr ? 'متاح لمستويات VIP 1 و2 و3 فقط' : 'Requires VIP 1, 2, or 3') : ''}
                  className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 ${
                    canHighlight
                      ? 'bg-[#D4AF37] text-[#0B0A08] hover:opacity-90'
                      : 'bg-[var(--lm-surface-2)] text-[var(--lm-text-muted)] border border-[var(--lm-border)]'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  {canHighlight
                    ? (isAr ? `تعليق مميز (${userHighlightSec}ث)` : `Highlight (${userHighlightSec}s)`)
                    : (isAr ? 'مميز (VIP 3+ فقط)' : 'VIP 3+ Only')}
                </button>
              </div>
              {!canHighlight && (
                <div className="text-[10px] text-[var(--lm-text-muted)] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>
                    {isAr
                      ? 'حسابك الحالي (VIP 4 / VIP 5 / عادي) يعلّق بشكل عادي. بدّل لحساب VIP 1 أو 2 أو 3 لتجربة الإبراز.'
                      : 'Switch to a VIP 1, 2, or 3 account in the header to test highlighted comments.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
