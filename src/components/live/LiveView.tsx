import React, { useEffect, useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
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
  Heart,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { LiveRoomItem, LiveRoomState } from '../../types';
import { RankBadge, UserAvatar, VipBadge } from '../shared/LmBrandMark';

const GIFTS = [
  { name: 'وردة', valueEgp: 25, emoji: '🌹' },
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
  const [muted, setMuted] = useState(true);
  const [hostToolsOpen, setHostToolsOpen] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<number[]>([]);
  const [giftBanner, setGiftBanner] = useState<{ sender: string; giftName: string; giftValueEgp: number } | null>(null);

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

  useEffect(() => {
    const handler = (event: string, payload: unknown) => {
      if (event === 'live:state') {
        const st = payload as LiveRoomState;
        if (st.roomId === activeRoomId) setRoomState(st);
      } else if (event === 'live:gift') {
        const g = payload as { roomId: string; sender: string; giftName: string; giftValueEgp: number };
        if (g.roomId === activeRoomId) {
          setGiftBanner(g);
          confetti({ particleCount: 45, spread: 60, origin: { y: 0.75 } });
          setTimeout(() => setGiftBanner(null), 4000);
        }
      }
    };
    const listeners = wsListeners.current;
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [activeRoomId, wsListeners]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

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
    } catch {
      toast(isAr ? 'يرجى السماح بصلاحية الكاميرا من المتصفح' : 'Camera permission needed', 'warning');
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
      await api(`/api/live/rooms/${activeRoomId}/highlight`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, text: commentText }),
      });
      setCommentText('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'warning');
    }
  }

  async function runPrioritySimulation() {
    const res = await api<{ state: LiveRoomState }>(`/api/live/rooms/${activeRoomId}/simulate-burst`, { method: 'POST' });
    setRoomState(res.state);
    toast(isAr ? '⚡ تم إطلاق 3 تعليقات VIP متزامنة (شاهد تصدّر VIP 1 لمدة 15ث)' : 'VIP 1/2/3 Burst launched', 'info');
  }

  async function sendGift(giftName: string, giftValueEgp: number) {
    if (!user) return;
    await api(`/api/live/rooms/${activeRoomId}/gift`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, giftName, giftValueEgp }),
    });
  }

  async function moderate(action: 'delete_active' | 'toggle_highlights' | 'set_cooldown', cooldownSec?: number) {
    const res = await api<{ state: LiveRoomState }>(`/api/live/rooms/${activeRoomId}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action, cooldownSec }),
    });
    setRoomState(res.state);
  }

  function spawnHeart() {
    const id = Date.now() + Math.random();
    setFloatingHearts(prev => [...prev.slice(-10), id]);
    setTimeout(() => setFloatingHearts(prev => prev.filter(x => x !== id)), 1800);
  }

  const activeH = roomState?.activeHighlight || null;
  const remainingMs = activeH?.expiresAt ? Math.max(0, activeH.expiresAt - nowMs) : 0;
  const remainingSec = (remainingMs / 1000).toFixed(1);
  const progressPct = activeH ? Math.min(100, Math.max(0, (remainingMs / (activeH.durationSec * 1000)) * 100)) : 0;

  return (
    <div className="h-full w-full bg-black text-white flex flex-col lg:flex-row overflow-hidden">
      {/* ============================================================
          TIKTOK LIVE FULL-BLEED VIDEO STAGE
         ============================================================ */}
      <div className="relative flex-1 min-h-[48vh] lg:h-full bg-black overflow-hidden flex items-center justify-center">
        {webcamActive ? (
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        ) : (
          <video
            key={activeRoom?.videoUrl || 'live'}
            src={activeRoom?.videoUrl || '/uploads/seed/reel1.mp4'}
            autoPlay
            loop
            muted={muted}
            playsInline
            className="w-full h-full object-cover"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/80 pointer-events-none" />

        {/* TOP FLOATING TIKTOK LIVE HOST PILL + ROOM SWITCHER */}
        <div className="absolute top-4 inset-x-4 z-20 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 bg-black/50 backdrop-blur-md ps-1.5 pe-3 py-1 rounded-full border border-white/10">
            <UserAvatar
              initials={activeRoom?.hostInitials || 'LM'}
              color={activeRoom?.hostColor || '#10B981'}
              avatarUrl={activeRoom?.hostAvatarUrl}
              size={36}
              vipTier={activeRoom?.hostVip || 3}
            />
            <div>
              <div className="text-xs font-bold leading-tight">{activeRoom?.hostName}</div>
              <div className="text-[10px] text-white/70 font-mono-num">
                🎁 {(roomState?.totalGiftsEgp || 0).toLocaleString('en-US')} EGP
              </div>
            </div>
            <span className="ms-1 px-2.5 py-1 rounded-full bg-[#FE2C55] text-white text-[10px] font-bold">
              LIVE
            </span>
          </div>

          <div className="flex items-center gap-2">
            {rooms.map((r, idx) => (
              <button
                key={r.id}
                onClick={() => setActiveRoomId(r.id)}
                className={`px-3 py-1.5 rounded-full text-xs backdrop-blur-md border cursor-pointer ${
                  r.id === activeRoomId
                    ? 'bg-white text-black border-white font-bold'
                    : 'bg-black/45 text-white/80 border-white/15'
                }`}
              >
                {isAr ? `بث #${idx + 1}` : `Live #${idx + 1}`}
              </button>
            ))}

            <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-xs font-mono-num flex items-center gap-1.5 border border-white/10">
              <Users className="w-3.5 h-3.5" />
              {(roomState?.viewersCount || 3840).toLocaleString('en-US')}
            </span>

            <button
              onClick={() => setMuted(m => !m)}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10 cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleWebcam}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                webcamActive ? 'bg-[#FE2C55] text-white' : 'bg-[#8774E1] text-white'
              }`}
            >
              {webcamActive ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{webcamActive ? (isAr ? 'إنهاء الكاميرا' : 'Stop Cam') : (isAr ? 'بث بكاميرتك' : 'Go Live')}</span>
            </button>
          </div>
        </div>

        {/* Floating Gift Celebration Banner */}
        {giftBanner && (
          <div className="absolute top-20 start-4 z-30 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-amber-600 text-black font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
            <Gift className="w-4 h-4" />
            <span>{giftBanner.sender} • {giftBanner.giftName} ({giftBanner.giftValueEgp} ج.م)</span>
          </div>
        )}

        {/* Rising Floating Hearts */}
        <div className="absolute bottom-24 end-6 pointer-events-none z-20">
          {floatingHearts.map((id, idx) => (
            <div key={id} style={{ right: (idx % 3) * 14 }} className="absolute bottom-0 animate-float-heart">
              <Heart className="w-8 h-8 text-[#FE2C55] fill-[#FE2C55]" />
            </div>
          ))}
        </div>

        {/* Bottom Glassmorphic Gifts & Quick Burst Bar over Stage */}
        <div className="absolute bottom-4 inset-x-4 z-20 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-black/55 backdrop-blur-md p-1.5 rounded-full border border-white/12 overflow-x-auto">
            {GIFTS.map((g) => (
              <button
                key={g.name}
                onClick={() => sendGift(g.name, g.valueEgp)}
                className="px-3 py-1.5 rounded-full hover:bg-white/15 flex items-center gap-1.5 text-xs transition-transform active:scale-95 cursor-pointer shrink-0"
              >
                <span className="text-base">{g.emoji}</span>
                <span className="font-semibold hidden sm:inline">{g.name}</span>
                <span className="font-mono-num text-[#F3D26B] text-[11px]">{g.valueEgp}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runPrioritySimulation}
              className="px-3.5 py-2 rounded-full bg-[#D4AF37] text-black text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAr ? 'محاكاة تزاحم VIP' : 'VIP Burst'}</span>
            </button>

            <button
              onClick={() => setHostToolsOpen(v => !v)}
              title={isAr ? 'أدوات المذيع' : 'Host Moderation'}
              className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center cursor-pointer"
            >
              <Shield className="w-4 h-4 text-[#8774E1]" />
            </button>

            <button
              onClick={spawnHeart}
              className="w-11 h-11 rounded-full bg-[#FE2C55] text-white flex items-center justify-center shadow-lg active:scale-125 transition-transform cursor-pointer"
            >
              <Heart className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>

        {/* Host Moderation Popover */}
        {hostToolsOpen && (
          <div className="absolute bottom-18 end-4 z-30 w-72 rounded-3xl bg-[#18181B]/95 backdrop-blur-xl border border-white/15 p-4 space-y-2.5 shadow-2xl">
            <div className="text-xs font-bold flex items-center justify-between">
              <span>{isAr ? 'تحكم صاحب البث' : 'Host Controls'}</span>
              <span className="text-[10px] text-white/50">75% Creator / 25% LM</span>
            </div>
            <button
              onClick={() => moderate('delete_active')}
              disabled={!activeH}
              className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-red-500/20 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              {isAr ? 'حذف التعليق المميز الحالي' : 'Clear Active Highlight'}
            </button>
            <button
              onClick={() => moderate('toggle_highlights')}
              className="w-full py-2 px-3 rounded-xl bg-white/10 text-xs flex items-center gap-2 cursor-pointer"
            >
              <Power className="w-3.5 h-3.5 text-emerald-400" />
              {roomState?.highlightsEnabled
                ? (isAr ? 'إيقاف التعليقات المميزة مؤقتًا' : 'Pause VIP Highlights')
                : (isAr ? 'تفعيل التعليقات المميزة' : 'Resume VIP Highlights')}
            </button>
          </div>
        )}
      </div>

      {/* ============================================================
          RIGHT LIVE CHAT + PINNED VIP SUPERCHAT STAGE (TikTok Live / Twitch)
         ============================================================ */}
      <aside className="w-full lg:w-[390px] h-[52vh] lg:h-full bg-[#121216] border-t lg:border-t-0 lg:border-s border-white/10 flex flex-col shrink-0">
        {/* DEDICATED PINNED VIP HIGHLIGHTED COMMENT SLOT */}
        <div className="p-3.5 border-b border-white/10 bg-[#18181E] space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold flex items-center gap-1.5 text-[#F3D26B]">
              <Crown className="w-3.5 h-3.5" />
              {isAr ? 'التعليقات المميزة (VIP 1 > 2 > 3)' : 'VIP Pinned Stage'}
            </span>
            <span className="font-mono-num text-white/50">
              {isAr ? `الطابور: ${roomState?.highlightQueue.length || 0}` : `Queue: ${roomState?.highlightQueue.length || 0}`}
            </span>
          </div>

          {activeH ? (
            <div
              className={`rounded-2xl p-3 border relative overflow-hidden shadow-lg ${
                activeH.vipTier === 1
                  ? 'bg-gradient-to-r from-[#D4AF37]/25 to-amber-900/20 border-[#D4AF37]/60'
                  : activeH.vipTier === 2
                  ? 'bg-gradient-to-r from-[#3390EC]/25 to-blue-900/20 border-[#3390EC]/60'
                  : 'bg-gradient-to-r from-[#10B981]/25 to-emerald-900/20 border-[#10B981]/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserAvatar initials={activeH.avatarInitials} color={activeH.avatarColor} size={28} vipTier={activeH.vipTier} />
                  <span className="text-xs font-bold truncate">{activeH.displayName}</span>
                  <VipBadge tier={activeH.vipTier} compact />
                </div>
                <span className="text-xs font-mono-num font-bold shrink-0">
                  {remainingSec}s
                </span>
              </div>
              <p className="text-xs mt-1.5 leading-relaxed text-white">{activeH.text}</p>
              <div className="mt-2 h-1 rounded-full bg-black/40 overflow-hidden">
                <div
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: activeH.vipTier === 1 ? '#D4AF37' : activeH.vipTier === 2 ? '#3390EC' : '#10B981',
                  }}
                  className="h-full transition-all duration-100"
                />
              </div>
            </div>
          ) : (
            <div className="py-2.5 px-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/45 text-center">
              {isAr ? 'المساحة متاحة • VIP 1 (15ث) • VIP 2 (10ث) • VIP 3 (5ث)' : 'VIP 1 (15s) • VIP 2 (10s) • VIP 3 (5s)'}
            </div>
          )}

          {roomState && roomState.highlightQueue.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {roomState.highlightQueue.map((q, idx) => (
                <span key={q.id} className="text-[10px] font-mono-num px-2 py-0.5 rounded-full bg-white/10 text-white/85">
                  #{idx + 1} VIP {q.vipTier} ({q.durationSec}s)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* LIVE COMMENTS STREAM */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {(roomState?.recentMessages || []).map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 text-xs px-2.5 py-1.5 rounded-2xl ${
                m.isGift ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/30' : 'hover:bg-white/[0.04]'
              }`}
            >
              <UserAvatar initials={m.avatarInitials} color={m.avatarColor} size={26} vipTier={m.vipTier} />
              <div className="min-w-0 flex-1">
                <span className="font-bold text-white/80 me-1.5">{m.displayName}</span>
                <VipBadge tier={m.vipTier} compact />
                <RankBadge rankId={m.rankId} lang={lang} />
                <p className="text-white/95 mt-0.5 leading-relaxed">{m.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* LIVE CHAT COMPOSER */}
        <div className="p-3 border-t border-white/10 bg-[#18181E] space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendNormal()}
              placeholder={isAr ? 'أضف تعليقًا في البث...' : 'Say something...'}
              className="flex-1 rounded-full bg-white/10 px-4 py-2 text-xs text-white placeholder:text-white/40 outline-none"
            />
            <button
              onClick={sendNormal}
              disabled={!commentText.trim()}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              onClick={sendHighlight}
              disabled={!commentText.trim() || !canHighlight}
              title={!canHighlight ? (isAr ? 'حصري لـ VIP 1 و2 و3' : 'VIP 1-3 Only') : ''}
              className={`px-3.5 h-9 rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-35 ${
                canHighlight ? 'bg-[#D4AF37] text-black' : 'bg-white/10 text-white/45'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>{canHighlight ? `${userHighlightSec}s` : 'VIP'}</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
