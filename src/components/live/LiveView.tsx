import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Eye,
  Heart,
  Volume2,
  VolumeX,
  Gift,
  Pin,
  Camera,
  CameraOff,
  Share2,
} from 'lucide-react';
import { Lang, LiveRoomItem, LiveRoomState, UserProfile } from '../../types';
import { UserAvatar } from '../shared/LmBrandMark';
import { ObsidianComposerPill } from '../shared/HardwareUI';
import { MobileInlineNavTrigger } from '../layout/AppShell';
import { useLayout } from '../../context/LayoutContext';
import { TapBurstItem, TapBurstOverlay, createTapBurst } from '../shared/TapComboBurst';
import { TikTokGiftItem, TikTokGiftSheet } from './TikTokGiftSheet';
import { apiGet, apiPost } from '../../lib/api';

interface LiveViewProps {
  user: UserProfile;
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
}

export function LiveView({ user, lang, lastWsEvent }: LiveViewProps) {
  const { setComposerFocused, mobileNavExpanded, setMobileNavExpanded } = useLayout();
  const [rooms, setRooms] = useState<LiveRoomItem[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('live_1');
  const [roomState, setRoomState] = useState<LiveRoomState | null>(null);
  const [commentText, setCommentText] = useState('');
  const [pinMode, setPinMode] = useState(false);
  const [muted, setMuted] = useState(true);
  const [giftTrayOpen, setGiftTrayOpen] = useState(false);
  const [giftBanner, setGiftBanner] = useState<{ sender: string; giftName: string; payment?: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // TikTok Rapid Multi-Tap Burst Designs & Combo Counter
  const [bursts, setBursts] = useState<TapBurstItem[]>([]);
  const comboRef = useRef({ count: 0, lastMs: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Creator live camera mode
  const [cameraLive, setCameraLive] = useState(false);
  const camVideoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  const loadRooms = useCallback(async () => {
    const res = await apiGet<{ ok: boolean; rooms: LiveRoomItem[] }>('/api/live/rooms');
    setRooms(res.rooms);
    if (res.rooms.length > 0 && !res.rooms.some(r => r.id === activeRoomId)) {
      setActiveRoomId(res.rooms[0].id);
    }
  }, [activeRoomId]);

  const loadState = useCallback(async (id: string) => {
    const res = await apiGet<{ ok: boolean; state: LiveRoomState }>(`/api/live/rooms/${id}/state`);
    setRoomState(res.state);
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (activeRoomId) loadState(activeRoomId);
  }, [activeRoomId, loadState]);

  useEffect(() => {
    if (!lastWsEvent) return;
    if (lastWsEvent.event === 'live:state') {
      const st = lastWsEvent.payload as LiveRoomState;
      if (st.roomId === activeRoomId) setRoomState(st);
    }
    if (lastWsEvent.event === 'live:gift') {
      const g = lastWsEvent.payload as { roomId: string; sender: string; giftName: string };
      if (g.roomId === activeRoomId) {
        setGiftBanner({ sender: g.sender, giftName: g.giftName });
        setTimeout(() => setGiftBanner(null), 3200);
      }
    }
  }, [lastWsEvent, activeRoomId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomState?.recentMessages.length]);

  useEffect(() => {
    return () => {
      camStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function toggleCameraBroadcast() {
    if (cameraLive) {
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
      setCameraLive(false);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      camStreamRef.current = s;
      setCameraLive(true);
      setTimeout(() => {
        if (camVideoRef.current) camVideoRef.current.srcObject = s;
      }, 60);
    } catch {
      setStatusMsg('الكاميرا غير متاحة على هذا الجهاز');
      setTimeout(() => setStatusMsg(''), 2500);
    }
  }

  function triggerStageTapBurst(clientX?: number, clientY?: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    const x = clientX !== undefined && rect ? clientX - rect.left : (rect?.width || 360) * 0.5;
    const y = clientY !== undefined && rect ? clientY - rect.top : (rect?.height || 640) * 0.5;

    const now = Date.now();
    if (now - comboRef.current.lastMs < 800) {
      comboRef.current.count += 1;
    } else {
      comboRef.current.count = 1;
    }
    comboRef.current.lastMs = now;

    const item = createTapBurst(x, y, comboRef.current.count);
    setBursts(prev => [...prev.slice(-14), item]);
    setTimeout(() => {
      setBursts(prev => prev.filter(b => b.id !== item.id));
    }, 900);
  }

  async function handleSendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !activeRoomId) return;
    const text = commentText.trim();
    setCommentText('');
    setComposerFocused(false);
    try {
      if (pinMode) {
        await apiPost(`/api/live/rooms/${activeRoomId}/highlight`, { userId: user.id, text });
        setPinMode(false);
      } else {
        await apiPost(`/api/live/rooms/${activeRoomId}/comment`, { userId: user.id, text });
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'تعذر الإرسال');
      setTimeout(() => setStatusMsg(''), 2500);
    }
  }

  async function handleSendGiftFromSheet(gift: TikTokGiftItem, paymentLabel: string) {
    setGiftTrayOpen(false);
    await apiPost(`/api/live/rooms/${activeRoomId}/gift`, {
      userId: user.id,
      giftName: `${gift.icon} ${gift.name} (${paymentLabel})`,
      giftValueEgp: gift.price,
    });
    setGiftBanner({ sender: user.displayName, giftName: `${gift.icon} ${gift.name}`, payment: paymentLabel });
    triggerStageTapBurst();
  }

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0];

  return (
    <div className="w-full h-full bg-black relative overflow-hidden flex items-center justify-center">
      {/* Full-Screen TikTok Live Stage (Zero Side Containers) */}
      <div
        ref={stageRef}
        onClick={(e) => {
          setComposerFocused(false);
          setMobileNavExpanded(false);
          if (giftTrayOpen) {
            setGiftTrayOpen(false);
            return;
          }
          triggerStageTapBurst(e.clientX, e.clientY);
        }}
        className="relative w-full h-full max-w-[520px] mx-auto bg-black overflow-hidden cursor-pointer"
      >
        {cameraLive ? (
          <video ref={camVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : activeRoom?.videoUrl ? (
          <video
            key={activeRoom.videoUrl}
            src={activeRoom.videoUrl}
            autoPlay
            loop
            playsInline
            muted={muted}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-black" />
        )}

        {/* Multi-Design TikTok Rapid Tap Bursts */}
        <TapBurstOverlay items={bursts} />

        {/* Subtle Legibility Gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

        {/* Top Floating Host & Viewer Controls */}
        <div onClick={e => e.stopPropagation()} className="absolute top-4 inset-x-4 z-20 flex items-center justify-between gap-2">
          {activeRoom && (
            <div className="flex items-center gap-2 ps-1 pe-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12]">
              <UserAvatar initials={activeRoom.hostInitials} avatarUrl={activeRoom.hostAvatarUrl} size={32} online />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate max-w-[125px]">{activeRoom.hostName}</div>
                <div className="text-[10px] text-white/70 truncate max-w-[125px]">{activeRoom.title}</div>
              </div>
              <span className="ms-1 px-2 py-0.5 rounded-full bg-[#EF4444] text-white text-[10px] font-bold">LIVE</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <div className="px-2.5 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12] flex items-center gap-1.5 text-xs font-mono-num text-white">
              <Eye className="w-3.5 h-3.5 text-white/80" />
              <span>{(roomState?.viewersCount || activeRoom?.viewersCount || 0).toLocaleString('en-US')}</span>
            </div>

            <button
              type="button"
              onClick={() => setMuted(m => !m)}
              className="w-8 h-8 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12] text-white flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={toggleCameraBroadcast}
              className={`w-8 h-8 rounded-full backdrop-blur-md border flex items-center justify-center cursor-pointer ${
                cameraLive ? 'bg-white text-black border-white' : 'bg-black/55 border-white/[0.12] text-white'
              }`}
            >
              {cameraLive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Stream Switcher Pills */}
        {rooms.length > 1 && (
          <div onClick={e => e.stopPropagation()} className="absolute top-16 start-4 z-20 flex items-center gap-1.5">
            {rooms.map(r => {
              const active = r.id === activeRoomId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveRoomId(r.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] backdrop-blur-md transition-colors cursor-pointer ${
                    active ? 'bg-white text-black font-semibold' : 'bg-black/45 border border-white/[0.12] text-white/80 hover:text-white'
                  }`}
                >
                  {r.hostName.split(' ')[0]}
                </button>
              );
            })}
          </div>
        )}

        {/* Animated Gift Toast Banner */}
        {giftBanner && (
          <div className="absolute top-28 start-4 z-30 px-4 py-2 rounded-full bg-black/80 backdrop-blur-md border border-white/20 flex items-center gap-2 text-xs text-white">
            <span className="font-semibold">{giftBanner.sender}</span>
            <span className="text-white/85">أرسل {giftBanner.giftName}</span>
            {giftBanner.payment && <span className="text-[10px] text-[#FACC15]">• {giftBanner.payment}</span>}
          </div>
        )}

        {/* Active Pinned Comment */}
        {!giftTrayOpen && roomState?.activeHighlight && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute bottom-[260px] start-4 end-16 z-20 px-3 py-2 rounded-2xl bg-black/70 backdrop-blur-md border border-white/20 flex items-center gap-2"
          >
            <Pin className="w-3.5 h-3.5 text-white shrink-0" />
            <div className="min-w-0 flex-1 text-xs">
              <span className="font-semibold text-white me-1.5">{roomState.activeHighlight.displayName}:</span>
              <span className="text-white/90">{roomState.activeHighlight.text}</span>
            </div>
          </div>
        )}

        {/* Transparent Floating TikTok Comments (Hidden cleanly while Gift Sheet is open!) */}
        {!giftTrayOpen && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute bottom-[80px] start-4 z-20 w-[76%] max-w-[350px] max-h-[168px] overflow-y-auto no-scrollbar live-comments-mask space-y-1.5"
          >
            {(roomState?.recentMessages || []).slice(-25).map(msg => (
              <div key={msg.id} className="flex items-start gap-2 text-[13px] leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                <span className="font-semibold text-white/75 shrink-0">{msg.displayName}</span>
                <span className={msg.isGift ? 'text-[#FACC15] font-medium' : 'text-white'}>{msg.text}</span>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>
        )}

        {/* Floating Side Action Buttons (Hidden cleanly while Gift Sheet is open!) */}
        {!giftTrayOpen && (
          <div onClick={e => e.stopPropagation()} className="absolute bottom-[82px] end-3.5 z-20 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => triggerStageTapBurst()}
              className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.14] text-white hover:text-[#FF2D55] flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
            >
              <Heart className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={() => {
                setComposerFocused(false);
                setGiftTrayOpen(true);
              }}
              className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.14] text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
            >
              <Gift className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setPinMode(v => !v)}
              className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center cursor-pointer transition-colors ${
                pinMode ? 'bg-white text-black border-white' : 'bg-black/55 border-white/[0.14] text-white'
              }`}
            >
              <Pin className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.14] text-white flex items-center justify-center cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {statusMsg && (
          <div className="absolute bottom-24 inset-x-8 z-30 py-1.5 px-3 rounded-full bg-black/85 border border-white/15 text-center text-xs text-white">
            {statusMsg}
          </div>
        )}

        {/* Bottom Floating Composer + Mobile Morphing Nav Pill (Disappears completely when Gift Sheet opens!) */}
        {!giftTrayOpen && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute bottom-3.5 inset-x-3.5 z-20 flex items-center gap-2"
          >
            <MobileInlineNavTrigger lang={lang} />
            {!mobileNavExpanded && (
              <div className="flex-1 min-w-0">
                <ObsidianComposerPill
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={handleSendComment}
                  onFocus={() => setComposerFocused(true)}
                  onBlur={() => setTimeout(() => setComposerFocused(false), 140)}
                  placeholder={pinMode ? 'تعليق مثبت...' : lang === 'ar' ? 'أضف تعليقًا...' : 'Add comment...'}
                  disabled={!commentText.trim()}
                />
              </div>
            )}
          </div>
        )}

        {/* 50-Gift Interactive TikTok Catalog Drawer with Payment Method Selection */}
        {giftTrayOpen && (
          <TikTokGiftSheet
            balance={user.demoBalanceEgp}
            onClose={() => setGiftTrayOpen(false)}
            onSendGift={handleSendGiftFromSheet}
          />
        )}
      </div>
    </div>
  );
}
