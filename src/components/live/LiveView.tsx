import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Eye,
  Heart,
  Volume2,
  VolumeX,
  Gift,
  Pin,
  Radio,
  Share2,
  X,
  Square,
} from 'lucide-react';
import { Lang, LiveRoomItem, LiveRoomState, UserProfile } from '../../types';
import { UserAvatar } from '../shared/LmBrandMark';
import type { SharePayload } from '../shared/ShareSheetModal';
import { ObsidianComposerPill } from '../shared/HardwareUI';
import { SplitComposerOrb } from '../layout/AppShell';
import { useLayout } from '../../context/LayoutContext';
import { TapBurstItem, TapBurstOverlay, createTapBurst } from '../shared/TapComboBurst';
import { TikTokGiftItem, TikTokGiftSheet } from './TikTokGiftSheet';
import { api, apiGet, apiPost } from '../../lib/api';
import { RTC_CONFIG, sendWsSignal, subscribeWs } from '../../lib/wsHub';

interface LiveViewProps {
  user: UserProfile;
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
  onOpenProfile?: (userId: string) => void;
  onShare?: (payload: SharePayload) => void;
}

const LIVE_CATEGORIES = ['عام', 'دردشة', 'تقنية', 'موسيقى', 'ألعاب', 'رياضة'];

export function LiveView({ user, lang, lastWsEvent, onOpenProfile, onShare }: LiveViewProps) {
  const { setComposerFocused, mobileNavExpanded, setMobileNavExpanded } = useLayout();
  const [rooms, setRooms] = useState<LiveRoomItem[]>([]);
  const [activeRoomId, setActiveRoomIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('lm_live_room_id') || 'live_1';
    } catch {
      return 'live_1';
    }
  });
  const [roomState, setRoomState] = useState<LiveRoomState | null>(null);
  const [commentText, setCommentTextState] = useState<string>(() => {
    try {
      return localStorage.getItem('lm_draft_live') || '';
    } catch {
      return '';
    }
  });

  const setActiveRoomId = useCallback((id: string) => {
    setActiveRoomIdState(id);
    try {
      localStorage.setItem('lm_live_room_id', id);
    } catch {
      // ignore
    }
  }, []);

  const setCommentText = useCallback((v: string) => {
    setCommentTextState(v);
    try {
      localStorage.setItem('lm_draft_live', v);
    } catch {
      // ignore
    }
  }, []);

  const [pinMode, setPinMode] = useState(false);
  const [muted, setMuted] = useState(true);
  const [giftTrayOpen, setGiftTrayOpen] = useState(false);
  const [giftBanner, setGiftBanner] = useState<{ sender: string; giftName: string; payment?: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Go Live Studio Modal & Real Multi-Viewer WebRTC Host State
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [goLiveTitle, setGoLiveTitle] = useState('');
  const [goLiveCategory, setGoLiveCategory] = useState('دردشة');
  const [startingLive, setStartingLive] = useState(false);
  const [hostingRoomId, setHostingRoomId] = useState<string | null>(null);
  const [livePeerCount, setLivePeerCount] = useState(0);

  // Remote Viewer WebRTC Live Stream State
  const [viewerConnected, setViewerConnected] = useState(false);
  const [viewerConnecting, setViewerConnecting] = useState(false);

  // TikTok Rapid Multi-Tap Burst Designs & Combo Counter
  const [bursts, setBursts] = useState<TapBurstItem[]>([]);
  const comboRef = useRef({ count: 0, lastMs: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);

  const camVideoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const remoteLiveVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteLiveStreamRef = useRef<MediaStream | null>(null);

  // Host holds one RTCPeerConnection per connected viewer clientId
  const hostPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  // Viewer holds one RTCPeerConnection to the active host
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);
  const viewerHostClientRef = useRef<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  const showNotice = useCallback((msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(cur => (cur === msg ? '' : cur)), 2800);
  }, []);

  const loadRooms = useCallback(async () => {
    const res = await apiGet<{ ok: boolean; rooms: LiveRoomItem[] }>('/api/live/rooms');
    setRooms(res.rooms);
    if (res.rooms.length > 0 && !res.rooms.some(r => r.id === activeRoomId)) {
      setActiveRoomId(res.rooms[0].id);
    }
  }, [activeRoomId, setActiveRoomId]);

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
    if (lastWsEvent.event === 'live:rooms_updated') {
      loadRooms();
    }
    if (lastWsEvent.event === 'live:room_ended') {
      const p = lastWsEvent.payload as { roomId?: string };
      if (p?.roomId === activeRoomId) {
        showNotice('انتهى هذا البث المباشر');
        setViewerConnected(false);
        setViewerConnecting(false);
      }
      loadRooms();
    }
  }, [lastWsEvent, activeRoomId, loadRooms, showNotice]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomState?.recentMessages.length]);

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0];
  const isHostingActiveRoom = Boolean(hostingRoomId && activeRoom?.id === hostingRoomId);

  // Stop viewer WebRTC connection cleanly when switching rooms or unmounting
  const teardownViewerRtc = useCallback(() => {
    if (viewerHostClientRef.current && activeRoomId) {
      sendWsSignal('rtc:live:leave', {
        roomId: activeRoomId,
        targetClientId: viewerHostClientRef.current,
      });
    }
    viewerPcRef.current?.close();
    viewerPcRef.current = null;
    viewerHostClientRef.current = null;
    remoteLiveStreamRef.current = null;
    setViewerConnected(false);
    setViewerConnecting(false);
  }, [activeRoomId]);

  const stopHostingBroadcast = useCallback(
    async (notifyApi = true) => {
      const rid = hostingRoomId;
      hostPeersRef.current.forEach(pc => pc.close());
      hostPeersRef.current.clear();
      setLivePeerCount(0);
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
      setHostingRoomId(null);
      if (notifyApi && rid) {
        try {
          await api(`/api/live/rooms/${rid}?hostId=${user.id}`, { method: 'DELETE' });
        } catch {
          // ignore
        }
        loadRooms();
      }
    },
    [hostingRoomId, user.id, loadRooms]
  );

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      hostPeersRef.current.forEach(pc => pc.close());
      hostPeersRef.current.clear();
      viewerPcRef.current?.close();
      camStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Re-attach local camera video element when hosting
  useEffect(() => {
    if (isHostingActiveRoom && camStreamRef.current && camVideoRef.current) {
      camVideoRef.current.srcObject = camStreamRef.current;
    }
  }, [isHostingActiveRoom]);

  // Re-attach remote live video element when viewer receives host stream
  useEffect(() => {
    if (viewerConnected && remoteLiveStreamRef.current && remoteLiveVideoRef.current) {
      remoteLiveVideoRef.current.srcObject = remoteLiveStreamRef.current;
    }
  }, [viewerConnected]);

  // Viewer automatically joins real WebRTC live room when opening another user's live broadcast
  useEffect(() => {
    teardownViewerRtc();
    if (!activeRoom || activeRoom.videoUrl || activeRoom.scenePreset !== 'webrtc_live') return;
    if (hostingRoomId === activeRoom.id) return;

    setViewerConnecting(true);
    sendWsSignal('rtc:live:join', {
      roomId: activeRoom.id,
      targetUserId: activeRoom.hostId,
      fromUserId: user.id,
    });

    const retry = window.setTimeout(() => {
      if (!viewerPcRef.current) {
        sendWsSignal('rtc:live:join', {
          roomId: activeRoom.id,
          targetUserId: activeRoom.hostId,
          fromUserId: user.id,
        });
      }
    }, 2000);

    return () => {
      window.clearTimeout(retry);
      teardownViewerRtc();
    };
  }, [activeRoom?.id, activeRoom?.videoUrl, activeRoom?.scenePreset, activeRoom?.hostId, hostingRoomId, user.id, teardownViewerRtc]);

  // Zero-Drop WebRTC Signaling Handler for BOTH Host (1 -> N viewers) AND Viewer!
  useEffect(() => {
    return subscribeWs(async frame => {
      const p = (frame.payload || {}) as Record<string, unknown>;

      // HOST: A remote viewer wants to watch our live broadcast!
      if (frame.event === 'rtc:live:join') {
        const roomId = String(p.roomId || '');
        const viewerClientId = String(p.fromClientId || '');
        if (!hostingRoomId || roomId !== hostingRoomId || !viewerClientId || !camStreamRef.current) return;

        hostPeersRef.current.get(viewerClientId)?.close();
        const pc = new RTCPeerConnection(RTC_CONFIG);
        hostPeersRef.current.set(viewerClientId, pc);
        setLivePeerCount(hostPeersRef.current.size);

        camStreamRef.current.getTracks().forEach(track => {
          if (camStreamRef.current) pc.addTrack(track, camStreamRef.current);
        });

        pc.onicecandidate = ev => {
          if (!ev.candidate) return;
          sendWsSignal('rtc:live:ice', {
            roomId,
            role: 'host',
            candidate: ev.candidate.toJSON(),
            targetClientId: viewerClientId,
          });
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
            pc.close();
            hostPeersRef.current.delete(viewerClientId);
            setLivePeerCount(hostPeersRef.current.size);
          }
        };

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendWsSignal('rtc:live:offer', {
            roomId,
            sdp: offer,
            targetClientId: viewerClientId,
          });
        } catch {
          pc.close();
          hostPeersRef.current.delete(viewerClientId);
          setLivePeerCount(hostPeersRef.current.size);
        }
        return;
      }

      // HOST: Viewer answered our offer
      if (frame.event === 'rtc:live:answer') {
        const roomId = String(p.roomId || '');
        const viewerClientId = String(p.fromClientId || '');
        if (!hostingRoomId || roomId !== hostingRoomId) return;
        const pc = hostPeersRef.current.get(viewerClientId);
        if (pc && p.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(p.sdp as RTCSessionDescriptionInit)).catch(() => {});
        }
        return;
      }

      // HOST: Viewer left
      if (frame.event === 'rtc:live:leave') {
        const viewerClientId = String(p.fromClientId || '');
        const pc = hostPeersRef.current.get(viewerClientId);
        if (pc) {
          pc.close();
          hostPeersRef.current.delete(viewerClientId);
          setLivePeerCount(hostPeersRef.current.size);
        }
        return;
      }

      // VIEWER: Host sent us a WebRTC broadcast offer!
      if (frame.event === 'rtc:live:offer') {
        const roomId = String(p.roomId || '');
        const hostClientId = String(p.fromClientId || '');
        if (!activeRoom || roomId !== activeRoom.id || hostingRoomId === roomId || !p.sdp) return;

        viewerPcRef.current?.close();
        const pc = new RTCPeerConnection(RTC_CONFIG);
        viewerPcRef.current = pc;
        viewerHostClientRef.current = hostClientId;

        const remoteStream = new MediaStream();
        remoteLiveStreamRef.current = remoteStream;

        pc.ontrack = ev => {
          ev.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t));
          if (!ev.streams[0] && ev.track) remoteStream.addTrack(ev.track);
          setViewerConnecting(false);
          setViewerConnected(true);
          setTimeout(() => {
            if (remoteLiveVideoRef.current) remoteLiveVideoRef.current.srcObject = remoteStream;
          }, 50);
        };

        pc.onicecandidate = ev => {
          if (!ev.candidate) return;
          sendWsSignal('rtc:live:ice', {
            roomId,
            role: 'viewer',
            candidate: ev.candidate.toJSON(),
            targetClientId: hostClientId,
          });
        };

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(p.sdp as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWsSignal('rtc:live:answer', {
            roomId,
            sdp: answer,
            targetClientId: hostClientId,
          });
        } catch {
          setViewerConnecting(false);
        }
        return;
      }

      // BOTH: Exchange ICE candidates
      if (frame.event === 'rtc:live:ice' && p.candidate) {
        const cand = new RTCIceCandidate(p.candidate as RTCIceCandidateInit);
        if (p.role === 'host' && viewerPcRef.current) {
          await viewerPcRef.current.addIceCandidate(cand).catch(() => {});
        } else if (p.role === 'viewer') {
          const viewerClientId = String(p.fromClientId || '');
          const pc = hostPeersRef.current.get(viewerClientId);
          if (pc) await pc.addIceCandidate(cand).catch(() => {});
        }
      }
    });
  }, [hostingRoomId, activeRoom]);

  async function startCustomLiveBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!goLiveTitle.trim() || startingLive) return;
    setStartingLive(true);
    try {
      let stream: MediaStream | null = null;
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
            audio: true,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch {
            stream = null;
          }
        }
      }

      const res = await apiPost<{ ok: boolean; room: LiveRoomItem }>('/api/live/rooms', {
        hostId: user.id,
        title: goLiveTitle.trim(),
        category: goLiveCategory,
      });

      camStreamRef.current = stream;
      setHostingRoomId(res.room.id);
      setActiveRoomId(res.room.id);
      setGoLiveOpen(false);
      setGoLiveTitle('');
      await loadRooms();
      setTimeout(() => {
        if (camVideoRef.current && stream) camVideoRef.current.srcObject = stream;
      }, 80);
      showNotice(stream ? 'أنت الآن على البث المباشر!' : 'تم فتح غرفة البث (الكاميرا غير متاحة على هذا الجهاز)');
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'تعذر بدء البث المباشر');
    } finally {
      setStartingLive(false);
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
      showNotice(err instanceof Error ? err.message : 'تعذر الإرسال');
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

  const displayedViewers =
    isHostingActiveRoom
      ? Math.max(1, livePeerCount + 1)
      : roomState?.viewersCount || activeRoom?.viewersCount || 0;

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
        {isHostingActiveRoom ? (
          camStreamRef.current ? (
            <video ref={camVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-[#1A0D0E] via-[#0A0A0D] to-black flex flex-col items-center justify-center gap-3 px-6 text-center">
              <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={86} online />
              <div className="text-sm font-bold text-white">{activeRoom?.title}</div>
              <div className="text-xs text-[#FB7185]">غرفة بث صوتي/تفاعلي مباشر</div>
            </div>
          )
        ) : viewerConnected ? (
          <video ref={remoteLiveVideoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
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
          <div className="w-full h-full bg-gradient-to-b from-[#170E11] via-[#0B0B0F] to-black flex flex-col items-center justify-center gap-3 px-6 text-center">
            {activeRoom && (
              <UserAvatar
                initials={activeRoom.hostInitials}
                avatarUrl={activeRoom.hostAvatarUrl}
                size={84}
                online
              />
            )}
            <div className="text-sm font-bold text-white">{activeRoom?.title || 'بث مباشر'}</div>
            <div className="text-xs text-[#9E9EA8]">
              {viewerConnecting ? 'جارٍ الاتصال بكاميرا المذيع عبر WebRTC...' : 'بانتظار بث الفيديو من المذيع'}
            </div>
          </div>
        )}

        {/* Multi-Design TikTok Rapid Tap Bursts */}
        <TapBurstOverlay items={bursts} />

        {/* Subtle Legibility Gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

        {/* Top Floating Host & Viewer Controls */}
        <div onClick={e => e.stopPropagation()} className="absolute top-4 inset-x-4 z-20 flex items-center justify-between gap-2">
          {activeRoom && (
            <button
              type="button"
              onClick={() => onOpenProfile?.(activeRoom.hostId)}
              className="flex items-center gap-2 ps-1 pe-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12] hover:border-white/30 cursor-pointer text-start transition-colors min-w-0"
            >
              <UserAvatar initials={activeRoom.hostInitials} avatarUrl={activeRoom.hostAvatarUrl} size={32} online />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate max-w-[115px]">{activeRoom.hostName}</div>
                <div className="text-[10px] text-white/70 truncate max-w-[115px]">{activeRoom.title}</div>
              </div>
              <span className="ms-1 px-2 py-0.5 rounded-full bg-gradient-to-tr from-[#EF4444] to-[#F97316] text-white text-[10px] font-bold shrink-0">
                LIVE
              </span>
            </button>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="px-2.5 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12] flex items-center gap-1.5 text-xs font-mono-num text-white">
              <Eye className="w-3.5 h-3.5 text-white/80" />
              <span>{displayedViewers.toLocaleString('en-US')}</span>
            </div>

            <button
              type="button"
              onClick={() => setMuted(m => !m)}
              className="w-8 h-8 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12] text-white flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {hostingRoomId ? (
              <button
                type="button"
                onClick={() => stopHostingBroadcast(true)}
                title="إنهاء البث"
                className="h-8 px-3 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>إنهاء</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setGoLiveOpen(true)}
                title="ابدأ بثًا مباشرًا"
                className="h-8 px-3 rounded-full bg-gradient-to-tr from-[#EF4444] to-[#F97316] text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-lg hover:opacity-95 transition-opacity"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>ابدأ بثًا</span>
              </button>
            )}
          </div>
        </div>

        {/* Stream Switcher Pills */}
        {rooms.length > 1 && (
          <div onClick={e => e.stopPropagation()} className="absolute top-16 inset-x-4 z-20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {rooms.map(r => {
              const active = r.id === activeRoomId;
              const isCustomLive = r.scenePreset === 'webrtc_live';
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveRoomId(r.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] backdrop-blur-md transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    active ? 'bg-white text-black font-semibold' : 'bg-black/45 border border-white/[0.12] text-white/80 hover:text-white'
                  }`}
                >
                  {isCustomLive && <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />}
                  <span>{r.hostName.split(' ')[0]}</span>
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
            <Pin className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
            <div className="min-w-0 flex-1 text-xs">
              <button
                type="button"
                onClick={() => onOpenProfile?.(roomState.activeHighlight!.userId)}
                className="font-semibold text-white hover:underline me-1.5 cursor-pointer"
              >
                {roomState.activeHighlight.displayName}:
              </button>
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
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(msg.userId)}
                  className="font-semibold text-white/80 hover:text-white hover:underline shrink-0 cursor-pointer"
                >
                  {msg.displayName}
                </button>
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
              onClick={() => {
                if (activeRoom && onShare) {
                  onShare({
                    kind: 'live',
                    title: activeRoom.title,
                    subtitle: activeRoom.hostName,
                    snippet: `شاهد البث المباشر الآن على LM • ${activeRoom.category}`,
                    avatarUrl: activeRoom.hostAvatarUrl,
                    avatarInitials: activeRoom.hostInitials,
                    path: `/live/${activeRoom.id}`,
                  });
                } else {
                  navigator.clipboard?.writeText(window.location.href);
                  showNotice('تم نسخ رابط البث');
                }
              }}
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

        {/* Bottom Floating Composer + Split Orb */}
        {!giftTrayOpen && !mobileNavExpanded && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute bottom-3.5 inset-x-3.5 z-20 flex items-end gap-2"
          >
            <SplitComposerOrb showNavOption />
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
          </div>
        )}

        {/* 50-Gift Interactive TikTok Catalog Drawer */}
        {giftTrayOpen && (
          <TikTokGiftSheet
            balance={user.demoBalanceEgp}
            onClose={() => setGiftTrayOpen(false)}
            onSendGift={handleSendGiftFromSheet}
          />
        )}
      </div>

      {/* Go Live Studio Modal — Create Custom Live Broadcast Room */}
      {goLiveOpen && (
        <div
          onClick={() => setGoLiveOpen(false)}
          className="fixed inset-0 z-50 bg-black/82 backdrop-blur-md flex items-center justify-center p-4"
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={startCustomLiveBroadcast}
            className="w-full max-w-[400px] rounded-[28px] bg-[#13131A]/98 border border-white/[0.13] p-5 space-y-4 text-start shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Radio className="w-4 h-4 text-[#EF4444]" />
                <span>إنشاء بث مباشر جديد</span>
              </div>
              <button
                type="button"
                onClick={() => setGoLiveOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#8E8E93] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#A1A1AA] block">عنوان البث</label>
              <input
                autoFocus
                value={goLiveTitle}
                onChange={e => setGoLiveTitle(e.target.value)}
                placeholder="مثال: جلسة نقاش مفتوحة حول الذكاء الاصطناعي..."
                className="w-full h-11 rounded-2xl bg-[#0A0A0D] border border-white/[0.1] focus:border-[#EF4444]/50 px-3.5 text-xs text-white placeholder:text-[#585860] outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#A1A1AA] block">التصنيف</label>
              <div className="flex flex-wrap gap-1.5">
                {LIVE_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setGoLiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs cursor-pointer transition-colors ${
                      goLiveCategory === cat
                        ? 'bg-gradient-to-tr from-[#EF4444] to-[#F97316] text-white font-semibold'
                        : 'bg-white/[0.05] border border-white/[0.09] text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-[#8E8E93] leading-relaxed">
              سيتم بث الكاميرا والميكروفون مباشرة لأي مستخدم ينضم لغرفتك عبر WebRTC لحظيًا، ويمكنك إنهاء البث في أي لحظة.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setGoLiveOpen(false)}
                className="px-4 py-2 rounded-full bg-white/[0.07] text-xs text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={startingLive || !goLiveTitle.trim()}
                className="px-5 py-2 rounded-full bg-gradient-to-tr from-[#EF4444] to-[#F97316] text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{startingLive ? 'جارٍ التشغيل...' : 'بدء البث الآن'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
