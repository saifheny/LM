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
  BarChart3,
  Check,
  Clock,
  CornerDownLeft,
  Eye,
  Heart,
  MessageCircle,
  Mic,
  MicOff,
  Monitor,
  Pin,
  Plus,
  Radio,
  RefreshCw,
  Share2,
  ShieldBan,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { Lang, LiveChatMessage, LiveRoomItem, LiveRoomState, UserProfile } from '../../types';
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

const LIVE_CATEGORIES = ['عام', 'دردشة', 'تقنية', 'موسيقى', 'ألعاب', 'رياضة'];

/**
 * Real-Time Audio-Reactive Avatar Stage for Camera-Off / Voice-Only Live Broadcasts!
 * Reads live microphone (or WebRTC remote audio) FFT frequencies via Web Audio API AnalyserNode
 * so concentric rings + 12 vocal frequency bars pulse dynamically whenever the host speaks!
 */
function LiveVoiceAvatarStage({
  avatarUrl,
  initials,
  hostName,
  title,
  stream,
  micMuted,
}: {
  avatarUrl: string | null;
  initials: string;
  hostName: string;
  title: string;
  stream: MediaStream | null;
  micMuted: boolean;
}) {
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(12).fill(6));

  useEffect(() => {
    if (!stream || micMuted || stream.getAudioTracks().length === 0) {
      setVoiceLevel(0);
      setBars(Array(12).fill(6));
      return;
    }

    let rafId = 0;
    let audioCtx: AudioContext | null = null;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.76;
      source.connect(analyser);
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(freqData);
        let sum = 0;
        const nextBars: number[] = [];
        for (let i = 0; i < 12; i++) {
          const binIdx = Math.min(freqData.length - 1, i + 1);
          const v = freqData[binIdx] / 255;
          sum += v;
          nextBars.push(Math.round(6 + v * 36));
        }
        const avg = Math.min(1, (sum / 12) * 1.45);
        setVoiceLevel(avg);
        setBars(nextBars);
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    } catch {
      // ignore if AudioContext restricted
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      audioCtx?.close().catch(() => {});
    };
  }, [stream, micMuted]);

  return (
    <div className="w-full h-full bg-gradient-to-b from-[#171923] via-[#121216] to-[#0B0B0E] flex flex-col items-center justify-center gap-5 px-6 text-center select-none">
      {/* Audio-Reactive Concentric Rings + Host Profile Picture */}
      <div className="relative flex items-center justify-center w-48 h-48">
        <span
          style={{
            transform: `scale(${1 + voiceLevel * 0.55})`,
            opacity: micMuted ? 0.08 : 0.14 + voiceLevel * 0.42,
          }}
          className="pointer-events-none absolute w-32 h-32 rounded-full bg-[#FE2C55] transition-transform duration-75"
        />
        <span
          style={{
            transform: `scale(${1 + voiceLevel * 0.34})`,
            opacity: micMuted ? 0.12 : 0.2 + voiceLevel * 0.5,
          }}
          className="pointer-events-none absolute w-32 h-32 rounded-full border-2 border-[#25F4EE] transition-transform duration-75"
        />
        <div className="relative z-10 p-1 rounded-full bg-[#121216] border-2 border-white/20">
          <UserAvatar initials={initials} avatarUrl={avatarUrl} size={112} />
        </div>
        {micMuted && (
          <span className="absolute bottom-3 end-5 z-20 w-9 h-9 rounded-full bg-[#EF4444] border-2 border-[#121216] text-white flex items-center justify-center">
            <MicOff className="w-4 h-4" />
          </span>
        )}
      </div>

      {/* Host Identity + Live Status */}
      <div className="space-y-1 max-w-xs">
        <div className="text-base font-bold text-white truncate">{hostName}</div>
        <div className="text-xs text-[#9E9EA8] line-clamp-1">{title}</div>
      </div>

      {/* Live Vocal Frequency Waveform Equalizer (12 Real-Time Spectrum Bars) */}
      <div className="h-11 flex items-center justify-center gap-1.5 px-4">
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${micMuted ? 5 : h}px` }}
            className={`w-1.5 rounded-full transition-[height] duration-75 ${
              micMuted
                ? 'bg-white/20'
                : i % 2 === 0
                  ? 'bg-[#25F4EE]'
                  : 'bg-[#FE2C55]'
            }`}
          />
        ))}
      </div>

      <div className="px-3.5 py-1 rounded-full bg-white/[0.06] text-[11.5px] font-semibold text-[#D4D4D8] inline-flex items-center gap-1.5">
        {micMuted ? (
          <>
            <MicOff className="w-3.5 h-3.5 text-[#FF595A]" />
            <span>الميكروفون مكتوم · الكاميرا مغلقة</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-[#25F4EE]" />
            <span>بث صوتي مباشر · الكاميرا مغلقة</span>
          </>
        )}
      </div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.max(0, Math.floor(n)));
}

function formatLiveDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

interface LivePollPublic {
  id: string;
  roomId: string;
  question: string;
  totalVotes: number;
  myVote: string | null;
  options: Array<{ id: string; text: string; votes: number; percent: number }>;
  createdAt: number;
}

interface PostLiveSummary {
  title: string;
  durationSec: number;
  peakViewers: number;
  likesCount: number;
  commentsCount: number;
}

export function LiveView({ user, lang, lastWsEvent, onOpenProfile, onShare }: LiveViewProps) {
  const { setComposerFocused, mobileNavExpanded, setMobileNavExpanded } = useLayout();
  const [rooms, setRooms] = useState<LiveRoomItem[]>([]);
  const [activeRoomId, setActiveRoomIdState] = useState<string>(() => {
    try {
      const focusId = localStorage.getItem('lm_live_focus_room_id');
      if (focusId) {
        localStorage.removeItem('lm_live_focus_room_id');
        return focusId;
      }
    } catch {
      // ignore
    }
    return '';
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

  // TikTok Clear-Display Mode (2-finger horizontal swipe hides ALL HUD & comments!)
  const [cleanView, setCleanView] = useState(false);
  const twoFingerSwipeRef = useRef<{ startX: number; startY: number; triggered: boolean } | null>(null);

  // TikTok-Style Highlighted Reply to a Specific Live Comment
  const [replyToLiveComment, setReplyToLiveComment] = useState<{
    id: string;
    userId?: string;
    displayName: string;
    text: string;
  } | null>(null);
  const activeRoomIdRef = useRef(activeRoomId);
  activeRoomIdRef.current = activeRoomId;

  // Lightweight Tap-to-Like Energy Gauge State (CSS transitions only — zero GPU stutter!)
  const [tapProgress, setTapProgress] = useState(0);
  const [gaugePulse, setGaugePulse] = useState(false);
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
  // Host Real-Time Broadcast Super-Controls (Mic Mute, Camera Off, Flip Camera, Comment Delete, Block User, Control Panel)
  const [hostMicMuted, setHostMicMuted] = useState(false);
  const [hostCamOff, setHostCamOff] = useState(false);
  const [hostFacing, setHostFacing] = useState<'user' | 'environment'>('user');
  const [hostControlsOpen, setHostControlsOpen] = useState(false);
  const [hostModerateMsg, setHostModerateMsg] = useState<LiveChatMessage | null>(null);
  const [blockedUsersList, setBlockedUsersList] = useState<
    Array<{ id: string; username: string; displayName: string; avatarInitials: string; avatarUrl: string | null }>
  >([]);

  const [startingLive, setStartingLive] = useState(false);
  const [hostingRoomId, setHostingRoomId] = useState<string | null>(null);
  const [livePeerCount, setLivePeerCount] = useState(0);

  // Phase 2B: Interactive Live Polls + Live Timer + Post-Live Summary Screen
  const [livePoll, setLivePoll] = useState<LivePollPublic | null>(null);
  const [myPollVotes, setMyPollVotes] = useState<Record<string, string>>({});
  const [pollCreatorOpen, setPollCreatorOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [liveSummary, setLiveSummary] = useState<PostLiveSummary | null>(null);
  const [liveElapsedSec, setLiveElapsedSec] = useState(0);
  const broadcastStartedAtRef = useRef<number>(0);
  const broadcastTitleRef = useRef<string>('');
  const peakViewersRef = useRef<number>(1);

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
      const currentId = activeRoomIdRef.current;
      const idx = list.findIndex(r => r.id === currentId);
      if (idx >= 0) {
        setActiveIndex(idx);
      } else {
        setActiveIndex(0);
        setActiveRoomId(list[0].id);
      }
    }
  }, [user.id, setActiveRoomId]);

  const loadState = useCallback(async (id: string) => {
    try {
      const res = await apiGet<{ ok: boolean; state: LiveRoomState }>(`/api/live/rooms/${id}/state?userId=${encodeURIComponent(user.id)}`);
      roomStateCacheRef.current[id] = res.state;
      setRoomState(prev => {
        if (prev && prev.roomId !== id && activeRoomIdRef.current !== id) return prev;
        return res.state;
      });
      setOptimisticLikes(prev => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      // room may be unavailable or blocked
    }
  }, [user.id]);

  const loadPoll = useCallback(async (id: string) => {
    try {
      const res = await apiGet<{ ok: boolean; poll: LivePollPublic | null }>(`/api/live/rooms/${id}/poll?userId=${encodeURIComponent(user.id)}`);
      if (activeRoomIdRef.current !== id) return;
      setLivePoll(res.poll || null);
      if (res.poll?.myVote) {
        setMyPollVotes(prev => ({ ...prev, [res.poll!.id]: res.poll!.myVote! }));
      }
    } catch {
      // ignore
    }
  }, [user.id]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (activeRoomId) {
      setPinMode(false);
      setReplyToLiveComment(null);
      userScrolledUpRef.current = false;
      setScrolledUpComments(false);
      // Instant zero-lag switch: show cached room state at 0ms OR clear stale previous room comments immediately!
      const cached = roomStateCacheRef.current[activeRoomId];
      setRoomState(cached || null);
      setLivePoll(null);
      loadState(activeRoomId);
      loadPoll(activeRoomId);
    }
  }, [activeRoomId, loadState, loadPoll]);

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
          video: { facingMode: goLiveFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
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
    if (lastWsEvent.event === 'live:poll') {
      const p = lastWsEvent.payload as { roomId?: string; poll?: LivePollPublic | null };
      if (p?.roomId === activeRoomId) {
        setLivePoll(p.poll || null);
      }
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
    if (lastWsEvent.event === 'live:user_blocked') {
      const p = lastWsEvent.payload as { hostId?: string; blockedUserId?: string; roomId?: string };
      if (p?.blockedUserId === user.id) {
        teardownViewerRtc();
        showNotice('لم يعد هذا البث متاحًا لك');
        loadRooms();
      }
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

  // Live elapsed broadcast timer while hosting
  useEffect(() => {
    if (!hostingRoomId) {
      setLiveElapsedSec(0);
      return;
    }
    const tick = () => {
      if (broadcastStartedAtRef.current > 0) {
        setLiveElapsedSec(Math.max(0, Math.floor((Date.now() - broadcastStartedAtRef.current) / 1000)));
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [hostingRoomId]);

  const stopHostingBroadcast = useCallback(
    async (notifyApi = true) => {
      const rid = hostingRoomId;
      const elapsedSec = broadcastStartedAtRef.current > 0 ? Math.max(1, Math.floor((Date.now() - broadcastStartedAtRef.current) / 1000)) : liveElapsedSec;
      const roomSnapshot = rooms.find(r => r.id === rid);
      const stateSnapshot = (rid && roomStateCacheRef.current[rid]) || (roomState?.roomId === rid ? roomState : null);
      const finalLikes = (stateSnapshot?.likesCount || roomSnapshot?.likesCount || 0) + (rid ? optimisticLikes[rid] || 0 : 0);
      const finalComments = stateSnapshot?.recentMessages?.length || 0;
      const finalTitle = broadcastTitleRef.current || roomSnapshot?.title || 'بث مباشر على LM';
      const finalPeak = Math.max(1, peakViewersRef.current, livePeerCount + 1, stateSnapshot?.viewersCount || 1);

      hostPeersRef.current.forEach(pc => pc.close());
      hostPeersRef.current.clear();
      setLivePeerCount(0);
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
      setHostingRoomId(null);
      setLivePoll(null);
      if (notifyApi && rid) {
        setLiveSummary({
          title: finalTitle,
          durationSec: elapsedSec,
          peakViewers: finalPeak,
          likesCount: finalLikes,
          commentsCount: finalComments,
        });
        try {
          await api(`/api/live/rooms/${rid}?hostId=${user.id}`, { method: 'DELETE' });
        } catch {
          // ignore
        }
        loadRooms();
      }
    },
    [hostingRoomId, user.id, loadRooms, liveElapsedSec, rooms, roomState, optimisticLikes, livePeerCount]
  );

  async function handleCreateLivePoll(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRoom?.id || creatingPoll) return;
    const cleanOpts = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleanOpts.length < 2) {
      showNotice('أدخل السؤال وخيارين على الأقل');
      return;
    }
    setCreatingPoll(true);
    try {
      const res = await apiPost<{ ok: boolean; poll: LivePollPublic }>(`/api/live/rooms/${activeRoom.id}/poll`, {
        hostId: user.id,
        question: pollQuestion.trim(),
        options: cleanOpts,
      });
      setLivePoll(res.poll);
      setPollCreatorOpen(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      showNotice('تم إطلاق الاستطلاع المباشر');
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'تعذر إنشاء الاستطلاع');
    } finally {
      setCreatingPoll(false);
    }
  }

  async function handleCloseLivePoll() {
    if (!activeRoom?.id) return;
    try {
      await apiPost(`/api/live/rooms/${activeRoom.id}/poll`, { hostId: user.id, close: true });
      setLivePoll(null);
      showNotice('تم إنهاء الاستطلاع');
    } catch {
      // ignore
    }
  }

  async function handleVoteLivePoll(optionId: string) {
    if (!activeRoom?.id || !livePoll) return;
    setMyPollVotes(prev => ({ ...prev, [livePoll.id]: optionId }));
    try {
      const res = await apiPost<{ ok: boolean; poll: LivePollPublic }>(`/api/live/rooms/${activeRoom.id}/poll-vote`, {
        userId: user.id,
        optionId,
      });
      if (res.poll) setLivePoll(res.poll);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'تعذر تسجيل صوتك');
    }
  }

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

  // Re-attach local camera video element when hosting OR when turning camera back ON!
  useEffect(() => {
    if (isHostingActiveRoom && !hostCamOff && camStreamRef.current && camVideoRef.current) {
      camVideoRef.current.srcObject = camStreamRef.current;
    }
  }, [isHostingActiveRoom, hostCamOff, activeIndex]);

  // Re-attach remote live video/audio element when viewer receives host stream OR host toggles camera!
  useEffect(() => {
    if (viewerConnected && remoteLiveStreamRef.current && remoteLiveVideoRef.current) {
      remoteLiveVideoRef.current.srcObject = remoteLiveStreamRef.current;
    }
  }, [viewerConnected, activeIndex, roomState?.hostCamOff]);

  const loadBlockedUsers = useCallback(async () => {
    try {
      const res = await apiGet<{
        ok: boolean;
        blockedUsers: Array<{ id: string; username: string; displayName: string; avatarInitials: string; avatarUrl: string | null }>;
      }>(`/api/users/${user.id}/blocks`);
      setBlockedUsersList(res.blockedUsers || []);
    } catch {
      // ignore
    }
  }, [user.id]);

  async function moderateActiveRoom(
    action:
      | 'delete_active'
      | 'delete_message'
      | 'toggle_highlights'
      | 'toggle_comments'
      | 'set_slow_mode'
      | 'set_host_media'
      | 'ban_user'
      | 'unban_user',
    extra?: Record<string, unknown>
  ) {
    if (!activeRoom?.id) return;
    try {
      const res = await apiPost<{ ok: boolean; state?: LiveRoomState }>(`/api/live/rooms/${activeRoom.id}/moderate`, {
        action,
        hostId: user.id,
        ...extra,
      });
      if (res.state) {
        roomStateCacheRef.current[activeRoom.id] = res.state;
        setRoomState(res.state);
      }
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء');
    }
  }

  function toggleHostMic() {
    const nextMuted = !hostMicMuted;
    setHostMicMuted(nextMuted);
    camStreamRef.current?.getAudioTracks().forEach(tr => {
      tr.enabled = !nextMuted;
    });
    void moderateActiveRoom('set_host_media', { micMuted: nextMuted });
    showNotice(nextMuted ? 'تم كتم الميكروفون' : 'تم تشغيل الميكروفون');
  }

  function toggleHostCam() {
    const nextCamOff = !hostCamOff;
    setHostCamOff(nextCamOff);
    camStreamRef.current?.getVideoTracks().forEach(tr => {
      tr.enabled = !nextCamOff;
    });
    void moderateActiveRoom('set_host_media', { camOff: nextCamOff });
    showNotice(nextCamOff ? 'تم إغلاق الكاميرا — بث صوتي بصورتك الشخصية' : 'تم تشغيل الكاميرا');
  }

  async function flipLiveCamera() {
    if (!isHostingActiveRoom || hostCamOff || !navigator.mediaDevices?.getUserMedia) return;
    const nextFacing = hostFacing === 'user' ? 'environment' : 'user';
    try {
      const newVidStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false,
      });
      const newTrack = newVidStream.getVideoTracks()[0];
      if (!newTrack) return;
      const currentStream = camStreamRef.current;
      if (currentStream) {
        currentStream.getVideoTracks().forEach(oldTrack => {
          oldTrack.stop();
          currentStream.removeTrack(oldTrack);
        });
        currentStream.addTrack(newTrack);
        if (camVideoRef.current) camVideoRef.current.srcObject = currentStream;
      }
      hostPeersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(newTrack).catch(() => {});
      });
      setHostFacing(nextFacing);
      showNotice(nextFacing === 'environment' ? 'تم التبديل للكاميرا الخلفية' : 'تم التبديل للكاميرا الأمامية');
    } catch {
      showNotice('تعذر تبديل الكاميرا على هذا الجهاز');
    }
  }

  async function unblockUserFromLive(targetUserId: string) {
    await api(`/api/users/${targetUserId}/block?blockerId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    setBlockedUsersList(prev => prev.filter(u => u.id !== targetUserId));
    showNotice('تم إلغاء الحظر');
  }

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
            video: { facingMode: goLiveFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
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
      broadcastStartedAtRef.current = Date.now();
      broadcastTitleRef.current = goLiveTitle.trim();
      peakViewersRef.current = 1;
      setLiveElapsedSec(0);
      setLiveSummary(null);
      setHostMicMuted(false);
      setHostCamOff(!stream || stream.getVideoTracks().length === 0);
      setHostFacing(goLiveFacing);
      setHostingRoomId(res.room.id);
      setActiveRoomId(res.room.id);
      setGoLiveOpen(false);
      setGoLiveTitle('');
      // Sync initial Go Live studio settings (comments / slow mode / camera state) immediately!
      if (!goLiveAllowComments || goLiveSlowMode || !stream || stream.getVideoTracks().length === 0) {
        apiPost(`/api/live/rooms/${res.room.id}/moderate`, {
          action: 'toggle_comments',
          hostId: user.id,
          commentsEnabled: goLiveAllowComments,
        }).catch(() => {});
        if (goLiveSlowMode) {
          apiPost(`/api/live/rooms/${res.room.id}/moderate`, {
            action: 'set_slow_mode',
            hostId: user.id,
            slowModeSec: 8,
          }).catch(() => {});
        }
        if (!stream || stream.getVideoTracks().length === 0) {
          apiPost(`/api/live/rooms/${res.room.id}/moderate`, {
            action: 'set_host_media',
            hostId: user.id,
            camOff: true,
          }).catch(() => {});
        }
      }
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
   * 2-Finger Horizontal Swipe for TikTok Clear-Display Mode:
   * Slide 2 fingers horizontally to hide/restore ALL Live HUD, comments, and input bar!
   */
  function handleStageTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      twoFingerSwipeRef.current = { startX: midX, startY: midY, triggered: false };
    } else {
      twoFingerSwipeRef.current = null;
    }
  }

  function handleStageTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const g = twoFingerSwipeRef.current;
    if (!g || g.triggered || e.touches.length !== 2) return;
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const dx = midX - g.startX;
    const dy = midY - g.startY;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      g.triggered = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(14);
      }
      setCleanView(prev => {
        const next = !prev;
        showNotice(next ? 'الوضع الصافي مفعّل — اسحب بإصبعين للعودة' : 'تم إظهار التعليقات والأدوات');
        return next;
      });
    }
  }

  function handleStageTouchEnd() {
    twoFingerSwipeRef.current = null;
  }

  /**
   * Smooth 60fps Tap-to-Like Engine (Zero heavy Framer Motion orbs!)
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
    setBursts(prev => [...prev.slice(-7), item]);
    setTimeout(() => {
      setBursts(prev => prev.filter(b => b.id !== item.id));
    }, 820);

    setTapProgress(prev => {
      const next = prev + 100 / 50;
      if (next >= 100) return 6;
      return next;
    });
    setGaugePulse(true);
    setTimeout(() => setGaugePulse(false), 180);

    if (activeRoom?.id) {
      setOptimisticLikes(prev => ({ ...prev, [activeRoom.id]: (prev[activeRoom.id] || 0) + 1 }));
      queueLiveLike(activeRoom.id);
    }
  }

  async function handleSendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !activeRoom?.id) return;
    const text = commentText.trim();
    const activeReply = replyToLiveComment;
    setCommentText('');
    setReplyToLiveComment(null);
    setComposerFocused(false);
    // When sending our own comment, smoothly snap back to latest so we see it right away
    userScrolledUpRef.current = false;
    setScrolledUpComments(false);
    try {
      if (pinMode && isOwnerOfActiveRoom) {
        await apiPost(`/api/live/rooms/${activeRoom.id}/highlight`, { userId: user.id, text });
        setPinMode(false);
      } else {
        await apiPost(`/api/live/rooms/${activeRoom.id}/comment`, {
          userId: user.id,
          text,
          replyToId: activeReply?.id,
          replyToName: activeReply?.displayName,
          replyToText: activeReply?.text,
          replyToUserId: activeReply?.userId,
        });
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

  useEffect(() => {
    if (isHostingActiveRoom && displayedViewers > peakViewersRef.current) {
      peakViewersRef.current = displayedViewers;
    }
  }, [isHostingActiveRoom, displayedViewers]);

  const activePollMyVote = livePoll ? myPollVotes[livePoll.id] || livePoll.myVote : null;

  return (
    <div
      onWheel={handleSingleLiveWheel}
      className="w-full h-full bg-black relative overflow-hidden flex items-center justify-center"
    >
      {/* Full-Screen Vertical Swipe TikTok Live Feed + 2-Finger Swipe Clear-Display Mode */}
      <div
        ref={stageRef}
        onTouchStart={handleStageTouchStart}
        onTouchMove={handleStageTouchMove}
        onTouchEnd={handleStageTouchEnd}
        onClick={(e) => {
          if (muted) setMuted(false);
          setComposerFocused(false);
          setMobileNavExpanded(false);
          if (!cleanView) triggerStageTapBurst(e.clientX, e.clientY);
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
            const remoteHostCamOff = Boolean(roomState && roomState.roomId === room.id && roomState.hostCamOff);
            const remoteHostMicMuted = Boolean(roomState && roomState.roomId === room.id && roomState.hostMicMuted);

            const mediaNode = isHostingThis ? (
              camStreamRef.current && !hostCamOff && camStreamRef.current.getVideoTracks().length > 0 ? (
                <video
                  ref={camVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full ${hostFacing === 'user' ? 'scale-x-[-1]' : ''} ${isLandscape ? 'object-contain bg-black' : 'object-cover'}`}
                />
              ) : (
                <LiveVoiceAvatarStage
                  avatarUrl={user.avatarUrl}
                  initials={user.avatarInitials}
                  hostName={user.displayName}
                  title={room.title}
                  stream={camStreamRef.current}
                  micMuted={hostMicMuted}
                />
              )
            ) : isCurrent && viewerConnected ? (
              <>
                <video
                  ref={remoteLiveVideoRef}
                  autoPlay
                  playsInline
                  muted={muted}
                  className={
                    remoteHostCamOff
                      ? 'hidden'
                      : `w-full h-full ${isLandscape ? 'object-contain bg-black' : 'object-cover'}`
                  }
                />
                {remoteHostCamOff && (
                  <LiveVoiceAvatarStage
                    avatarUrl={room.hostAvatarUrl}
                    initials={room.hostInitials}
                    hostName={room.hostName}
                    title={room.title}
                    stream={remoteLiveStreamRef.current}
                    micMuted={remoteHostMicMuted}
                  />
                )}
              </>
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
        {!cleanView && <TapBurstOverlay items={bursts} />}

        {/* Subtle Legibility Gradients (Hidden in Clear-Display Mode!) */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/75 to-transparent transition-opacity duration-200 ${
            cleanView ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-72 bg-gradient-to-t from-black/90 via-black/45 to-transparent transition-opacity duration-200 ${
            cleanView ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {/* Top Floating Host Pill + Energy Gauge + Uniform Matte HUD Controls (Hides Smoothly in Clear-Display Mode!) */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ top: 'max(12px, calc(env(safe-area-inset-top) + 8px))' }}
          className={`absolute inset-x-3 sm:inset-x-4 z-20 flex items-start justify-between gap-2 transition-all duration-200 ${
            cleanView ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
          }`}
        >
          {activeRoom && (
            <div className="flex flex-col items-start gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => onOpenProfile?.(activeRoom.hostId)}
                className="flex items-center gap-2 ps-1.5 pe-3 py-1 rounded-full bg-black/55 hover:bg-black/70 cursor-pointer text-start transition-colors min-w-0 max-w-full"
              >
                <div
                  className={
                    activeRoom.hasActiveStory
                      ? 'p-[1.5px] rounded-full bg-gradient-to-tr from-[#FE2C55] to-[#25F4EE] shrink-0'
                      : 'shrink-0'
                  }
                >
                  <div className={activeRoom.hasActiveStory ? 'p-[1px] rounded-full bg-black' : ''}>
                    <UserAvatar initials={activeRoom.hostInitials} avatarUrl={activeRoom.hostAvatarUrl} size={32} online />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate max-w-[96px] sm:max-w-[122px]">{activeRoom.hostName}</div>
                  <div className="text-[10.5px] text-white/75 truncate max-w-[96px] sm:max-w-[122px]">{activeRoom.title}</div>
                </div>
                <span className="ms-1 px-2 py-0.5 rounded-full bg-[#FE2C55] text-white text-[10px] font-bold shrink-0">
                  {isHostingActiveRoom ? `LIVE · ${formatLiveDuration(liveElapsedSec)}` : 'LIVE'}
                </span>
              </button>

              {/* Lightweight CSS Energy Gauge (No Framer Motion lag!) */}
              <div
                ref={gaugeRef}
                className={`relative overflow-hidden px-3 py-1 rounded-full bg-black/55 flex items-center gap-2 min-w-[136px] transition-transform duration-150 ${
                  gaugePulse ? 'scale-105' : 'scale-100'
                }`}
              >
                <div
                  style={{ width: `${Math.min(100, Math.max(8, tapProgress))}%` }}
                  className="pointer-events-none absolute inset-y-0 start-0 bg-[#FE2C55]/45 transition-[width] duration-150"
                />
                <span className="relative z-10 w-4 h-4 rounded-full bg-[#FE2C55] text-white flex items-center justify-center shrink-0">
                  <ArrowUp className="w-3 h-3" strokeWidth={2.6} />
                </span>
                <span className="relative z-10 text-xs font-mono-num font-bold text-white flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-[#FE2C55] fill-current" />
                  <span>{formatCompact(displayedLikes)}</span>
                </span>
              </div>

              {/* Subtle Live Indicator if Host Muted Mic While Camera is ON */}
              {((isHostingActiveRoom && hostMicMuted && !hostCamOff) ||
                (!isHostingActiveRoom && roomState?.roomId === activeRoom.id && roomState.hostMicMuted && !roomState.hostCamOff)) && (
                <div className="px-2.5 py-1 rounded-full bg-[#EF4444]/85 text-[11px] font-bold text-white inline-flex items-center gap-1.5">
                  <MicOff className="w-3.5 h-3.5" />
                  <span>المذيع كتم الصوت</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <div className="h-10 px-3 rounded-full bg-black/55 flex items-center gap-1.5 text-xs font-semibold font-mono-num text-white max-w-[82px]">
              <Eye className="w-4 h-4 text-white/85 shrink-0" />
              <span className="truncate">{formatCompact(displayedViewers)}</span>
            </div>

            {hostingRoomId ? (
              <button
                type="button"
                onClick={() => stopHostingBroadcast(true)}
                title={t(lang, 'end_live')}
                className="h-10 px-3.5 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{t(lang, 'end_live')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setGoLiveOpen(true)}
                title={t(lang, 'go_live')}
                className="h-10 px-3.5 rounded-full bg-[#FE2C55] hover:bg-[#EA284E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Radio className="w-4 h-4" />
                <span>{t(lang, 'go_live')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Floating Live Poll Voting Card (Real-Time WS Sync, Hides in Clear-Display Mode) */}
        {!cleanView && livePoll && activeRoom && livePoll.roomId === activeRoom.id && (
          <div
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            className="swiper-no-swiping absolute top-[128px] start-3.5 end-16 z-20 max-w-[330px] rounded-2xl bg-black/72 backdrop-blur-md border border-white/[0.14] px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.45)] space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#25F4EE] mb-0.5">
                  <BarChart3 className="w-3 h-3" />
                  <span>استطلاع مباشر</span>
                  <span className="text-white/55 font-mono-num">· {livePoll.totalVotes} صوت</span>
                </div>
                <div className="text-[12.5px] font-bold text-white leading-snug">{livePoll.question}</div>
              </div>
              {isOwnerOfActiveRoom && (
                <button
                  type="button"
                  onClick={handleCloseLivePoll}
                  title="إنهاء الاستطلاع"
                  className="shrink-0 px-2 py-0.5 rounded-full bg-white/[0.1] hover:bg-[#EF4444] text-[10px] font-bold text-white/90 cursor-pointer transition-colors"
                >
                  إنهاء
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {livePoll.options.map(opt => {
                const picked = activePollMyVote === opt.id;
                const showResults = Boolean(activePollMyVote) || isOwnerOfActiveRoom || livePoll.totalVotes > 0;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleVoteLivePoll(opt.id)}
                    className={`relative w-full overflow-hidden rounded-xl px-3 py-2 text-start text-[12px] font-semibold transition-all cursor-pointer border ${
                      picked
                        ? 'border-[#25F4EE] bg-[#25F4EE]/15 text-white'
                        : 'border-white/[0.1] bg-white/[0.06] hover:bg-white/[0.12] text-white/95'
                    }`}
                  >
                    {showResults && (
                      <div
                        style={{ width: `${Math.max(0, Math.min(100, opt.percent))}%` }}
                        className={`pointer-events-none absolute inset-y-0 start-0 transition-[width] duration-300 ${
                          picked ? 'bg-[#25F4EE]/28' : 'bg-white/[0.12]'
                        }`}
                      />
                    )}
                    <div className="relative z-10 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 truncate">
                        {picked && <Check className="w-3.5 h-3.5 text-[#25F4EE] shrink-0" />}
                        <span className="truncate">{opt.text}</span>
                      </span>
                      {showResults && (
                        <span className="text-[11px] font-mono-num font-bold text-white/90 shrink-0">
                          {opt.percent}%
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Pinned Comment (Hides in Clear-Display Mode + Host 1-Tap Unpin) */}
        {!cleanView && roomState && roomState.roomId === activeRoom?.id && roomState.activeHighlight && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute bottom-[300px] start-4 end-16 z-20 px-3 py-2 rounded-xl bg-black/70 border-s-2 border-[#FBBF24] flex items-center gap-2"
          >
            <Pin className="w-4 h-4 text-[#FBBF24] shrink-0" />
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
            {isOwnerOfActiveRoom && (
              <button
                type="button"
                onClick={() => {
                  moderateActiveRoom('delete_active');
                  showNotice('تمت إزالة التعليق المثبت');
                }}
                title="إزالة التثبيت"
                className="w-6 h-6 rounded-full hover:bg-white/15 text-white/75 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Full-History Scrollable Live Comments with TikTok Highlighted Replies (Hides Smoothly in Clear-Display Mode!) */}
        <div
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
          className={`swiper-no-swiping absolute start-3.5 sm:start-4 z-20 w-[76%] max-w-[350px] transition-all duration-200 ${
            cleanView ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
          }`}
        >
          <div
            ref={commentsScrollRef}
            onScroll={handleCommentsScroll}
            className="live-comments-scroll max-h-[210px] overflow-y-auto overscroll-contain touch-pan-y no-scrollbar space-y-2 py-2"
          >
            {(roomState && roomState.roomId === activeRoom?.id ? roomState.recentMessages : []).map(msg => {
              const isReply = Boolean(msg.replyToName);
              return (
                <div
                  key={msg.id}
                  onClick={() => {
                    if (isOwnerOfActiveRoom && msg.userId !== user.id) {
                      setHostModerateMsg(msg);
                    } else {
                      setReplyToLiveComment({
                        id: msg.id,
                        userId: msg.userId,
                        displayName: msg.displayName,
                        text: msg.text,
                      });
                      setLiveInputFocused(true);
                    }
                  }}
                  className="group cursor-pointer transition-colors px-2 py-1 rounded-xl bg-black/32 hover:bg-black/48"
                >
                  {isReply && (
                    <div className="flex items-center gap-1 text-[10.5px] font-medium text-white/65 mb-0.5 truncate">
                      <CornerDownLeft className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        ردًا على {msg.replyToName}
                        {msg.replyToText ? `: ${msg.replyToText.slice(0, 34)}` : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2 text-[13px] leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={ev => {
                          ev.stopPropagation();
                          onOpenProfile?.(msg.userId);
                        }}
                        className="font-semibold hover:underline me-1.5 cursor-pointer text-white/95 hover:text-white truncate max-w-[140px] inline-block align-bottom"
                      >
                        {msg.displayName}
                      </button>
                      <span className="text-white break-words">{msg.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={ev => {
                        ev.stopPropagation();
                        setReplyToLiveComment({
                          id: msg.id,
                          userId: msg.userId,
                          displayName: msg.displayName,
                          text: msg.text,
                        });
                        setLiveInputFocused(true);
                      }}
                      title="الرد على هذا التعليق"
                      className="shrink-0 text-[10.5px] font-medium text-white/55 hover:text-white opacity-80 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-0.5 cursor-pointer pt-0.5 transition-opacity"
                    >
                      <CornerDownLeft className="w-3 h-3" />
                      <span>رد</span>
                    </button>
                  </div>
                </div>
              );
            })}
            <div ref={commentsEndRef} />
          </div>

          {scrolledUpComments && (
            <button
              type="button"
              onClick={jumpToLatestComments}
              className="mt-1 px-3 py-1 rounded-full bg-black/75 text-[11px] font-semibold text-white inline-flex items-center gap-1 cursor-pointer hover:bg-white hover:text-black transition-colors"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>أحدث التعليقات</span>
            </button>
          )}
        </div>

        {/* Uniform Side Action Buttons (All 40x40 with 20x20 Crisp Icons — Host Super-Controls + Clear Mode!) */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ bottom: 'calc(82px + env(safe-area-inset-bottom))' }}
          className={`absolute end-3.5 z-20 flex flex-col items-center gap-3 transition-all duration-200 ${
            cleanView ? 'opacity-0 translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'
          }`}
        >
          {isHostingActiveRoom && (
            <>
              <button
                type="button"
                onClick={toggleHostMic}
                title={hostMicMuted ? 'تشغيل الميكروفون' : 'كتم الميكروفون'}
                className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  hostMicMuted ? 'bg-[#EF4444] text-white' : 'bg-black/55 hover:bg-black/75 text-white'
                }`}
              >
                {hostMicMuted ? <MicOff className="w-5 h-5" strokeWidth={2} /> : <Mic className="w-5 h-5" strokeWidth={2} />}
              </button>

              <button
                type="button"
                onClick={toggleHostCam}
                title={hostCamOff ? 'تشغيل الكاميرا' : 'إغلاق الكاميرا (صوت فقط)'}
                className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  hostCamOff ? 'bg-[#EF4444] text-white' : 'bg-black/55 hover:bg-black/75 text-white'
                }`}
              >
                {hostCamOff ? <VideoOff className="w-5 h-5" strokeWidth={2} /> : <Video className="w-5 h-5" strokeWidth={2} />}
              </button>

              {!hostCamOff && (
                <button
                  type="button"
                  onClick={flipLiveCamera}
                  title="تبديل الكاميرا"
                  className="w-10 h-10 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-5 h-5" strokeWidth={2} />
                </button>
              )}
            </>
          )}

          {isOwnerOfActiveRoom && (
            <>
              <button
                type="button"
                onClick={() => setPollCreatorOpen(true)}
                title="إنشاء استطلاع مباشر"
                className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  livePoll ? 'bg-[#25F4EE] text-black' : 'bg-black/55 hover:bg-black/75 text-white'
                }`}
              >
                <BarChart3 className="w-5 h-5" strokeWidth={2} />
              </button>

              <button
                type="button"
                onClick={() => {
                  loadBlockedUsers();
                  setHostControlsOpen(true);
                }}
                title="لوحة تحكم المذيع"
                className="w-10 h-10 rounded-full bg-black/55 hover:bg-black/75 text-[#25F4EE] flex items-center justify-center cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-5 h-5" strokeWidth={2} />
              </button>
            </>
          )}

          {isOwnerOfActiveRoom && (
            <button
              type="button"
              onClick={() => setPinMode(v => !v)}
              title="تثبيت تعليق (لصاحب البث فقط)"
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                pinMode ? 'bg-[#FE2C55] text-white' : 'bg-black/55 hover:bg-black/75 text-white'
              }`}
            >
              <Pin className="w-5 h-5" strokeWidth={2} />
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
                  onReport:
                    activeRoom.hostId !== user.id
                      ? () =>
                          setReportRequest({
                            targetType: 'live',
                            targetId: activeRoom.id,
                            label: lang === 'en' ? 'this live broadcast' : 'هذا البث المباشر',
                          })
                      : undefined,
                });
              } else {
                navigator.clipboard?.writeText(window.location.href);
                showNotice('تم نسخ رابط البث');
              }
            }}
            title={activeRoom && activeRoom.hostId !== user.id ? 'مشاركة أو إبلاغ' : 'مشاركة البث'}
            className="w-10 h-10 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <Share2 className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {statusMsg && (
          <div className="pointer-events-none absolute top-28 inset-x-8 z-30 py-1.5 px-3 rounded-full bg-black/80 text-center text-xs font-medium text-white">
            {statusMsg}
          </div>
        )}

        {/* Borderless Floating Bottom Comment Composer + Reply Pill (Lifts ONLY Input Above Mobile Keyboard & Hides in Clear Mode!) */}
        {!mobileNavExpanded && !cleanView && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ bottom: 'calc(max(14px, env(safe-area-inset-bottom) + 10px) + var(--lm-kb-offset, 0px))' }}
            className="absolute inset-x-3.5 z-20 flex flex-col gap-2 transition-[bottom] duration-150"
          >
            {replyToLiveComment && (
              <div className="w-fit max-w-[85%] self-start rounded-xl bg-black/78 backdrop-blur-md border-s-2 border-white/55 px-3 py-1.5 flex items-center gap-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-white/90 truncate">
                    الرد على {replyToLiveComment.displayName}
                  </div>
                  <div className="text-[11px] text-white/75 truncate max-w-[200px]">
                    {replyToLiveComment.text}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyToLiveComment(null)}
                  className="w-6 h-6 rounded-full hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <SplitComposerOrb
                directDockMode
                transparent={!liveInputFocused && !commentText.trim()}
              />
              <div className="flex-1 min-w-0">
                {!isOwnerOfActiveRoom && roomState?.roomId === activeRoom?.id && roomState?.commentsEnabled === false ? (
                  <div className="h-11 px-4 rounded-full bg-black/60 text-xs font-medium text-[#A1A1AA] flex items-center justify-center">
                    أوقف صاحب البث التعليقات مؤقتًا
                  </div>
                ) : (
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
                      replyToLiveComment
                        ? `اكتب ردك على ${replyToLiveComment.displayName}...`
                        : pinMode && isOwnerOfActiveRoom
                          ? lang === 'en'
                            ? 'Pinned comment...'
                            : 'تعليق مثبت...'
                          : t(lang, 'add_comment')
                    }
                    disabled={!commentText.trim()}
                  />
                )}
              </div>
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
                    maxLength={50}
                    onChange={e => setGoLiveTitle(e.target.value.slice(0, 50))}
                    placeholder={lang === 'en' ? 'Add a broadcast title...' : 'اكتب عنوان البث هنا...'}
                    className="flex-1 min-w-0 bg-transparent text-sm font-medium text-white placeholder:text-white/75 outline-none"
                  />
                  <span className="text-[10.5px] font-mono-num text-white/60 shrink-0">{goLiveTitle.length}/50</span>
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

              {/* BOTTOM FLOATING START BROADCAST BUTTON (Flat Matte #FE2C55 — ZERO Glow!) */}
              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={startingLive || !goLiveTitle.trim()}
                  className="w-full max-w-[280px] h-12 rounded-full bg-[#FE2C55] hover:bg-[#EA284E] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
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

      {/* HOST COMMENT MODERATION SHEET (Tap Any Viewer Comment -> Reply / Pin / Delete / Block User!) */}
      {hostModerateMsg && activeRoom && (
        <div
          onClick={() => setHostModerateMsg(null)}
          className="fixed inset-0 z-[74] bg-black/62 backdrop-blur-sm flex items-end justify-center p-3"
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'max(18px, calc(env(safe-area-inset-bottom) + 12px))' }}
            className="w-full max-w-[440px] rounded-2xl bg-[#181920] border border-white/[0.1] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#25F4EE] truncate">{hostModerateMsg.displayName}</div>
                <div className="text-xs text-[#D4D4D8] line-clamp-2 mt-0.5">{hostModerateMsg.text}</div>
              </div>
              <button
                type="button"
                onClick={() => setHostModerateMsg(null)}
                className="w-8 h-8 rounded-full hover:bg-white/[0.08] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-white/[0.06] text-sm font-medium text-[#F1F1F2]">
              <button
                type="button"
                onClick={() => {
                  const target = hostModerateMsg;
                  setHostModerateMsg(null);
                  setReplyToLiveComment({ id: target.id, displayName: target.displayName, text: target.text });
                  setLiveInputFocused(true);
                }}
                className="w-full h-12 px-4 flex items-center justify-between hover:bg-white/[0.06] cursor-pointer"
              >
                <span>الرد على التعليق</span>
                <CornerDownLeft className="w-[18px] h-[18px] text-[#25F4EE]" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  const target = hostModerateMsg;
                  setHostModerateMsg(null);
                  await apiPost(`/api/live/rooms/${activeRoom.id}/highlight`, {
                    userId: user.id,
                    text: `${target.displayName}: ${target.text}`,
                  }).catch(() => {});
                  showNotice('تم تثبيت التعليق');
                }}
                className="w-full h-12 px-4 flex items-center justify-between hover:bg-white/[0.06] cursor-pointer"
              >
                <span>تثبيت التعليق في البث</span>
                <Pin className="w-[18px] h-[18px] text-[#FBBF24]" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  const mid = hostModerateMsg.id;
                  setHostModerateMsg(null);
                  await moderateActiveRoom('delete_message', { messageId: mid });
                  showNotice('تم حذف التعليق من البث');
                }}
                className="w-full h-12 px-4 flex items-center justify-between hover:bg-white/[0.06] text-[#FBBF24] cursor-pointer"
              >
                <span>حذف هذا التعليق</span>
                <Trash2 className="w-[18px] h-[18px]" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  const targetUid = hostModerateMsg.userId;
                  const targetName = hostModerateMsg.displayName;
                  setHostModerateMsg(null);
                  await moderateActiveRoom('ban_user', { userId: targetUid, blockGlobally: true });
                  showNotice(`تم حظر ${targetName} من البث ومن رؤية ملفك الشخصي`);
                }}
                className="w-full h-12 px-4 flex items-center justify-between hover:bg-[#FF595A]/12 text-[#FF595A] cursor-pointer"
              >
                <span>حظر الشخص (من البث والملف الشخصي)</span>
                <ShieldBan className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOST LIVE CONTROL CENTER SHEET (Comments On/Off, Slow Mode, Clear Pin, Blocked Users Manager!) */}
      {hostControlsOpen && activeRoom && (
        <div
          onClick={() => setHostControlsOpen(false)}
          className="fixed inset-0 z-[74] bg-black/62 backdrop-blur-sm flex items-end justify-center"
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'max(22px, calc(env(safe-area-inset-bottom) + 14px))' }}
            className="w-full max-w-[520px] max-h-[80vh] overflow-y-auto rounded-t-[24px] bg-[#181920] border-t border-white/[0.1] px-5 pt-3 space-y-5"
          >
            <div className="flex flex-col items-center gap-2 pb-2 border-b border-white/[0.08]">
              <div className="w-10 h-1 rounded-full bg-white/25" />
              <div className="w-full flex items-center justify-between">
                <span className="text-sm font-bold text-white">أدوات التحكم في البث المباشر</span>
                <button
                  type="button"
                  onClick={() => setHostControlsOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/[0.08] text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Media Row (Mic + Camera) */}
            {isHostingActiveRoom && (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={toggleHostMic}
                  className={`h-11 rounded-xl px-3 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    hostMicMuted ? 'bg-[#EF4444] text-white' : 'bg-[#22242E] hover:bg-[#2C2F3C] text-white'
                  }`}
                >
                  {hostMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#25F4EE]" />}
                  <span>{hostMicMuted ? 'فتح المايك' : 'كتم المايك'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleHostCam}
                  className={`h-11 rounded-xl px-3 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    hostCamOff ? 'bg-[#EF4444] text-white' : 'bg-[#22242E] hover:bg-[#2C2F3C] text-white'
                  }`}
                >
                  {hostCamOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-[#25F4EE]" />}
                  <span>{hostCamOff ? 'تشغيل الكاميرا' : 'إغلاق الكاميرا'}</span>
                </button>
              </div>
            )}

            {/* Comments Toggle + Slow Mode + Clear Pinned */}
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">السماح بالتعليقات</div>
                  <div className="text-[11px] text-[#8E8E93]">إيقاف أو تشغيل تعليقات المشاهدين فورًا</div>
                </div>
                <button
                  type="button"
                  onClick={() => moderateActiveRoom('toggle_comments')}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    roomState?.commentsEnabled !== false ? 'bg-[#25F4EE]' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-black transition-transform ${
                      roomState?.commentsEnabled !== false ? '-translate-x-5 rtl:-translate-x-5 ltr:translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">وضع التهدئة (Slow Mode)</div>
                  <div className="text-[11px] text-[#8E8E93]">تحديد مهلة بين تعليقات نفس المشاهد</div>
                </div>
                <div className="flex items-center gap-1">
                  {[0, 5, 15, 30].map(sec => {
                    const active = (roomState?.slowModeSec || 0) === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => moderateActiveRoom('set_slow_mode', { slowModeSec: sec })}
                        className={`h-8 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                          active ? 'bg-[#FE2C55] text-white' : 'bg-[#22242E] text-[#A1A1AA] hover:text-white'
                        }`}
                      >
                        {sec === 0 ? 'إيقاف' : `${sec}ث`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {roomState?.activeHighlight && (
                <button
                  type="button"
                  onClick={() => {
                    moderateActiveRoom('delete_active');
                    showNotice('تمت إزالة التعليق المثبت');
                  }}
                  className="w-full h-10 rounded-xl bg-[#22242E] hover:bg-[#2C2F3C] text-xs font-semibold text-[#FBBF24] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Pin className="w-4 h-4" />
                  <span>إزالة التعليق المثبت الحالي</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setHostControlsOpen(false);
                  setPollCreatorOpen(true);
                }}
                className="w-full h-10 rounded-xl bg-[#25F4EE]/15 hover:bg-[#25F4EE]/25 border border-[#25F4EE]/30 text-xs font-bold text-[#25F4EE] flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                <span>{livePoll ? 'تحديث الاستطلاع المباشر' : 'إطلاق استطلاع مباشر للمشاهدين'}</span>
              </button>
            </div>

            {/* Blocked Users List with 1-Tap Unblock */}
            <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldBan className="w-4 h-4 text-[#FF595A]" />
                  <span>المحظورون من البث والملف الشخصي ({blockedUsersList.length})</span>
                </span>
              </div>

              {blockedUsersList.length === 0 ? (
                <div className="py-3 text-center text-[11.5px] text-[#7A7A85]">
                  لا يوجد مستخدمون محظورون — اضغط على أي تعليق في البث لحذفه أو حظر صاحبه.
                </div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {blockedUsersList.map(bu => (
                    <div
                      key={bu.id}
                      className="flex items-center justify-between gap-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar initials={bu.avatarInitials} avatarUrl={bu.avatarUrl} size={32} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{bu.displayName}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => unblockUserFromLive(bu.id)}
                        className="h-8 px-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-[11px] font-semibold text-white cursor-pointer shrink-0"
                      >
                        إلغاء الحظر
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HOST INTERACTIVE LIVE POLL CREATOR SHEET */}
      {pollCreatorOpen && activeRoom && (
        <div
          onClick={() => setPollCreatorOpen(false)}
          className="fixed inset-0 z-[76] bg-black/68 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <form
            onSubmit={handleCreateLivePoll}
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'max(22px, calc(env(safe-area-inset-bottom) + 14px))' }}
            className="w-full max-w-[460px] rounded-t-[24px] sm:rounded-2xl bg-[#181920] border border-white/[0.1] px-5 pt-4 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <BarChart3 className="w-4 h-4 text-[#25F4EE]" />
                <span>إنشاء استطلاع مباشر</span>
              </div>
              <button
                type="button"
                onClick={() => setPollCreatorOpen(false)}
                className="w-8 h-8 rounded-full bg-white/[0.08] text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#A1A1AA]">سؤال الاستطلاع</label>
              <input
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                maxLength={120}
                placeholder="مثال: نكمل الموضوع ده ولا نبدأ فقرة الأسئلة؟"
                className="w-full h-11 rounded-xl bg-black/45 border border-white/[0.1] focus:border-[#25F4EE] px-3.5 text-sm text-white placeholder:text-[#7A7A85] outline-none"
              />
              {/* Quick 1-Tap Poll Presets */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  { q: 'رأيكم في موضوع البث النهاردة؟', opts: ['جامد جدًا 🔥', 'ممتاز ومفيد 👍'] },
                  { q: 'الفقرة الجاية تكون إيه؟', opts: ['أسئلة وأجوبة 💬', 'دردشة مفتوحة 🎙️'] },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPollQuestion(preset.q);
                      setPollOptions(preset.opts);
                    }}
                    className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[11px] text-[#D4D4D8] cursor-pointer"
                  >
                    {preset.q}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#A1A1AA]">الخيارات ({pollOptions.length}/4)</label>
                {pollOptions.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions(prev => [...prev, ''])}
                    className="text-[11px] font-bold text-[#25F4EE] inline-flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة خيار</span>
                  </button>
                )}
              </div>
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={e =>
                      setPollOptions(prev => prev.map((v, i) => (i === idx ? e.target.value : v)))
                    }
                    maxLength={60}
                    placeholder={`الخيار ${idx + 1}`}
                    className="flex-1 h-10 rounded-xl bg-black/45 border border-white/[0.1] focus:border-[#25F4EE] px-3 text-xs text-white placeholder:text-[#7A7A85] outline-none"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions(prev => prev.filter((_, i) => i !== idx))}
                      className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-[#EF4444]/20 text-[#A1A1AA] hover:text-[#EF4444] flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              {livePoll && (
                <button
                  type="button"
                  onClick={() => {
                    handleCloseLivePoll();
                    setPollCreatorOpen(false);
                  }}
                  className="h-11 px-4 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-xs font-bold text-[#FF595A] cursor-pointer"
                >
                  إنهاء الحالي
                </button>
              )}
              <button
                type="submit"
                disabled={creatingPoll || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                className="flex-1 h-11 rounded-xl bg-[#25F4EE] hover:bg-[#1BE3DD] disabled:opacity-45 text-black text-xs font-extrabold cursor-pointer transition-colors"
              >
                {creatingPoll ? 'جارٍ الإطلاق...' : 'إطلاق الاستطلاع الآن'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POST-LIVE BROADCAST SUMMARY SCREEN (Duration, Peak Viewers, Likes, Comments!) */}
      {liveSummary && (
        <div className="fixed inset-0 z-[78] bg-black/82 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-[400px] rounded-[26px] bg-gradient-to-b from-[#1B1D26] to-[#121319] border border-white/[0.12] p-6 text-center space-y-5 shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
            <div className="flex flex-col items-center gap-2.5">
              <div className="p-1 rounded-full bg-gradient-to-tr from-[#FE2C55] to-[#25F4EE]">
                <div className="p-0.5 rounded-full bg-[#121319]">
                  <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={68} />
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/[0.08] text-[11px] font-bold text-[#25F4EE] mb-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ملخص البث المباشر</span>
                </div>
                <h3 className="text-lg font-extrabold text-white">انتهى البث بنجاح</h3>
                <p className="text-xs text-[#9E9EA8] mt-0.5 line-clamp-1">{liveSummary.title}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-3.5 flex flex-col items-center gap-1">
                <Clock className="w-4 h-4 text-[#25F4EE]" />
                <span className="text-lg font-extrabold font-mono-num text-white">
                  {formatLiveDuration(liveSummary.durationSec)}
                </span>
                <span className="text-[11px] text-[#9E9EA8]">مدة البث</span>
              </div>
              <div className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-3.5 flex flex-col items-center gap-1">
                <Users className="w-4 h-4 text-[#A78BFA]" />
                <span className="text-lg font-extrabold font-mono-num text-white">
                  {formatCompact(liveSummary.peakViewers)}
                </span>
                <span className="text-[11px] text-[#9E9EA8]">ذروة المشاهدين</span>
              </div>
              <div className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-3.5 flex flex-col items-center gap-1">
                <Heart className="w-4 h-4 text-[#FE2C55] fill-current" />
                <span className="text-lg font-extrabold font-mono-num text-white">
                  {formatCompact(liveSummary.likesCount)}
                </span>
                <span className="text-[11px] text-[#9E9EA8]">إجمالي الإعجابات</span>
              </div>
              <div className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-3.5 flex flex-col items-center gap-1">
                <MessageCircle className="w-4 h-4 text-[#34D399]" />
                <span className="text-lg font-extrabold font-mono-num text-white">
                  {formatCompact(liveSummary.commentsCount)}
                </span>
                <span className="text-[11px] text-[#9E9EA8]">التعليقات</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLiveSummary(null)}
              className="w-full h-11 rounded-full bg-white hover:bg-[#E4E4E7] text-black text-sm font-extrabold cursor-pointer transition-colors"
            >
              تم — العودة للبثوث
            </button>
          </div>
        </div>
      )}

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
