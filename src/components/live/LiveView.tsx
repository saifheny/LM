import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Keyboard } from 'swiper/modules';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Flag,
  Heart,
  Volume2,
  VolumeX,
  Pin,
  Radio,
  Share2,
  Square,
} from 'lucide-react';
import { Lang, LiveRoomItem, LiveRoomState, UserProfile } from '../../types';
import { UserAvatar } from '../shared/LmBrandMark';
import type { SharePayload } from '../shared/ShareSheetModal';
import { ObsidianComposerPill } from '../shared/HardwareUI';
import { SplitComposerOrb } from '../layout/AppShell';
import { useLayout } from '../../context/LayoutContext';
import { TapBurstItem, TapBurstOverlay, createTapBurst } from '../shared/TapComboBurst';
import { ReportContentModal, ReportRequest, SensitiveMediaShield } from '../shared/SensitiveShield';
import { CloseOrbButton, PublishActionButton, StudioModalOverlay } from '../shared/ModalChrome2026';
import { api, apiGet, apiPost } from '../../lib/api';
import { RTC_CONFIG, sendWsSignal, subscribeWs } from '../../lib/wsHub';

interface LiveViewProps {
  user: UserProfile;
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
  onOpenProfile?: (userId: string) => void;
  onShare?: (payload: SharePayload) => void;
}

interface FlyingLikeOrb {
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

const LIVE_CATEGORIES = ['عام', 'دردشة', 'تقنية', 'موسيقى', 'ألعاب', 'رياضة'];

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.max(0, Math.floor(n)));
}

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
  const [activeIndex, setActiveIndex] = useState(0);
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
  const [statusMsg, setStatusMsg] = useState('');

  // TikTok Live Tap-to-Like Energy Gauge State (Fills on taps, flies hearts up to arrow meter!)
  const [tapProgress, setTapProgress] = useState(0);
  const [tapLevel, setTapLevel] = useState(1);
  const [gaugePulse, setGaugePulse] = useState(false);
  const [flyingOrbs, setFlyingOrbs] = useState<FlyingLikeOrb[]>([]);
  const [optimisticLikes, setOptimisticLikes] = useState<Record<string, number>>({});
  const pendingLikeBatchRef = useRef<{ roomId: string; count: number; timer: number | null }>({
    roomId: '',
    count: 0,
    timer: null,
  });

  // Scrollable Live Comments Tracking (Never force-scroll if user scrolled up to read earlier comments!)
  const [scrolledUpComments, setScrolledUpComments] = useState(false);
  const commentsScrollRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);

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

  // Sensitive Content Blur & Universal Reporting
  const [reportRequest, setReportRequest] = useState<ReportRequest | null>(null);
  const [revealedRooms, setRevealedRooms] = useState<Record<string, boolean>>({});

  // TikTok Rapid Multi-Tap Burst Designs & Combo Counter
  const [bursts, setBursts] = useState<TapBurstItem[]>([]);
  const comboRef = useRef({ count: 0, lastMs: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gaugeRef = useRef<HTMLDivElement | null>(null);
  const swiperRef = useRef<SwiperClass | null>(null);
  const wheelLockUntilRef = useRef<number>(0);

  const slideVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
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
    const res = await apiGet<{ ok: boolean; rooms: LiveRoomItem[] }>(`/api/live/rooms?userId=${user.id}`);
    const list = res.rooms || [];
    setRooms(list);
    if (list.length > 0) {
      const idx = list.findIndex(r => r.id === activeRoomId);
      if (idx >= 0) {
        setActiveIndex(idx);
      } else {
        setActiveIndex(0);
        setActiveRoomId(list[0].id);
      }
    }
  }, [user.id, activeRoomId, setActiveRoomId]);

  const loadState = useCallback(async (id: string) => {
    const res = await apiGet<{ ok: boolean; state: LiveRoomState }>(`/api/live/rooms/${id}/state`);
    setRoomState(res.state);
    setOptimisticLikes(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (activeRoomId) {
      setPinMode(false);
      userScrolledUpRef.current = false;
      setScrolledUpComments(false);
      loadState(activeRoomId);
    }
  }, [activeRoomId, loadState]);

  // Sync Swiper position whenever activeRoomId changes externally
  useEffect(() => {
    if (rooms.length === 0) return;
    const idx = rooms.findIndex(r => r.id === activeRoomId);
    if (idx >= 0 && idx !== activeIndex) {
      setActiveIndex(idx);
      swiperRef.current?.slideTo(idx, 250);
    }
  }, [activeRoomId, rooms, activeIndex]);

  // Play only the active slide's background video cleanly
  useEffect(() => {
    Object.entries(slideVideoRefs.current).forEach(([rid, el]) => {
      if (!el) return;
      if (rid === activeRoomId) {
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    });
  }, [activeRoomId, rooms.length]);

  useEffect(() => {
    if (!lastWsEvent) return;
    if (lastWsEvent.event === 'live:state') {
      const st = lastWsEvent.payload as LiveRoomState;
      if (st.roomId === activeRoomId) {
        setRoomState(st);
        setOptimisticLikes(prev => {
          if (!(st.roomId in prev)) return prev;
          const next = { ...prev };
          delete next[st.roomId];
          return next;
        });
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
    if (lastWsEvent.event === 'content:reported') {
      const payload = lastWsEvent.payload as {
        targetType?: string;
        targetId?: string;
        reportsCount?: number;
        isSensitive?: boolean;
      };
      if (payload.targetType === 'live' && payload.targetId) {
        setRooms(prev =>
          prev.map(r =>
            r.id === payload.targetId
              ? { ...r, reportsCount: payload.reportsCount, isSensitive: payload.isSensitive }
              : r
          )
        );
      }
    }
  }, [lastWsEvent, activeRoomId, loadRooms, showNotice]);

  // Smart Scroll: Only auto-scroll comments if the viewer hasn't scrolled up to read earlier comments!
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomState?.recentMessages.length]);

  function handleCommentsScroll() {
    const el = commentsScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const up = distanceFromBottom > 36;
    userScrolledUpRef.current = up;
    setScrolledUpComments(up);
  }

  function jumpToLatestComments() {
    userScrolledUpRef.current = false;
    setScrolledUpComments(false);
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  const activeRoom = rooms[activeIndex] || rooms.find(r => r.id === activeRoomId) || rooms[0];
  const isHostingActiveRoom = Boolean(hostingRoomId && activeRoom?.id === hostingRoomId);
  const isOwnerOfActiveRoom = Boolean(activeRoom && activeRoom.hostId === user.id);

  /**
   * 100% Deterministic Laptop Trackpad / Mousewheel Single-Stream Stepper
   */
  function handleSingleLiveWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (goLiveOpen || reportRequest || rooms.length <= 1) return;
    if ((e.target as HTMLElement | null)?.closest('.live-comments-scroll')) return;
    if (Math.abs(e.deltaY) < 16) return;
    const now = Date.now();
    if (now < wheelLockUntilRef.current) return;
    wheelLockUntilRef.current = now + 620;
    if (e.deltaY > 0) {
      swiperRef.current?.slideNext();
    } else {
      swiperRef.current?.slidePrev();
    }
  }

  // Flush batched tap-likes to backend so room popularity & ranking rise in real time!
  const queueLiveLike = useCallback(
    (roomId: string) => {
      const batch = pendingLikeBatchRef.current;
      if (batch.roomId && batch.roomId !== roomId && batch.count > 0) {
        const prevRoom = batch.roomId;
        const prevCount = batch.count;
        batch.count = 0;
        if (batch.timer) window.clearTimeout(batch.timer);
        apiPost(`/api/live/rooms/${prevRoom}/like`, { userId: user.id, count: prevCount }).catch(() => {});
      }
      batch.roomId = roomId;
      batch.count += 1;
      if (batch.timer) window.clearTimeout(batch.timer);
      batch.timer = window.setTimeout(() => {
        const sendRoom = batch.roomId;
        const sendCount = batch.count;
        batch.count = 0;
        batch.timer = null;
        if (sendRoom && sendCount > 0) {
          apiPost(`/api/live/rooms/${sendRoom}/like`, { userId: user.id, count: sendCount }).catch(() => {});
        }
      }, 380);
    },
    [user.id]
  );

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
      if (pendingLikeBatchRef.current.timer) window.clearTimeout(pendingLikeBatchRef.current.timer);
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
  }, [isHostingActiveRoom, activeIndex]);

  // Re-attach remote live video element when viewer receives host stream
  useEffect(() => {
    if (viewerConnected && remoteLiveStreamRef.current && remoteLiveVideoRef.current) {
      remoteLiveVideoRef.current.srcObject = remoteLiveStreamRef.current;
    }
  }, [viewerConnected, activeIndex]);

  // Viewer automatically joins real WebRTC live room when swiping onto another user's live broadcast
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
      const refreshed = await apiGet<{ ok: boolean; rooms: LiveRoomItem[] }>(`/api/live/rooms?userId=${user.id}`);
      const list = refreshed.rooms || [];
      setRooms(list);
      const newIdx = Math.max(0, list.findIndex(r => r.id === res.room.id));
      setActiveIndex(newIdx);
      setTimeout(() => {
        swiperRef.current?.slideTo(newIdx, 0);
        if (camVideoRef.current && stream) camVideoRef.current.srcObject = stream;
      }, 80);
      showNotice(stream ? 'أنت الآن على البث المباشر!' : 'تم فتح غرفة البث (الكاميرا غير متاحة على هذا الجهاز)');
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'تعذر بدء البث المباشر');
    } finally {
      setStartingLive(false);
    }
  }

  /**
   * TikTok Live Tap-to-Like Engine:
   * Every tap spawns a burst, sends a glowing heart orb flying up into the top Arrow Energy Gauge,
   * fills the gauge smoothly (leveling up every 15 taps), and boosts the broadcast's real popularity!
   */
  function triggerStageTapBurst(clientX?: number, clientY?: number) {
    const stageRect = stageRef.current?.getBoundingClientRect();
    const x = clientX !== undefined && stageRect ? clientX - stageRect.left : (stageRect?.width || 360) * 0.5;
    const y = clientY !== undefined && stageRect ? clientY - stageRect.top : (stageRect?.height || 640) * 0.5;

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

    // Spawn flying heart orb curving up into the top Arrow Energy Gauge!
    const gaugeRect = gaugeRef.current?.getBoundingClientRect();
    if (stageRect && gaugeRect) {
      const targetX = gaugeRect.left - stageRect.left + gaugeRect.width * 0.5;
      const targetY = gaugeRect.top - stageRect.top + gaugeRect.height * 0.5;
      const orbId = `orb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setFlyingOrbs(prev => [...prev.slice(-10), { id: orbId, startX: x, startY: y, targetX, targetY }]);
      setTimeout(() => {
        setFlyingOrbs(prev => prev.filter(o => o.id !== orbId));
      }, 680);
    }

    // Fill the top TikTok Arrow Energy Gauge (15 taps = 100% Level Up!)
    setTapProgress(prev => {
      const next = prev + 100 / 15;
      if (next >= 100) {
        setTapLevel(lvl => lvl + 1);
        return 8;
      }
      return next;
    });
    setGaugePulse(true);
    setTimeout(() => setGaugePulse(false), 260);

    // Real backend like counter + Live popularity boost!
    if (activeRoom?.id) {
      setOptimisticLikes(prev => ({ ...prev, [activeRoom.id]: (prev[activeRoom.id] || 0) + 1 }));
      queueLiveLike(activeRoom.id);
    }
  }

  async function handleSendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !activeRoom?.id) return;
    const text = commentText.trim();
    setCommentText('');
    setComposerFocused(false);
    // When sending our own comment, smoothly snap back to latest so we see it right away
    userScrolledUpRef.current = false;
    setScrolledUpComments(false);
    try {
      if (pinMode && isOwnerOfActiveRoom) {
        await apiPost(`/api/live/rooms/${activeRoom.id}/highlight`, { userId: user.id, text });
        setPinMode(false);
      } else {
        await apiPost(`/api/live/rooms/${activeRoom.id}/comment`, { userId: user.id, text });
      }
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'تعذر الإرسال');
    }
  }

  const displayedViewers =
    isHostingActiveRoom
      ? Math.max(1, livePeerCount + 1)
      : roomState?.viewersCount || activeRoom?.viewersCount || 0;

  const baseLikes =
    (roomState && activeRoom && roomState.roomId === activeRoom.id
      ? roomState.likesCount
      : activeRoom?.likesCount) || 0;
  const displayedLikes = baseLikes + (activeRoom ? optimisticLikes[activeRoom.id] || 0 : 0);

  return (
    <div
      onWheel={handleSingleLiveWheel}
      className="w-full h-full bg-black relative overflow-hidden flex items-center justify-center"
    >
      {/* Full-Screen Vertical Swipe TikTok Live Feed (ZERO Gifts, ZERO Redundant Heart Button, ZERO Swipe Hint Badge!) */}
      <div
        ref={stageRef}
        onClick={(e) => {
          setComposerFocused(false);
          setMobileNavExpanded(false);
          triggerStageTapBurst(e.clientX, e.clientY);
        }}
        className="relative w-full h-full max-w-[520px] mx-auto bg-black overflow-hidden cursor-pointer"
      >
        <Swiper
          direction="vertical"
          modules={[Keyboard]}
          keyboard={{ enabled: true }}
          initialSlide={activeIndex}
          speed={400}
          slidesPerView={1}
          onSwiper={(sw: SwiperClass) => {
            swiperRef.current = sw;
          }}
          onSlideChange={(sw: SwiperClass) => {
            const nextIdx = sw.activeIndex;
            setActiveIndex(nextIdx);
            const nextRoom = rooms[nextIdx];
            if (nextRoom) setActiveRoomId(nextRoom.id);
          }}
          className="w-full h-full"
        >
          {rooms.map((room, idx) => {
            const isCurrent = idx === activeIndex;
            const isHostingThis = Boolean(hostingRoomId && room.id === hostingRoomId);

            return (
              <SwiperSlide key={room.id} className="w-full h-full relative bg-black">
                {isHostingThis ? (
                  camStreamRef.current ? (
                    <video
                      ref={camVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-b from-[#1A0D0E] via-[#0A0A0D] to-black flex flex-col items-center justify-center gap-3 px-6 text-center">
                      <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={86} online />
                      <div className="text-sm font-bold text-white">{room.title}</div>
                      <div className="text-xs text-[#FB7185]">غرفة بث صوتي/تفاعلي مباشر</div>
                    </div>
                  )
                ) : isCurrent && viewerConnected ? (
                  <video ref={remoteLiveVideoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
                ) : room.videoUrl ? (
                  <video
                    ref={el => {
                      slideVideoRefs.current[room.id] = el;
                    }}
                    src={room.videoUrl}
                    autoPlay={isCurrent}
                    loop
                    playsInline
                    muted={muted}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-[#170E11] via-[#0B0B0F] to-black flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <UserAvatar
                      initials={room.hostInitials}
                      avatarUrl={room.hostAvatarUrl}
                      size={84}
                      online
                    />
                    <div className="text-sm font-bold text-white">{room.title || 'بث مباشر'}</div>
                    <div className="text-xs text-[#9E9EA8]">
                      {isCurrent && viewerConnecting
                        ? 'جارٍ الاتصال بكاميرا المذيع عبر WebRTC...'
                        : 'بانتظار بث الفيديو من المذيع'}
                    </div>
                  </div>
                )}

                {/* Telegram-Style Animated Particle Sensitive Blur (z-10 so z-20 Comments & Controls stay interactive!) */}
                {room.isSensitive && !revealedRooms[room.id] && (
                  <SensitiveMediaShield
                    revealed={false}
                    onReveal={() => setRevealedRooms(prev => ({ ...prev, [room.id]: true }))}
                  />
                )}
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* Multi-Design TikTok Rapid Tap Bursts */}
        <TapBurstOverlay items={bursts} />

        {/* Flying Glowing Hearts Arcing Up into the Top Arrow Energy Gauge! */}
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {flyingOrbs.map(orb => (
            <motion.div
              key={orb.id}
              initial={{ x: orb.startX - 10, y: orb.startY - 10, scale: 1.15, opacity: 1 }}
              animate={{
                x: orb.targetX - 8,
                y: orb.targetY - 8,
                scale: 0.45,
                opacity: 0.25,
              }}
              transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-0 left-0 w-5 h-5 flex items-center justify-center"
            >
              <Heart className="w-4 h-4 text-[#FF2D55] fill-current drop-shadow-[0_0_8px_rgba(255,45,85,0.9)]" />
            </motion.div>
          ))}
        </div>

        {/* Subtle Legibility Gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/78 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-72 bg-gradient-to-t from-black/92 via-black/50 to-transparent" />

        {/* Top Floating Host Pill + TikTok Tap-to-Like Rising Arrow Energy Gauge Below It! */}
        <div onClick={e => e.stopPropagation()} className="absolute top-4 inset-x-4 z-20 flex items-start justify-between gap-2">
          {activeRoom && (
            <div className="flex flex-col items-start gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => onOpenProfile?.(activeRoom.hostId)}
                className="flex items-center gap-2 ps-1 pe-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12] hover:border-white/30 cursor-pointer text-start transition-colors min-w-0"
              >
                <div
                  className={
                    activeRoom.hasActiveStory
                      ? 'p-[1.5px] rounded-full bg-gradient-to-tr from-[#F59E0B] via-[#FB7185] to-[#FF2D55] shrink-0'
                      : 'shrink-0'
                  }
                >
                  <div className={activeRoom.hasActiveStory ? 'p-[1px] rounded-full bg-black' : ''}>
                    <UserAvatar initials={activeRoom.hostInitials} avatarUrl={activeRoom.hostAvatarUrl} size={32} online />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate max-w-[115px]">{activeRoom.hostName}</div>
                  <div className="text-[10px] text-white/70 truncate max-w-[115px]">{activeRoom.title}</div>
                </div>
                <span className="ms-1 px-2 py-0.5 rounded-full bg-gradient-to-tr from-[#EF4444] to-[#F97316] text-white text-[10px] font-bold shrink-0">
                  LIVE
                </span>
              </button>

              {/* TikTok Live Tap-to-Like Rising Arrow Energy Gauge (Fills smoothly with every screen tap!) */}
              <motion.div
                ref={gaugeRef}
                animate={gaugePulse ? { scale: [1, 1.07, 1] } : { scale: 1 }}
                transition={{ duration: 0.22 }}
                className="relative overflow-hidden px-2.5 py-1 rounded-full bg-black/58 backdrop-blur-md border border-white/[0.14] flex items-center gap-2 min-w-[138px]"
              >
                {/* Live Rising Fill Bar Behind */}
                <div
                  style={{ width: `${Math.min(100, Math.max(8, tapProgress))}%` }}
                  className="pointer-events-none absolute inset-y-0 start-0 bg-gradient-to-l from-[#FF2D55]/55 via-[#FB7185]/40 to-[#F59E0B]/45 transition-all duration-200"
                />
                <span className="relative z-10 w-4 h-4 rounded-full bg-gradient-to-tr from-[#FF2D55] to-[#F59E0B] text-white flex items-center justify-center shrink-0 shadow">
                  <ArrowUp className="w-2.5 h-2.5" strokeWidth={3} />
                </span>
                <span className="relative z-10 text-[11px] font-mono-num font-bold text-white flex items-center gap-1">
                  <Heart className="w-3 h-3 text-[#FF2D55] fill-current" />
                  <span>{formatCompact(displayedLikes)}</span>
                </span>
                {tapLevel > 1 && (
                  <span className="relative z-10 ms-auto px-1.5 py-0.2 rounded-full bg-[#F59E0B]/25 border border-[#FBBF24]/45 text-[9.5px] font-mono-num font-bold text-[#FDE68A]">
                    x{tapLevel}
                  </span>
                )}
              </motion.div>
            </div>
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

        {/* Active Pinned Comment (Only pinned by the broadcast Host) */}
        {roomState?.activeHighlight && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute bottom-[295px] start-4 end-16 z-20 px-3 py-2 rounded-2xl bg-black/72 backdrop-blur-md border border-white/20 flex items-center gap-2"
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

        {/* Full-History Scrollable Live Comments (Swipe-isolated via swiper-no-swiping — Scroll Up Freely!) */}
        <div
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          className="swiper-no-swiping absolute bottom-[80px] start-4 z-20 w-[78%] max-w-[360px]"
        >
          <div
            ref={commentsScrollRef}
            onScroll={handleCommentsScroll}
            className="live-comments-scroll max-h-[205px] overflow-y-auto overscroll-contain touch-pan-y no-scrollbar space-y-1.5 py-2"
          >
            {(roomState?.recentMessages || []).map(msg => (
              <div
                key={msg.id}
                className="flex items-start gap-2 text-[13px] leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(msg.userId)}
                  className="font-semibold text-white/85 hover:text-white hover:underline shrink-0 cursor-pointer"
                >
                  {msg.displayName}
                </button>
                <span className="text-white break-words">{msg.text}</span>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>

          {scrolledUpComments && (
            <button
              type="button"
              onClick={jumpToLatestComments}
              className="mt-1 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-[10.5px] font-medium text-white inline-flex items-center gap-1 cursor-pointer hover:bg-white hover:text-black transition-colors"
            >
              <ArrowDown className="w-3 h-3" />
              <span>أحدث التعليقات</span>
            </button>
          )}
        </div>

        {/* Floating Side Action Buttons (ZERO Heart Button, Host-Only Pin, Share & Report!) */}
        <div onClick={e => e.stopPropagation()} className="absolute bottom-[82px] end-3.5 z-20 flex flex-col items-center gap-3">
          {isOwnerOfActiveRoom && (
            <button
              type="button"
              onClick={() => setPinMode(v => !v)}
              title="تثبيت تعليق (لصاحب البث فقط)"
              className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center cursor-pointer transition-colors ${
                pinMode ? 'bg-white text-black border-white' : 'bg-black/55 border-white/[0.14] text-white'
              }`}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}

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
            title="مشاركة البث"
            className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.14] text-white flex items-center justify-center cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {activeRoom && (
            <button
              type="button"
              onClick={() =>
                setReportRequest({
                  targetType: 'live',
                  targetId: activeRoom.id,
                  label: 'هذا البث المباشر',
                })
              }
              title="إبلاغ عن محتوى حساس"
              className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.14] text-white/85 hover:text-[#FB7185] flex items-center justify-center cursor-pointer transition-colors"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
        </div>

        {statusMsg && (
          <div className="absolute bottom-24 inset-x-8 z-30 py-1.5 px-3 rounded-full bg-black/85 border border-white/15 text-center text-xs text-white">
            {statusMsg}
          </div>
        )}

        {/* Bottom Floating Composer + Split Orb */}
        {!mobileNavExpanded && (
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
                placeholder={pinMode && isOwnerOfActiveRoom ? 'تعليق مثبت...' : lang === 'ar' ? 'أضف تعليقًا...' : 'Add comment...'}
                disabled={!commentText.trim()}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2026 Go Live Studio Modal — Create Custom Live Broadcast Room */}
      <AnimatePresence>
        {goLiveOpen && (
          <StudioModalOverlay onClose={() => setGoLiveOpen(false)}>
            <form onSubmit={startCustomLiveBroadcast} className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                  <span className="w-8 h-8 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-[#EF4444] flex items-center justify-center">
                    <Radio className="w-4 h-4" />
                  </span>
                  <span>إنشاء بث مباشر جديد</span>
                </div>
                <CloseOrbButton onClick={() => setGoLiveOpen(false)} />
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
                سيتم بث الكاميرا والميكروفون مباشرة لأي مستخدم ينضم لغرفتك عبر WebRTC لحظيًا، ويمكنك تثبيت التعليقات وإنهاء البث في أي وقت.
              </p>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setGoLiveOpen(false)}
                  className="h-9 px-4 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs text-[#C4C4CC] hover:text-white cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <PublishActionButton
                  type="submit"
                  variant="live"
                  loading={startingLive}
                  disabled={!goLiveTitle.trim()}
                  label="بدء البث الآن"
                  loadingLabel="جارٍ التشغيل..."
                  icon={<Radio className="w-3.5 h-3.5" />}
                />
              </div>
            </form>
          </StudioModalOverlay>
        )}
      </AnimatePresence>

      {/* Universal Sensitive Content Reporting Modal */}
      <ReportContentModal
        request={reportRequest}
        reporterId={user.id}
        onClose={() => setReportRequest(null)}
        onReported={res => {
          if (res.targetType === 'live') {
            setRooms(prev =>
              prev.map(r =>
                r.id === res.targetId
                  ? { ...r, reportsCount: res.reportsCount, isSensitive: res.isSensitive }
                  : r
              )
            );
          }
        }}
      />
    </div>
  );
}
