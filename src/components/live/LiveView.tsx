import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Keyboard } from 'swiper/modules';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  Flag,
  Heart,
  Monitor,
  Volume2,
  VolumeX,
  Pin,
  Radio,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { Lang, LiveRoomItem, LiveRoomState, UserProfile } from '../../types';
import { UserAvatar } from '../shared/LmBrandMark';
import type { SharePayload } from '../shared/ShareSheetModal';
import { ObsidianComposerPill } from '../shared/HardwareUI';
import { SplitComposerOrb } from '../layout/AppShell';
import { useLayout } from '../../context/LayoutContext';
import { TapBurstItem, TapBurstOverlay, createTapBurst } from '../shared/TapComboBurst';
import { ReportContentModal, ReportRequest, SensitiveMediaShield } from '../shared/SensitiveShield';
import { api, apiGet, apiPost } from '../../lib/api';
import { RTC_CONFIG, sendWsSignal, subscribeWs } from '../../lib/wsHub';
import { t } from '../../lib/i18n';

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
  const roomStateCacheRef = useRef<Record<string, LiveRoomState>>({});
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
  const [muted, setMuted] = useState(false);
  const [liveInputFocused, setLiveInputFocused] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // TikTok Live Tap-to-Like Energy Gauge State (Gradual 50-tap fill, ZERO x2/x6 multiplier badges!)
  const [tapProgress, setTapProgress] = useState(0);
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

  // Full-Screen TikTok-Style Go Live Studio State (Camera fills 100% of screen + floating controls!)
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [goLiveTitle, setGoLiveTitle] = useState('');
  const [goLiveCategory, setGoLiveCategory] = useState('دردشة');
  const [goLiveOrientation, setGoLiveOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [goLiveFacing, setGoLiveFacing] = useState<'user' | 'environment'>('user');
  const [goLiveFilter, setGoLiveFilter] = useState<'none' | 'warm' | 'crisp'>('none');
  const [goLiveSettingsOpen, setGoLiveSettingsOpen] = useState(false);
  const [goLiveAllowComments, setGoLiveAllowComments] = useState(true);
  const [goLiveSlowMode, setGoLiveSlowMode] = useState(false);
  const [goLiveAudience, setGoLiveAudience] = useState<'everyone' | 'followers'>('everyone');
  const [startingLive, setStartingLive] = useState(false);
  const [hostingRoomId, setHostingRoomId] = useState<string | null>(null);
  const [livePeerCount, setLivePeerCount] = useState(0);
  const studioPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const studioPreviewStreamRef = useRef<MediaStream | null>(null);

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
    roomStateCacheRef.current[id] = res.state;
    setRoomState(prev => {
      // Avoid overwriting if user already swiped away to another room while this request was in flight
      if (prev && prev.roomId !== id && activeRoomId !== id) return prev;
      return res.state;
    });
    setOptimisticLikes(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [activeRoomId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (activeRoomId) {
      setPinMode(false);
      userScrolledUpRef.current = false;
      setScrolledUpComments(false);
      // Instant zero-lag switch: show cached room state at 0ms OR clear stale previous room comments immediately!
      const cached = roomStateCacheRef.current[activeRoomId];
      setRoomState(cached || null);
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

  // Play only the active slide's background video cleanly (Audio ON by default with safe autoplay fallback!)
  useEffect(() => {
    Object.entries(slideVideoRefs.current).forEach(([rid, el]) => {
      if (!el) return;
      if (rid === activeRoomId) {
        el.muted = muted;
        const playPromise = el.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            if (!muted) {
              el.muted = true;
              setMuted(true);
              el.play().catch(() => {});
            }
          });
        }
      } else {
        el.pause();
      }
    });
  }, [activeRoomId, rooms.length, muted]);

  // Live Camera Preview inside Full-Screen Go Live Broadcast Studio!
  useEffect(() => {
    if (!goLiveOpen) {
      studioPreviewStreamRef.current?.getTracks().forEach(tr => tr.stop());
      studioPreviewStreamRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      studioPreviewStreamRef.current?.getTracks().forEach(tr => tr.stop());
      studioPreviewStreamRef.current = null;
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video:
            goLiveOrientation === 'landscape'
              ? { facingMode: goLiveFacing, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { facingMode: goLiveFacing, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach(tr => tr.stop());
          return;
        }
        studioPreviewStreamRef.current = s;
        if (studioPreviewVideoRef.current) studioPreviewVideoRef.current.srcObject = s;
      } catch {
        // camera unavailable
      }
    })();
    return () => {
      cancelled = true;
      studioPreviewStreamRef.current?.getTracks().forEach(tr => tr.stop());
      studioPreviewStreamRef.current = null;
    };
  }, [goLiveOpen, goLiveOrientation, goLiveFacing]);

  useEffect(() => {
    if (!lastWsEvent) return;
    if (lastWsEvent.event === 'live:state') {
      const st = lastWsEvent.payload as LiveRoomState;
      roomStateCacheRef.current[st.roomId] = st;
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
    studioPreviewStreamRef.current?.getTracks().forEach(tr => tr.stop());
    studioPreviewStreamRef.current = null;
    try {
      let stream: MediaStream | null = null;
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video:
              goLiveOrientation === 'landscape'
                ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
                : { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
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
        orientation: goLiveOrientation,
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
      showNotice(
        stream
          ? lang === 'en'
            ? 'You are LIVE!'
            : 'أنت الآن على البث المباشر!'
          : lang === 'en'
            ? 'Live room opened (camera unavailable)'
            : 'تم فتح غرفة البث (الكاميرا غير متاحة على هذا الجهاز)'
      );
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'تعذر بدء البث المباشر');
    } finally {
      setStartingLive(false);
    }
  }

  /**
   * TikTok Live Tap-to-Like Engine:
   * Every tap spawns a burst, sends a glowing heart orb flying up into the top Arrow Energy Gauge,
   * fills the gauge gradually (~50 taps per cycle, ZERO x2/x6 multipliers!), and boosts live ranking!
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

    // Gradual TikTok Arrow Energy Gauge (50 taps = full cycle, NO x2/x3 multipliers!)
    setTapProgress(prev => {
      const next = prev + 100 / 50;
      if (next >= 100) return 6;
      return next;
    });
    setGaugePulse(true);
    setTimeout(() => setGaugePulse(false), 240);

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
            const isLandscape = room.orientation === 'landscape';

            const mediaNode = isHostingThis ? (
              camStreamRef.current ? (
                <video
                  ref={camVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full scale-x-[-1] ${isLandscape ? 'object-contain bg-black' : 'object-cover'}`}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-[#1A0D0E] via-[#0A0A0D] to-black flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={86} online />
                  <div className="text-sm font-bold text-white">{room.title}</div>
                  <div className="text-xs text-[#FB7185]">
                    {lang === 'en' ? 'Interactive Live Room' : 'غرفة بث صوتي/تفاعلي مباشر'}
                  </div>
                </div>
              )
            ) : isCurrent && viewerConnected ? (
              <video
                ref={remoteLiveVideoRef}
                autoPlay
                playsInline
                muted={muted}
                className={`w-full h-full ${isLandscape ? 'object-contain bg-black' : 'object-cover'}`}
              />
            ) : room.videoUrl ? (
              isCurrent ? (
                <video
                  ref={el => {
                    slideVideoRefs.current[room.id] = el;
                  }}
                  src={room.videoUrl}
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                  muted={muted}
                  className={`w-full h-full ${isLandscape ? 'object-cover bg-black' : 'object-cover'}`}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-[#140D12] via-[#0A0A0E] to-black flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <UserAvatar initials={room.hostInitials} avatarUrl={room.hostAvatarUrl} size={76} online />
                  <div className="text-sm font-bold text-white">{room.title}</div>
                </div>
              )
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-[#170E11] via-[#0B0B0F] to-black flex flex-col items-center justify-center gap-3 px-6 text-center">
                <UserAvatar
                  initials={room.hostInitials}
                  avatarUrl={room.hostAvatarUrl}
                  size={84}
                  online
                />
                <div className="text-sm font-bold text-white">{room.title || (lang === 'en' ? 'Live' : 'بث مباشر')}</div>
                <div className="text-xs text-[#9E9EA8]">
                  {isCurrent && viewerConnecting
                    ? lang === 'en'
                      ? 'Connecting to host stream...'
                      : 'جارٍ الاتصال بكاميرا المذيع عبر WebRTC...'
                    : lang === 'en'
                      ? 'Waiting for host broadcast'
                      : 'بانتظار بث الفيديو من المذيع'}
                </div>
              </div>
            );

            return (
              <SwiperSlide key={room.id} className="w-full h-full relative bg-black">
                {isLandscape ? (
                  /* Sleek Rounded Landscape (16:9) Live Theater Frame — Softly Curved Side Edges, Clear of Top HUD & Bottom Comments! */
                  <div
                    style={{
                      paddingTop: 'max(106px, calc(env(safe-area-inset-top) + 98px))',
                      paddingBottom: 'max(220px, calc(env(safe-area-inset-bottom) + 210px))',
                    }}
                    className="w-full h-full bg-[#060608] flex flex-col items-center justify-center px-3 sm:px-4"
                  >
                    <div className="relative w-full aspect-video bg-black rounded-[28px] sm:rounded-[32px] border border-white/[0.14] overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.85)]">
                      {mediaNode}
                      <span className="pointer-events-none absolute top-2.5 end-3 px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-[9.5px] font-mono-num text-white/85">
                        16:9
                      </span>
                    </div>
                  </div>
                ) : (
                  mediaNode
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

        {/* Top Floating Host Pill + TikTok Tap-to-Like Rising Arrow Energy Gauge Below It (Safe-Area Protected!) */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ top: 'max(12px, calc(env(safe-area-inset-top) + 8px))' }}
          className="absolute inset-x-3 sm:inset-x-4 z-20 flex items-start justify-between gap-1.5 sm:gap-2"
        >
          {activeRoom && (
            <div className="flex flex-col items-start gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => onOpenProfile?.(activeRoom.hostId)}
                className="flex items-center gap-1.5 sm:gap-2 ps-1 pe-2.5 sm:pe-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12] hover:border-white/30 cursor-pointer text-start transition-colors min-w-0 max-w-full"
              >
                <div
                  className={
                    activeRoom.hasActiveStory
                      ? 'p-[1.5px] rounded-full bg-gradient-to-tr from-[#F59E0B] via-[#FB7185] to-[#FF2D55] shrink-0'
                      : 'shrink-0'
                  }
                >
                  <div className={activeRoom.hasActiveStory ? 'p-[1px] rounded-full bg-black' : ''}>
                    <UserAvatar initials={activeRoom.hostInitials} avatarUrl={activeRoom.hostAvatarUrl} size={30} online />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11.5px] sm:text-xs font-semibold text-white truncate max-w-[88px] sm:max-w-[115px]">{activeRoom.hostName}</div>
                  <div className="text-[10px] text-white/70 truncate max-w-[88px] sm:max-w-[115px]">{activeRoom.title}</div>
                </div>
                <span className="ms-0.5 sm:ms-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-gradient-to-tr from-[#EF4444] to-[#F97316] text-white text-[9.5px] sm:text-[10px] font-bold shrink-0">
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
                title={t(lang, 'end_live')}
                className="h-8 px-3 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>{t(lang, 'end_live')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setGoLiveOpen(true)}
                title={t(lang, 'go_live')}
                className="h-8 px-3 rounded-full bg-gradient-to-tr from-[#EF4444] to-[#F97316] text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-lg hover:opacity-95 transition-opacity"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{t(lang, 'go_live')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Pinned Comment (Strictly matched to active room — ZERO stale flash on swipe!) */}
        {roomState && roomState.roomId === activeRoom?.id && roomState.activeHighlight && (
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

        {/* Full-History Scrollable Live Comments (Swipe-isolated via swiper-no-swiping — Safe-Area Lifted!) */}
        <div
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          style={{ bottom: 'calc(76px + env(safe-area-inset-bottom))' }}
          className="swiper-no-swiping absolute start-3.5 sm:start-4 z-20 w-[76%] max-w-[350px]"
        >
          <div
            ref={commentsScrollRef}
            onScroll={handleCommentsScroll}
            className="live-comments-scroll max-h-[205px] overflow-y-auto overscroll-contain touch-pan-y no-scrollbar space-y-1.5 py-2"
          >
            {(roomState && roomState.roomId === activeRoom?.id ? roomState.recentMessages : []).map(msg => (
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

        {/* Floating Side Action Buttons (Safe-Area Lifted — ZERO Heart Button, Host-Only Pin, Share & Report!) */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ bottom: 'calc(78px + env(safe-area-inset-bottom))' }}
          className="absolute end-3.5 z-20 flex flex-col items-center gap-3"
        >
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

          {activeRoom && activeRoom.hostId !== user.id && (
            <button
              type="button"
              onClick={() =>
                setReportRequest({
                  targetType: 'live',
                  targetId: activeRoom.id,
                  label: lang === 'en' ? 'this live broadcast' : 'هذا البث المباشر',
                })
              }
              title={t(lang, 'report')}
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

        {/* Transparent TikTok Bottom Comment Bar & Direct Bottom Dock Trigger (Lifts ONLY composer above keyboard!) */}
        {!mobileNavExpanded && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ bottom: 'calc(max(14px, env(safe-area-inset-bottom) + 10px) + var(--lm-kb-offset, 0px))' }}
            className="absolute inset-x-3.5 z-20 flex items-end gap-2 transition-[bottom] duration-150"
          >
            <SplitComposerOrb
              directDockMode
              transparent={!liveInputFocused && !commentText.trim()}
            />
            <div className="flex-1 min-w-0">
              <ObsidianComposerPill
                transparent
                value={commentText}
                onChange={setCommentText}
                onSubmit={handleSendComment}
                onFocus={() => {
                  setLiveInputFocused(true);
                  setComposerFocused(true);
                }}
                onBlur={() => {
                  setLiveInputFocused(false);
                  setTimeout(() => setComposerFocused(false), 140);
                }}
                placeholder={
                  pinMode && isOwnerOfActiveRoom
                    ? lang === 'en'
                      ? 'Pinned comment...'
                      : 'تعليق مثبت...'
                    : t(lang, 'add_comment')
                }
                disabled={!commentText.trim()}
              />
            </div>
          </div>
        )}
      </div>

      {/* FULL-SCREEN TIKTOK-STYLE LIVE CAMERA STUDIO — Camera fills 100% of screen, ZERO box containers, floating title/category/settings! */}
      <AnimatePresence>
        {goLiveOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[72] h-[100dvh] w-full bg-black text-white overflow-hidden select-none"
          >
            {/* 100% Full-Screen Live Camera Feed Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#17121E] via-[#0B0B10] to-black">
              <video
                ref={studioPreviewVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  filter:
                    goLiveFilter === 'warm'
                      ? 'contrast(1.06) saturate(1.18) brightness(1.04)'
                      : goLiveFilter === 'crisp'
                        ? 'contrast(1.12) brightness(1.05)'
                        : 'none',
                }}
                className={`w-full h-full ${goLiveOrientation === 'landscape' ? 'object-contain bg-black' : 'object-cover'} ${
                  goLiveFacing === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />
              {/* Soft Top & Bottom Legibility Vignettes Over Camera */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-black/70 via-black/25 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/82 via-black/30 to-transparent" />
            </div>

            <form
              onSubmit={startCustomLiveBroadcast}
              className="relative z-10 h-full w-full max-w-[560px] mx-auto flex flex-col justify-between px-4"
              style={{
                paddingTop: 'max(14px, calc(env(safe-area-inset-top) + 10px))',
                paddingBottom: 'calc(max(22px, env(safe-area-inset-bottom) + 16px) + var(--lm-kb-offset, 0px))',
              }}
            >
              {/* TOP FLOATING ZONE: Back Arrow + Floating Title (No Box!) + Floating Category Chips */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGoLiveSettingsOpen(false);
                      setGoLiveOpen(false);
                    }}
                    aria-label={t(lang, 'back')}
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/65 backdrop-blur-md text-white flex items-center justify-center cursor-pointer transition-colors"
                  >
                    {lang === 'en' ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                  </button>

                  <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-[11px] font-mono-num text-white/90 inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                    <span>{goLiveOrientation === 'landscape' ? '16:9 · عرضي' : '9:16 · طولي'}</span>
                  </span>
                </div>

                {/* Floating Gray-Tinted Translucent Title Input Directly Over Camera (NO Heavy Card Container!) */}
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#26262C]/55 backdrop-blur-md">
                  <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={36} />
                  <input
                    value={goLiveTitle}
                    onChange={e => setGoLiveTitle(e.target.value)}
                    placeholder={lang === 'en' ? 'Add a broadcast title...' : 'اكتب عنوان البث هنا...'}
                    className="flex-1 min-w-0 bg-transparent text-sm font-medium text-white placeholder:text-white/75 outline-none"
                  />
                </div>

                {/* Floating Category Pills Directly Over Camera (NO Outer Container!) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {LIVE_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setGoLiveCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-full text-xs shrink-0 backdrop-blur-md cursor-pointer transition-all ${
                        goLiveCategory === cat
                          ? 'bg-white text-black font-bold shadow-md'
                          : 'bg-[#26262C]/50 text-white/90 hover:bg-black/60'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* RIGHT FLOATING TIKTOK-STYLE STUDIO CONTROLS (Flip, Orientation, Filter, Settings) */}
              <div className="absolute end-3.5 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={() => setGoLiveFacing(f => (f === 'user' ? 'environment' : 'user'))}
                  className="flex flex-col items-center gap-1 cursor-pointer group"
                >
                  <span className="w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-colors">
                    <RefreshCw className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-[10px] font-medium text-white drop-shadow">عكس</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGoLiveOrientation(o => (o === 'portrait' ? 'landscape' : 'portrait'))}
                  className="flex flex-col items-center gap-1 cursor-pointer"
                >
                  <span className="w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-colors">
                    {goLiveOrientation === 'landscape' ? (
                      <Monitor className="w-[18px] h-[18px] text-[#FBBF24]" />
                    ) : (
                      <Smartphone className="w-[18px] h-[18px]" />
                    )}
                  </span>
                  <span className="text-[10px] font-medium text-white drop-shadow">
                    {goLiveOrientation === 'landscape' ? 'عرضي' : 'طولي'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGoLiveFilter(f => (f === 'none' ? 'warm' : f === 'warm' ? 'crisp' : 'none'))}
                  className="flex flex-col items-center gap-1 cursor-pointer"
                >
                  <span
                    className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${
                      goLiveFilter !== 'none' ? 'bg-white text-black' : 'bg-black/45 hover:bg-black/70 text-white'
                    }`}
                  >
                    <Sparkles className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-[10px] font-medium text-white drop-shadow">
                    {goLiveFilter === 'warm' ? 'دافئ' : goLiveFilter === 'crisp' ? 'واضح' : 'تحسين'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGoLiveSettingsOpen(true)}
                  className="flex flex-col items-center gap-1 cursor-pointer"
                >
                  <span className="w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-colors">
                    <SlidersHorizontal className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-[10px] font-medium text-white drop-shadow">الإعدادات</span>
                </button>
              </div>

              {/* BOTTOM FLOATING START BROADCAST BUTTON */}
              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={startingLive || !goLiveTitle.trim()}
                  className="w-full max-w-[280px] h-12 rounded-full bg-gradient-to-r from-[#FF2D55] to-[#F97316] hover:opacity-95 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-[0_12px_36px_rgba(255,45,85,0.45)] disabled:opacity-45 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  <Radio className="w-4 h-4" />
                  <span>
                    {startingLive
                      ? lang === 'en'
                        ? 'Going Live...'
                        : 'جارٍ بدء البث...'
                      : lang === 'en'
                        ? 'Go LIVE'
                        : 'ابدأ البث المباشر'}
                  </span>
                </button>
              </div>
            </form>

            {/* TikTok-Style Live Settings Bottom Sheet (Comments, Slow Mode, Audience) */}
            <AnimatePresence>
              {goLiveSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setGoLiveSettingsOpen(false)}
                  className="fixed inset-0 z-30 bg-black/55 flex items-end justify-center"
                >
                  <motion.div
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 40, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={e => e.stopPropagation()}
                    style={{ paddingBottom: 'max(22px, calc(env(safe-area-inset-bottom) + 14px))' }}
                    className="w-full max-w-[520px] rounded-t-[26px] bg-[#13131A]/96 backdrop-blur-2xl border-t border-white/[0.12] px-5 pt-3 space-y-4"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                      <span className="text-sm font-bold text-white">إعدادات البث</span>
                      <button
                        type="button"
                        onClick={() => setGoLiveSettingsOpen(false)}
                        className="w-8 h-8 rounded-full bg-white/[0.08] text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <div className="font-semibold text-white">السماح بالتعليقات</div>
                          <div className="text-[11px] text-[#8E8E93]">تمكين المشاهدين من الكتابة أثناء البث</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGoLiveAllowComments(v => !v)}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                            goLiveAllowComments ? 'bg-[#34D399]' : 'bg-white/15'
                          }`}
                        >
                          <span
                            className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                              goLiveAllowComments ? '-translate-x-5 rtl:-translate-x-5 ltr:translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <div>
                          <div className="font-semibold text-white">تهدئة التعليقات (Slow Mode)</div>
                          <div className="text-[11px] text-[#8E8E93]">منع تكرار التعليقات السريعة أثناء البث</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGoLiveSlowMode(v => !v)}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                            goLiveSlowMode ? 'bg-[#34D399]' : 'bg-white/15'
                          }`}
                        >
                          <span
                            className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                              goLiveSlowMode ? '-translate-x-5 rtl:-translate-x-5 ltr:translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <div>
                          <div className="font-semibold text-white">من يمكنه المشاهدة</div>
                          <div className="text-[11px] text-[#8E8E93]">اختر جمهور البث المباشر</div>
                        </div>
                        <div className="inline-flex rounded-full bg-white/[0.07] p-0.5">
                          <button
                            type="button"
                            onClick={() => setGoLiveAudience('everyone')}
                            className={`px-3 py-1 rounded-full text-[11px] cursor-pointer ${
                              goLiveAudience === 'everyone' ? 'bg-white text-black font-semibold' : 'text-[#A1A1AA]'
                            }`}
                          >
                            الجميع
                          </button>
                          <button
                            type="button"
                            onClick={() => setGoLiveAudience('followers')}
                            className={`px-3 py-1 rounded-full text-[11px] cursor-pointer ${
                              goLiveAudience === 'followers' ? 'bg-white text-black font-semibold' : 'text-[#A1A1AA]'
                            }`}
                          >
                            المتابعون
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Universal Discreet Content Reporting Sheet/Modal */}
      <ReportContentModal
        request={reportRequest}
        reporterId={user.id}
        lang={lang}
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
