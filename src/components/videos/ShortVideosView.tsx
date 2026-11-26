import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Keyboard } from 'swiper/modules';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Music2,
  Volume2,
  VolumeX,
  Plus,
  Mic,
  CornerDownLeft,
  Link2,
  Download,
  Repeat2,
  Flag,
  EyeOff,
  Check,
  Send,
  FastForward,
  Sparkles,
  X,
} from 'lucide-react';

import { ConversationItem, Lang, ShortVideoItem, UserProfile, VideoCommentItem } from '../../types';
import { AiSummonBadge, MARKDOWN_LINK_COMPONENTS, RichMessageText, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ObsidianComposerPill, ChromeArrowButton } from '../shared/HardwareUI';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { TapBurstItem, TapBurstOverlay, createTapBurst } from '../shared/TapComboBurst';
import { NavAiIcon, PulsePlayGlyph, SharePlatformIcons } from '../shared/Icons2026Pro';
import { useLayout } from '../../context/LayoutContext';
import { apiGet, apiPost, apiUploadFile } from '../../lib/api';

interface ShortVideosViewProps {
  user: UserProfile;
  lang: Lang;
}

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const SHARE_PLATFORMS: Array<{ id: keyof typeof SharePlatformIcons; label: string; bg: string }> = [
  { id: 'copy', label: 'نسخ الرابط', bg: '#25252D' },
  { id: 'whatsapp', label: 'واتساب', bg: '#16A34A' },
  { id: 'telegram', label: 'تيليجرام', bg: '#0EA5E9' },
  { id: 'instagram', label: 'إنستجرام', bg: '#E1306C' },
  { id: 'x', label: 'X', bg: '#18181D' },
  { id: 'facebook', label: 'فيسبوك', bg: '#2563EB' },
  { id: 'sms', label: 'رسائل', bg: '#10B981' },
];

export function ShortVideosView({ user, lang }: ShortVideosViewProps) {
  const { setBottomDockHidden } = useLayout();
  const [videos, setVideos] = useState<ShortVideoItem[]>([]);
  const [feedTab, setFeedTabState] = useState<'following' | 'friends' | 'for_you'>(() => {
    try {
      const saved = localStorage.getItem('lm_pulse_tab');
      if (saved === 'following' || saved === 'friends' || saved === 'for_you') return saved;
    } catch {
      // ignore
    }
    return 'for_you';
  });
  const [activeIndex, setActiveIndexState] = useState<number>(() => {
    try {
      const n = Number(localStorage.getItem('lm_pulse_index') || '0');
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  });

  const setFeedTab = useCallback((t: 'following' | 'friends' | 'for_you') => {
    setFeedTabState(t);
    try {
      localStorage.setItem('lm_pulse_tab', t);
    } catch {
      // ignore
    }
  }, []);

  const setActiveIndex = useCallback((i: number) => {
    setActiveIndexState(i);
    try {
      localStorage.setItem('lm_pulse_index', String(i));
    } catch {
      // ignore
    }
  }, []);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [speed2x, setSpeed2x] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(15);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});

  // Rapid multi-tap burst + Long-Press 2x refs
  const [bursts, setBursts] = useState<TapBurstItem[]>([]);
  const comboRef = useRef({ count: 0, lastMs: 0 });
  const singleTapTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const prevSlideIdxRef = useRef(0);
  const swiperRef = useRef<SwiperClass | null>(null);
  const wheelLockUntilRef = useRef<number>(0);

  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  /**
   * 100% Deterministic Laptop Trackpad / Mousewheel Single-Video Stepper:
   * Eliminates double-skipping caused by Windows Precision Touchpad momentum!
   */
  function handleSingleVideoWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (drawerVideo || shareVideo || uploadOpen) return;
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

  // Comments Sheet (Centered inside video stage like Live — NO X button, floating composer, AI summon + Voice-to-AI + persistent drafts!)
  const [drawerVideo, setDrawerVideo] = useState<ShortVideoItem | null>(null);
  const [comments, setComments] = useState<VideoCommentItem[]>([]);
  const [commentDraftsByVideo, setCommentDraftsByVideo] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('lm_draft_pulse_comments');
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; snippet?: string; isAi?: boolean } | null>(null);
  const [aiMode, setAiMode] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);

  const commentDraft = drawerVideo ? commentDraftsByVideo[drawerVideo.id] || '' : '';
  const setCommentDraft = useCallback(
    (val: string) => {
      if (!drawerVideo) return;
      setCommentDraftsByVideo(prev => {
        const next = { ...prev, [drawerVideo.id]: val };
        try {
          localStorage.setItem('lm_draft_pulse_comments', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [drawerVideo]
  );

  // Share Sheet (NO X button, Authentic Brand Vector Icons — ZERO emojis!)
  const [shareVideo, setShareVideo] = useState<ShortVideoItem | null>(null);
  const [contacts, setContacts] = useState<ConversationItem[]>([]);
  const [sentToIds, setSentToIds] = useState<Record<string, boolean>>({});
  const [shareToast, setShareToast] = useState('');

  // Upload Pulse Modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadVideos = useCallback(async () => {
    const res = await apiGet<{ ok: boolean; videos: ShortVideoItem[] }>(`/api/videos?userId=${user.id}`);
    setVideos(res.videos);
  }, [user.id]);

  useEffect(() => {
    loadVideos();
    return () => setBottomDockHidden(false);
  }, [loadVideos, setBottomDockHidden]);

  const orderedVideos = React.useMemo(() => {
    if (feedTab === 'following') return [...videos].reverse();
    if (feedTab === 'friends') return videos.slice(1).concat(videos.slice(0, 1));
    return videos;
  }, [videos, feedTab]);

  useEffect(() => {
    setPaused(false);
    setSpeed2x(false);
    setCurrentTime(0);
    Object.entries(videoRefs.current).forEach(([idxStr, el]) => {
      if (!el) return;
      el.playbackRate = 1;
      if (Number(idxStr) === activeIndex) {
        el.currentTime = 0;
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    });
  }, [activeIndex, orderedVideos.length, feedTab]);

  function togglePlayPause() {
    const el = videoRefs.current[activeIndex];
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  }

  function scrubTo(nextSec: number) {
    const el = videoRefs.current[activeIndex];
    if (!el) return;
    el.currentTime = nextSec;
    setCurrentTime(nextSec);
  }

  /**
   * Unified 2026 Stage Gesture Controller:
   * - Long-Press (> 280ms) -> Instant 2x playback speed while holding!
   * - Release from Long-Press -> Smoothly restores 1x without pausing!
   * - Single Quick Tap -> Play / Pause with sleek curved translucent Play glyph
   * - Rapid Multi-Taps -> TikTok multi-design bursts + Like combo!
   */
  function handleStagePointerDown() {
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      const el = videoRefs.current[activeIndex];
      if (el && !el.paused) {
        longPressTriggeredRef.current = true;
        el.playbackRate = 2;
        setSpeed2x(true);
      }
    }, 280);
  }

  function releaseLongPressSpeed() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressTriggeredRef.current) {
      const el = videoRefs.current[activeIndex];
      if (el) el.playbackRate = 1;
      setSpeed2x(false);
    }
  }

  function handleStageClick(e: React.MouseEvent<HTMLDivElement>, v: ShortVideoItem) {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = Date.now();

    if (now - comboRef.current.lastMs < 340) {
      if (singleTapTimerRef.current) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      comboRef.current.count += 1;
      comboRef.current.lastMs = now;

      const burst = createTapBurst(x, y, comboRef.current.count);
      setBursts(prev => [...prev.slice(-14), burst]);
      setTimeout(() => setBursts(prev => prev.filter(b => b.id !== burst.id)), 900);
      toggleLike(v, true);
      return;
    }

    comboRef.current.count = 1;
    comboRef.current.lastMs = now;

    if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = window.setTimeout(() => {
      togglePlayPause();
      singleTapTimerRef.current = null;
    }, 240);
  }

  async function toggleLike(v: ShortVideoItem, forceLike = false) {
    const res = await apiPost<{ ok: boolean; liked: boolean }>(`/api/videos/${v.id}/like`, {
      userId: user.id,
      forceLike,
    });
    setVideos(prev =>
      prev.map(item =>
        item.id === v.id
          ? {
              ...item,
              likedByMe: res.liked,
              likesCount: res.liked ? item.likesCount + 1 : Math.max(0, item.likesCount - 1),
            }
          : item
      )
    );
  }

  async function toggleSave(v: ShortVideoItem) {
    const res = await apiPost<{ ok: boolean; saved: boolean }>(`/api/videos/${v.id}/save`, { userId: user.id });
    setVideos(prev =>
      prev.map(item =>
        item.id === v.id
          ? {
              ...item,
              savedByMe: res.saved,
              savesCount: res.saved ? item.savesCount + 1 : Math.max(0, item.savesCount - 1),
            }
          : item
      )
    );
  }

  async function openComments(v: ShortVideoItem) {
    setDrawerVideo(v);
    const res = await apiGet<{ ok: boolean; comments: VideoCommentItem[] }>(`/api/videos/${v.id}/comments?userId=${user.id}`);
    setComments(res.comments);
  }

  async function openShareSheet(v: ShortVideoItem) {
    setShareVideo(v);
    setSentToIds({});
    try {
      const res = await apiGet<{ ok: boolean; conversations: ConversationItem[] }>('/api/conversations');
      setContacts(res.conversations);
    } catch {
      // ignore
    }
  }

  async function sendPulseToContact(conv: ConversationItem) {
    if (!shareVideo) return;
    setSentToIds(prev => ({ ...prev, [conv.id]: true }));
    await apiPost(`/api/conversations/${conv.id}/messages`, {
      senderId: user.id,
      content: `شارك نبض: ${shareVideo.title.slice(0, 70)}`,
      msgType: 'video_note',
      mediaUrl: shareVideo.videoUrl || '/uploads/seed/reel1.mp4',
    });
    showToast(`تم الإرسال إلى ${conv.title}`);
  }

  function showToast(msg: string) {
    setShareToast(msg);
    setTimeout(() => setShareToast(''), 2000);
  }

  async function submitTextComment(e: React.FormEvent) {
    e.preventDefault();
    if (!drawerVideo || !commentDraft.trim() || submittingComment) return;
    const raw = commentDraft.trim();
    const cleaned = raw.replace(/^(\/ai|-ai|\/)\s*/i, '').trim() || raw;
    const activeReply = replyTo;
    const shouldInvokeAi = aiMode || Boolean(activeReply?.isAi) || /^(\/ai|-ai|\/|@(lm\s*ai|ai))/i.test(raw);
    const vidId = drawerVideo.id;

    setCommentDraft('');
    setReplyTo(null);
    setAiMode(false);
    setSubmittingComment(true);
    if (shouldInvokeAi) setAiTyping(true);

    const tempComment: VideoCommentItem = {
      id: `tmp_vc_${Date.now()}`,
      videoId: vidId,
      userId: user.id,
      parentId: activeReply?.id || null,
      displayName: user.displayName,
      username: user.username,
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      avatarUrl: user.avatarUrl,
      verified: user.verified,
      aiSummoned: shouldInvokeAi,
      content: cleaned,
      audioUrl: null,
      audioDurationSec: 0,
      transcript: null,
      likesCount: 0,
      likedByMe: false,
      createdAt: 'الآن',
    };
    setComments(prev => [...prev, tempComment]);

    try {
      await apiPost(`/api/videos/${vidId}/comments`, {
        userId: user.id,
        content: cleaned,
        parentId: activeReply?.id || null,
        invokeAi: shouldInvokeAi,
      });
      const res = await apiGet<{ ok: boolean; comments: VideoCommentItem[] }>(`/api/videos/${vidId}/comments?userId=${user.id}`);
      setComments(res.comments);
      setVideos(prev => prev.map(v => (v.id === vidId ? { ...v, commentsCount: res.comments.length } : v)));
    } finally {
      setSubmittingComment(false);
      setAiTyping(false);
    }
  }

  async function submitVoiceComment(file: File, durationSec: number, liveTranscript?: string | null) {
    if (!drawerVideo) return;
    setRecordingVoice(false);
    const activeReply = replyTo;
    const shouldInvokeAi = aiMode || Boolean(activeReply?.isAi);
    const vidId = drawerVideo.id;

    setReplyTo(null);
    setAiMode(false);
    if (shouldInvokeAi) setAiTyping(true);

    try {
      const up = await apiUploadFile(file);
      await apiPost(`/api/videos/${vidId}/comments`, {
        userId: user.id,
        content: '',
        parentId: activeReply?.id || null,
        audioUrl: up.url,
        audioDurationSec: durationSec,
        transcript: liveTranscript || null,
        invokeAi: shouldInvokeAi,
      });
      const res = await apiGet<{ ok: boolean; comments: VideoCommentItem[] }>(`/api/videos/${vidId}/comments?userId=${user.id}`);
      setComments(res.comments);
      setVideos(prev => prev.map(v => (v.id === vidId ? { ...v, commentsCount: res.comments.length } : v)));
    } finally {
      setAiTyping(false);
    }
  }

  async function toggleCommentLike(commentId: string) {
    const res = await apiPost<{ ok: boolean; likesCount: number; liked: boolean }>(`/api/video-comments/${commentId}/like`, {
      userId: user.id,
    });
    setComments(prev => prev.map(c => (c.id === commentId ? { ...c, likesCount: res.likesCount, likedByMe: res.liked } : c)));
  }

  async function handleVideoUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const up = await apiUploadFile(f);
    setUploadedVideoUrl(up.url);
    e.target.value = '';
  }

  async function publishPulse(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await apiPost('/api/videos', {
      userId: user.id,
      title: newTitle.trim(),
      description: newDesc.trim(),
      videoUrl: uploadedVideoUrl || '/uploads/seed/reel1.mp4',
    });
    setUploadOpen(false);
    setNewTitle('');
    setNewDesc('');
    setUploadedVideoUrl(null);
    loadVideos();
  }

  const rootComments = comments.filter(c => !c.parentId);
  const repliesOf = (id: string) => comments.filter(c => c.parentId === id);
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      onWheel={handleSingleVideoWheel}
      className="w-full h-full bg-black relative overflow-hidden flex items-center justify-center"
    >
      <div className="relative w-full h-full max-w-[500px] mx-auto bg-black overflow-hidden">
        {/* Centered Top Tabs: متابعون | أصدقاء | لك */}
        <div className="absolute top-4 inset-x-4 z-30 flex items-center justify-between pointer-events-none">
          <button
            type="button"
            onClick={() => setMuted(m => !m)}
            className="pointer-events-auto w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/[0.12] text-white flex items-center justify-center cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="pointer-events-auto flex items-center gap-5 text-[14px] font-semibold">
            {[
              { id: 'following' as const, ar: 'متابعون', en: 'Following' },
              { id: 'friends' as const, ar: 'أصدقاء', en: 'Friends' },
              { id: 'for_you' as const, ar: 'لك', en: 'For You' },
            ].map(tab => {
              const active = feedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFeedTab(tab.id)}
                  className={`pb-1.5 relative transition-colors cursor-pointer drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] ${
                    active ? 'text-white' : 'text-white/55 hover:text-white/85'
                  }`}
                >
                  <span>{lang === 'ar' ? tab.ar : tab.en}</span>
                  {active && <span className="absolute bottom-0 inset-x-1 h-[2.5px] rounded-full bg-white" />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="pointer-events-auto w-8 h-8 rounded-full bg-white text-black flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={2.4} />
          </button>
        </div>

        {/* Live 2x Speed Pill Indicator (Appears While Long-Pressing!) */}
        {speed2x && (
          <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-xs font-mono-num font-semibold text-white flex items-center gap-1.5">
            <FastForward className="w-3.5 h-3.5 fill-current" />
            <span>2x</span>
          </div>
        )}

        {/* Full-Screen Vertical Pulse Feed (Strictly 1 Video Per Scroll Flick on Laptop & Touch!) */}
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
            if (nextIdx > prevSlideIdxRef.current) {
              setBottomDockHidden(true);
            } else if (nextIdx < prevSlideIdxRef.current) {
              setBottomDockHidden(false);
            }
            prevSlideIdxRef.current = nextIdx;
            setActiveIndex(nextIdx);
          }}
          className="w-full h-full"
        >
          {orderedVideos.map((v, idx) => {
            const isLong = v.title.length > 78;
            const isExpanded = Boolean(expandedCaptions[v.id]);

            return (
              <SwiperSlide key={`${feedTab}-${v.id}`} className="w-full h-full relative bg-black">
                <div
                  onPointerDown={handleStagePointerDown}
                  onPointerUp={releaseLongPressSpeed}
                  onPointerLeave={releaseLongPressSpeed}
                  onPointerCancel={releaseLongPressSpeed}
                  onClick={e => handleStageClick(e, v)}
                  className="w-full h-full relative cursor-pointer"
                >
                  <video
                    ref={el => {
                      videoRefs.current[idx] = el;
                    }}
                    src={v.videoUrl || '/uploads/seed/reel1.mp4'}
                    poster={v.posterUrl || undefined}
                    loop
                    playsInline
                    muted={muted}
                    onTimeUpdate={e => {
                      if (idx === activeIndex && !isScrubbing) {
                        setCurrentTime(e.currentTarget.currentTime);
                        if (e.currentTarget.duration) setDuration(e.currentTarget.duration);
                      }
                    }}
                    onLoadedMetadata={e => {
                      if (idx === activeIndex && e.currentTarget.duration) {
                        setDuration(e.currentTarget.duration);
                      }
                    }}
                    className="w-full h-full object-cover"
                  />

                  {idx === activeIndex && <TapBurstOverlay items={bursts} />}

                  {/* Modern Organic Curved Translucent Play Icon (Zero old sharp triangle!) */}
                  {idx === activeIndex && paused && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                      <PulsePlayGlyph className="w-[72px] h-[72px] drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]" />
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                  {/* Bottom Metadata with Expandable "المزيد / أقل" */}
                  <div
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    className="absolute bottom-24 md:bottom-10 start-4 end-16 z-20 text-start space-y-1"
                  >
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <span>@{v.username}</span>
                      {v.verified && <VerifiedIcon />}
                    </div>

                    <div className="text-[13.5px] text-white/95 leading-snug">
                      {isLong && !isExpanded ? (
                        <>
                          <span>{v.title.slice(0, 74)}... </span>
                          <button
                            type="button"
                            onClick={() => setExpandedCaptions(prev => ({ ...prev, [v.id]: true }))}
                            className="text-white/75 hover:text-white font-semibold cursor-pointer"
                          >
                            المزيد
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{v.title}</span>
                          {isLong && (
                            <button
                              type="button"
                              onClick={() => setExpandedCaptions(prev => ({ ...prev, [v.id]: false }))}
                              className="ms-1.5 text-white/75 hover:text-white font-semibold cursor-pointer"
                            >
                              أقل
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {v.tags && (isExpanded || !isLong) && <p className="text-xs text-white/65">{v.tags}</p>}

                    <div className="flex items-center gap-2 text-xs text-white/80 pt-0.5">
                      <Music2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{v.audioTitle}</span>
                    </div>
                  </div>

                  {/* Right Action Rail (Static Audio Icon) */}
                  <div
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    className="absolute bottom-24 md:bottom-10 end-3 z-20 flex flex-col items-center gap-4"
                  >
                    <UserAvatar initials={v.avatarInitials} avatarUrl={v.avatarUrl} size={42} />

                    <button type="button" onClick={() => toggleLike(v)} className="flex flex-col items-center gap-1 cursor-pointer">
                      <Heart
                        className={`w-7 h-7 ${v.likedByMe ? 'text-[#FF2D55] fill-current' : 'text-white'}`}
                        strokeWidth={1.9}
                      />
                      <span className="text-[11px] font-mono-num text-white">{compactNum(v.likesCount)}</span>
                    </button>

                    <button type="button" onClick={() => openComments(v)} className="flex flex-col items-center gap-1 cursor-pointer">
                      <MessageCircle className="w-7 h-7 text-white" strokeWidth={1.9} />
                      <span className="text-[11px] font-mono-num text-white">{compactNum(v.commentsCount)}</span>
                    </button>

                    <button type="button" onClick={() => toggleSave(v)} className="flex flex-col items-center gap-1 cursor-pointer">
                      <Bookmark
                        className={`w-6 h-6 ${v.savedByMe ? 'text-[#FACC15] fill-current' : 'text-white'}`}
                        strokeWidth={1.9}
                      />
                      <span className="text-[11px] font-mono-num text-white">{compactNum(v.savesCount)}</span>
                    </button>

                    <button type="button" onClick={() => openShareSheet(v)} className="flex flex-col items-center gap-1 cursor-pointer">
                      <Share2 className="w-6 h-6 text-white" strokeWidth={1.9} />
                      <span className="text-[11px] font-mono-num text-white">{compactNum(v.sharesCount)}</span>
                    </button>

                    <div className="w-9 h-9 rounded-xl bg-[#16161B] border border-white/20 flex items-center justify-center">
                      <Music2 className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Minimal 2px Passive Progress Hairline (Zero Seek Bar Clutter!) */}
                  {idx === activeIndex && (
                    <div className="pointer-events-none absolute bottom-0 inset-x-0 h-[2px] bg-white/15 z-20">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="h-full bg-white/80 transition-[width] duration-150"
                      />
                    </div>
                  )}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>

        {shareToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-[#16161C]/95 border border-white/15 text-xs text-white shadow-xl">
            {shareToast}
          </div>
        )}

        {/* FULL TIKTOK BOTTOM SHARE SHEET (Centered Inside Video Stage Like Live — ZERO X Button!) */}
        {shareVideo && (
          <div onClick={() => setShareVideo(null)} className="absolute inset-0 z-50 bg-black/65 flex items-end justify-center">
            <div
              onClick={e => e.stopPropagation()}
              className="w-full rounded-t-[26px] bg-[#131318]/97 backdrop-blur-2xl border-t border-white/[0.12] pb-6 pt-2.5 px-4 space-y-4"
            >
            {/* Drag Handle Pill (NO X Button!) */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-1 rounded-full bg-white/25" />
              <span className="text-xs font-semibold text-white">مشاركة إلى</span>
            </div>

            {/* Row 1: Direct LM Contacts */}
            {contacts.length > 0 && (
              <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pb-1">
                {contacts.map(c => {
                  const sent = Boolean(sentToIds[c.id]);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => sendPulseToContact(c)}
                      className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer"
                    >
                      <div className="relative">
                        <UserAvatar initials={c.title.slice(0, 2)} avatarUrl={c.avatarUrl} size={46} />
                        <span
                          className={`absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#131318] ${
                            sent ? 'bg-[#22C55E] text-black' : 'bg-white text-black'
                          }`}
                        >
                          {sent ? <Check className="w-3 h-3" strokeWidth={2.5} /> : <Send className="w-2.5 h-2.5" />}
                        </span>
                      </div>
                      <span className="text-[10.5px] text-[#D4D4D8] truncate w-full text-center">{c.title.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Row 2: Authentic Vector Brand Icons (ZERO Emojis!) */}
            <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pt-2 border-t border-white/[0.07]">
              {SHARE_PLATFORMS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    showToast(p.id === 'copy' ? 'تم نسخ الرابط' : `مشاركة عبر ${p.label}`);
                    setShareVideo(null);
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
                >
                  <div
                    style={{ backgroundColor: p.bg }}
                    className="w-11 h-11 rounded-full flex items-center justify-center border border-white/[0.08]"
                  >
                    {SharePlatformIcons[p.id]}
                  </div>
                  <span className="text-[10.5px] text-[#A1A1AA] truncate w-full text-center">{p.label}</span>
                </button>
              ))}
            </div>

            {/* Row 3: Quick Actions */}
            <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pt-2 border-t border-white/[0.07]">
              {[
                {
                  id: 'repost',
                  label: 'إعادة نشر',
                  icon: Repeat2,
                  action: () => {
                    showToast('تمت إعادة النشر');
                    setShareVideo(null);
                  },
                },
                {
                  id: 'download',
                  label: 'حفظ الفيديو',
                  icon: Download,
                  action: () => {
                    const a = document.createElement('a');
                    a.href = shareVideo.videoUrl || '/uploads/seed/reel1.mp4';
                    a.download = `lm-pulse-${shareVideo.id}.mp4`;
                    a.click();
                    showToast('بدأ تنزيل الفيديو');
                    setShareVideo(null);
                  },
                },
                {
                  id: 'link',
                  label: 'نسخ',
                  icon: Link2,
                  action: () => {
                    navigator.clipboard?.writeText(window.location.href);
                    showToast('تم نسخ الرابط');
                    setShareVideo(null);
                  },
                },
                {
                  id: 'not_interested',
                  label: 'غير مهتم',
                  icon: EyeOff,
                  action: () => {
                    showToast('سنعرض محتوى أقل مشابهًا');
                    setShareVideo(null);
                  },
                },
                {
                  id: 'report',
                  label: 'إبلاغ',
                  icon: Flag,
                  action: () => {
                    showToast('تم استلام البلاغ للمراجعة');
                    setShareVideo(null);
                  },
                },
              ].map(act => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={act.action}
                    className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-[#E4E4E7] flex items-center justify-center transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10.5px] text-[#A1A1AA] truncate w-full text-center">{act.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Comments & Voice-Replies & AI Sheet (Centered Dead-On Over Video Column Like Live — Floating Composer!) */}
      {drawerVideo && (
        <div
          onClick={() => {
            setDrawerVideo(null);
            setRecordingVoice(false);
          }}
          className="absolute inset-0 z-50 bg-black/65 flex items-end justify-center"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full h-[72%] rounded-t-[26px] bg-[#121216]/97 backdrop-blur-2xl border-t border-x border-white/[0.12] flex flex-col overflow-hidden"
          >
            <div className="px-4 pt-2.5 pb-3 border-b border-white/[0.08] flex flex-col items-center gap-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/25" />
              <span className="text-xs font-semibold text-white">{comments.length} تعليق</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-4">
              {rootComments.map(c => {
                const sub = repliesOf(c.id);
                return (
                  <div key={c.id} className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <UserAvatar initials={c.avatarInitials} avatarUrl={c.avatarUrl} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs flex-wrap">
                          <span className="font-semibold text-[#F2F2F5]">{c.displayName}</span>
                          {c.verified && <VerifiedIcon />}
                          {c.isAi && <AiSummonBadge label="LM AI" compact />}
                          {!c.isAi && c.aiSummoned && <AiSummonBadge label="AI" compact />}
                          <span className="text-[#7A7A85]">{c.createdAt}</span>
                        </div>
                        {c.audioUrl ? (
                          <div
                            className={`mt-1.5 p-2.5 rounded-2xl border ${
                              c.aiSummoned ? 'lm-ai-summon-ring' : 'bg-[#1A1A20] border-white/[0.08]'
                            }`}
                          >
                            <SmartVoicePill
                              url={c.audioUrl}
                              transcript={c.transcript}
                              recordId={c.id}
                              table="video_comments"
                              accent={c.aiSummoned ? 'ai' : 'default'}
                              compact
                            />
                          </div>
                        ) : c.isAi ? (
                          <div className="text-[13.5px] text-[#E4E4E7] mt-0.5 leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_LINK_COMPONENTS}>
                              {c.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="text-[13.5px] text-[#E4E4E7] mt-0.5 leading-relaxed">
                            <RichMessageText text={c.content} />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo({
                              id: c.id,
                              name: c.displayName,
                              snippet: c.audioUrl ? (c.transcript || 'رسالة صوتية') : c.content.slice(0, 56),
                              isAi: Boolean(c.isAi),
                            });
                            if (c.isAi) setAiMode(true);
                          }}
                          className="mt-1.5 text-[11px] text-[#7A7A85] hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          <CornerDownLeft className="w-3 h-3" />
                          <span>{c.isAi ? 'الرد على AI' : 'رد'}</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCommentLike(c.id)}
                        className="flex flex-col items-center gap-0.5 text-[#7A7A85] hover:text-white cursor-pointer"
                      >
                        <Heart className={`w-4 h-4 ${c.likedByMe ? 'text-[#FF2D55] fill-current' : ''}`} />
                        <span className="text-[10px] font-mono-num">{c.likesCount}</span>
                      </button>
                    </div>

                    {sub.length > 0 && (
                      <div className="ms-4 ps-3.5 border-s border-white/[0.1] space-y-2.5">
                        {sub.map(rep => (
                          <div key={rep.id} className="flex items-start gap-2">
                            <UserAvatar initials={rep.avatarInitials} avatarUrl={rep.avatarUrl} size={24} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 text-[11.5px] flex-wrap">
                                <span className="font-semibold text-[#F2F2F5]">{rep.displayName}</span>
                                {rep.isAi && <AiSummonBadge label="LM AI" compact />}
                                {!rep.isAi && rep.aiSummoned && <AiSummonBadge label="AI" compact />}
                                <span className="text-[#7A7A85]">{rep.createdAt}</span>
                              </div>
                              {rep.audioUrl ? (
                                <div
                                  className={`mt-1 p-2 rounded-xl border ${
                                    rep.aiSummoned ? 'lm-ai-summon-ring' : 'bg-[#1A1A20] border-white/[0.08]'
                                  }`}
                                >
                                  <SmartVoicePill
                                    url={rep.audioUrl}
                                    transcript={rep.transcript}
                                    recordId={rep.id}
                                    table="video_comments"
                                    accent={rep.aiSummoned ? 'ai' : 'default'}
                                    compact
                                  />
                                </div>
                              ) : rep.isAi ? (
                                <div className="text-[13px] text-[#D4D4D8] mt-0.5 leading-relaxed">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_LINK_COMPONENTS}>
                                    {rep.content}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <div className="text-[13px] text-[#D4D4D8] mt-0.5">
                                  <RichMessageText text={rep.content} />
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyTo({
                                    id: rep.id,
                                    name: rep.displayName,
                                    snippet: rep.audioUrl ? (rep.transcript || 'رسالة صوتية') : rep.content.slice(0, 56),
                                    isAi: Boolean(rep.isAi),
                                  });
                                  if (rep.isAi) setAiMode(true);
                                }}
                                className="mt-1 text-[10.5px] text-[#7A7A85] hover:text-white flex items-center gap-1 cursor-pointer"
                              >
                                <CornerDownLeft className="w-2.5 h-2.5" />
                                <span>{rep.isAi ? 'الرد على AI' : 'رد'}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Live LM AI Typing Indicator inside Pulse Comments */}
              {aiTyping && (
                <div className="flex items-center gap-2.5 ps-2 py-1">
                  <UserAvatar initials="AI" avatarUrl={null} size={24} />
                  <div className="px-3 py-1.5 rounded-2xl bg-[#181820] border border-white/[0.13] text-xs text-[#D4D4D8] flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-white animate-pulse" />
                    <span>LM AI يكتب الآن</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-white/75 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1 h-1 rounded-full bg-white/75 animate-bounce [animation-delay:140ms]" />
                      <span className="w-1 h-1 rounded-full bg-white/75 animate-bounce [animation-delay:280ms]" />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* FLOATING Comment Composer + Side-Aligned Reply Card (ZERO Solid Bottom Bar!) */}
            <div className="pointer-events-none absolute bottom-3 inset-x-3 z-20 flex flex-col gap-2">
              {replyTo && (
                <div className="pointer-events-auto w-fit max-w-[280px] self-start rounded-2xl bg-[#16161D]/96 backdrop-blur-xl border border-white/[0.12] px-3 py-1.5 flex items-center gap-2.5 shadow-xl">
                  <span className="w-[2.5px] self-stretch rounded-full shrink-0 bg-white/50" />
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-semibold text-white truncate">الرد على {replyTo.name}</div>
                    {replyTo.snippet && (
                      <div className="text-[11px] text-[#9E9EA8] truncate max-w-[185px]">{replyTo.snippet}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="w-5 h-5 rounded-full bg-white/[0.07] hover:bg-white/[0.15] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="pointer-events-auto">
                {recordingVoice ? (
                  <LiveVoiceRecorder
                    onCancel={() => setRecordingVoice(false)}
                    onSend={submitVoiceComment}
                  />
                ) : (
                  <ObsidianComposerPill
                    value={commentDraft}
                    onChange={setCommentDraft}
                    onSubmit={submitTextComment}
                    placeholder={aiMode ? 'اسأل الذكاء الاصطناعي...' : lang === 'ar' ? 'أضف تعليقًا...' : 'Add comment...'}
                    extraEnd={
                      <button
                        type="button"
                        onClick={() => setAiMode(v => !v)}
                        title="استدعاء الذكاء الاصطناعي"
                        className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                          aiMode
                            ? 'bg-white/[0.15] text-white border border-white/25'
                            : 'text-[#7A7A85] hover:text-white'
                        }`}
                      >
                        <NavAiIcon active={aiMode} className="w-[17px] h-[17px]" />
                      </button>
                    }
                    customAction={
                      commentDraft.trim() ? (
                        <ChromeArrowButton type="submit" disabled={submittingComment} size={36} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRecordingVoice(true)}
                          title="رد صوتي"
                          className="chrome-rim-btn w-[36px] h-[36px] shrink-0 cursor-pointer"
                        >
                          <span className="chrome-rim-btn-inner text-[#D4D4D8] hover:text-white transition-colors">
                            <Mic className="w-[16px] h-[16px]" strokeWidth={1.9} />
                          </span>
                        </button>
                      )
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Upload Pulse Modal (Tap Outside to Close) */}
      {uploadOpen && (
        <div onClick={() => setUploadOpen(false)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={publishPulse}
            className="w-full max-w-[400px] rounded-2xl bg-[#131318] border border-white/[0.12] p-5 space-y-3"
          >
            <div className="pb-2 border-b border-white/[0.08] text-center">
              <span className="text-sm font-semibold text-white">نشر نبض جديد</span>
            </div>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="العنوان..."
              className="w-full h-11 rounded-xl bg-[#0A0A0C] border border-white/[0.1] px-3.5 text-xs text-white outline-none"
            />
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="الوسوم..."
              className="w-full h-11 rounded-xl bg-[#0A0A0C] border border-white/[0.1] px-3.5 text-xs text-white outline-none"
            />
            <input ref={fileRef} type="file" accept="video/*" onChange={handleVideoUploadFile} className="hidden" />
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3.5 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs text-[#E4E4E7] cursor-pointer"
              >
                {uploadedVideoUrl ? 'تم إرفاق الفيديو ✓' : 'اختيار فيديو'}
              </button>
              <ChromeArrowButton type="submit" disabled={!newTitle.trim()} size={38} />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
