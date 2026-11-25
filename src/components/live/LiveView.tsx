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
  X,
} from 'lucide-react';
import { Lang, LiveRoomItem, LiveRoomState, UserProfile } from '../../types';
import { UserAvatar } from '../shared/LmBrandMark';
import { ObsidianComposerPill } from '../shared/HardwareUI';
import { apiGet, apiPost } from '../../lib/api';

interface LiveViewProps {
  user: UserProfile;
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
}

const LIVE_GIFTS = [
  { id: 'rose', icon: '🌹', name: 'وردة', price: 25 },
  { id: 'bolt', icon: '⚡', name: 'برق', price: 100 },
  { id: 'fire', icon: '🔥', name: 'شعلة', price: 250 },
  { id: 'rocket', icon: '🚀', name: 'انطلاق', price: 1000 },
];

export function LiveView({ user, lang, lastWsEvent }: LiveViewProps) {
  const [rooms, setRooms] = useState<LiveRoomItem[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('live_1');
  const [roomState, setRoomState] = useState<LiveRoomState | null>(null);
  const [commentText, setCommentText] = useState('');
  const [pinMode, setPinMode] = useState(false);
  const [muted, setMuted] = useState(true);
  const [giftTrayOpen, setGiftTrayOpen] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<Array<{ id: number; offset: number }>>([]);
  const [giftBanner, setGiftBanner] = useState<{ sender: string; giftName: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Optional creator webcam live mode
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
        setTimeout(() => setGiftBanner(null), 3000);
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

  function spawnHeart() {
    const id = Date.now() + Math.random();
    const offset = Math.round((Math.random() - 0.5) * 44);
    setFloatingHearts(prev => [...prev.slice(-10), { id, offset }]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== id));
    }, 1300);
  }

  async function handleSendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !activeRoomId) return;
    const text = commentText.trim();
    setCommentText('');
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

  async function sendGift(icon: string, name: string, price: number) {
    await apiPost(`/api/live/rooms/${activeRoomId}/gift`, {
      userId: user.id,
      giftName: `${icon} ${name}`,
      giftValueEgp: price,
    });
    setGiftTrayOpen(false);
    spawnHeart();
  }

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0];

  return (
    <div className="w-full h-full bg-black relative overflow-hidden flex items-center justify-center">
      {/* Full-Screen TikTok Live Stage (Zero Side Containers / Zero Cards!) */}
      <div className="relative w-full h-full max-w-[540px] mx-auto bg-black overflow-hidden">
        {cameraLive ? (
          <video
            ref={camVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : activeRoom?.videoUrl ? (
          <video
            key={activeRoom.videoUrl}
            src={activeRoom.videoUrl}
            autoPlay
            loop
            playsInline
            muted={muted}
            onClick={spawnHeart}
            className="w-full h-full object-cover cursor-pointer"
          />
        ) : (
          <div className="w-full h-full bg-black" />
        )}

        {/* Subtle Top & Bottom Vignettes Only for Text Legibility */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

        {/* Top Floating TikTok Host & Stream Switcher Bar */}
        <div className="absolute top-4 inset-x-4 z-20 flex items-center justify-between gap-2">
          {/* Host Pill */}
          {activeRoom && (
            <div className="flex items-center gap-2 ps-1 pe-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12]">
              <UserAvatar initials={activeRoom.hostInitials} avatarUrl={activeRoom.hostAvatarUrl} size={32} online />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate max-w-[120px]">{activeRoom.hostName}</div>
                <div className="text-[10px] text-white/70 truncate max-w-[120px]">{activeRoom.title}</div>
              </div>
              <span className="ms-1 px-2.5 py-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold tracking-wide">
                LIVE
              </span>
            </div>
          )}

          {/* Right Controls: Viewers, Mute, Webcam */}
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
              title="بث بالكاميرا"
              className={`w-8 h-8 rounded-full backdrop-blur-md border flex items-center justify-center cursor-pointer ${
                cameraLive ? 'bg-white text-black border-white' : 'bg-black/55 border-white/[0.12] text-white'
              }`}
            >
              {cameraLive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Stream Switcher Pills (Switch Rooms Directly on Stage) */}
        {rooms.length > 1 && (
          <div className="absolute top-16 start-4 z-20 flex items-center gap-1.5">
            {rooms.map(r => {
              const active = r.id === activeRoomId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveRoomId(r.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] backdrop-blur-md transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-black font-semibold'
                      : 'bg-black/45 border border-white/[0.12] text-white/80 hover:text-white'
                  }`}
                >
                  {r.hostName.split(' ')[0]}
                </button>
              );
            })}
          </div>
        )}

        {/* Transient Gift Toast */}
        {giftBanner && (
          <div className="absolute top-28 start-4 z-30 px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 flex items-center gap-2 text-xs text-white">
            <span className="font-semibold">{giftBanner.sender}</span>
            <span className="text-white/75">أرسل {giftBanner.giftName}</span>
          </div>
        )}

        {/* Active Pinned Comment Pill (Above Overlay Stream) */}
        {roomState?.activeHighlight && (
          <div className="absolute bottom-[310px] start-4 end-16 z-20 px-3 py-2 rounded-2xl bg-black/70 backdrop-blur-md border border-white/20 flex items-center gap-2.5">
            <Pin className="w-3.5 h-3.5 text-white shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-white me-1.5">{roomState.activeHighlight.displayName}:</span>
              <span className="text-xs text-white/90">{roomState.activeHighlight.text}</span>
            </div>
          </div>
        )}

        {/* Transparent TikTok Live Overlay Comments (Zero Container Box!) */}
        <div className="absolute bottom-[132px] start-4 z-20 w-[76%] max-w-[360px] max-h-[170px] overflow-y-auto no-scrollbar live-comments-mask space-y-1.5 pointer-events-auto">
          {(roomState?.recentMessages || []).slice(-25).map(msg => (
            <div key={msg.id} className="flex items-start gap-2 text-[13px] leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
              <span className="font-semibold text-white/75 shrink-0">{msg.displayName}</span>
              <span className={msg.isGift ? 'text-[#FBBF24] font-medium' : 'text-white'}>{msg.text}</span>
            </div>
          ))}
          <div ref={commentsEndRef} />
        </div>

        {/* Floating Hearts Animation */}
        <div className="pointer-events-none absolute bottom-36 end-6 z-30">
          {floatingHearts.map(h => (
            <div
              key={h.id}
              style={{ marginInlineEnd: `${h.offset}px` }}
              className="animate-float-clean text-[#FF2D55]"
            >
              <Heart className="w-6 h-6 fill-current" />
            </div>
          ))}
        </div>

        {/* Right Floating TikTok Action Icons */}
        <div className="absolute bottom-[136px] end-3.5 z-20 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={spawnHeart}
            className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.14] text-white hover:text-[#FF2D55] flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
          >
            <Heart className="w-5 h-5 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => setGiftTrayOpen(v => !v)}
            className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.14] text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
          >
            <Gift className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setPinMode(v => !v)}
            title="تثبيت تعليق"
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

        {/* Minimal Floating Gift Strip */}
        {giftTrayOpen && (
          <div className="absolute bottom-[132px] inset-x-4 z-30 p-2 rounded-2xl bg-[#070709]/95 backdrop-blur-md border border-white/[0.14] flex items-center justify-between gap-1.5">
            {LIVE_GIFTS.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => sendGift(g.icon, g.name, g.price)}
                className="flex-1 py-2 rounded-xl hover:bg-white/[0.06] flex flex-col items-center gap-0.5 cursor-pointer"
              >
                <span className="text-lg">{g.icon}</span>
                <span className="text-[11px] text-white font-medium">{g.name}</span>
                <span className="text-[10px] font-mono-num text-[#8E8E93]">{g.price}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setGiftTrayOpen(false)}
              className="w-7 h-7 rounded-full text-[#8E8E93] hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {statusMsg && (
          <div className="absolute bottom-[132px] inset-x-8 z-30 py-1.5 px-3 rounded-full bg-black/85 border border-white/15 text-center text-xs text-white">
            {statusMsg}
          </div>
        )}

        {/* Bottom Image 1 Pitch-Black Composer Pill Above Nav Dock */}
        <div className="absolute bottom-[68px] inset-x-3.5 z-20">
          <ObsidianComposerPill
            value={commentText}
            onChange={setCommentText}
            onSubmit={handleSendComment}
            placeholder={
              pinMode
                ? lang === 'ar'
                  ? 'اكتب تعليقًا لتثبيته أعلى البث...'
                  : 'Pin a comment...'
                : lang === 'ar'
                ? 'أضف تعليقًا...'
                : 'Add comment...'
            }
            disabled={!commentText.trim()}
          />
        </div>
      </div>
    </div>
  );
}
