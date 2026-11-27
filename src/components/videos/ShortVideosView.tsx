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
  Languages,
  RefreshCw,
  Film,
  ChevronRight,
  Camera,
  Hash,
  Monitor,
  Smartphone,
} from 'lucide-react';

import { ConversationItem, Lang, ShortVideoItem, UserProfile, VideoCommentItem } from '../../types';
import { AiSummonBadge, MARKDOWN_LINK_COMPONENTS, RichMessageText, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ObsidianComposerPill, ChromeArrowButton } from '../shared/HardwareUI';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { TapBurstItem, TapBurstOverlay, createTapBurst } from '../shared/TapComboBurst';
import { NavAiIcon, PulsePlayGlyph, SharePlatformIcons, StylusEditIcon } from '../shared/Icons2026Pro';
import { ActionMenuOrb, QuickRemovePill } from '../shared/ActionOrb2026';
import { CloseOrbButton, PublishActionButton, StudioModalOverlay } from '../shared/ModalChrome2026';
import { ReportContentModal, ReportRequest, SensitiveCommentShield, SensitiveMediaShield } from '../shared/SensitiveShield';
import { CommentListSkeleton, EmptyState2026 } from '../shared/EmptyState2026';
import { useLayout } from '../../context/LayoutContext';
import { api, apiGet, apiPost, apiUploadFile } from '../../lib/api';
import { t } from '../../lib/i18n';

const PULSE_TRANSLATE_LANGS = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'tr', label: 'Türkçe' },
];

interface ShortVideosViewProps {
  user: UserProfile;
  lang: Lang;
  focusedVideoId?: string | null;
  onOpenProfile?: (userId: string) => void;
  onOpenProfileByUsername?: (username: string) => void;
  onOpenHashtag?: (tag: string) => void;
}

/**
 * Generates a crisp JPEG thumbnail File from a user-selected video File right in the browser!
 */
async function generateVideoThumbnail(
  videoFile: File
): Promise<{ file: File | null; orientation: 'portrait' | 'landscape' }> {
  return new Promise(resolve => {
    const objectUrl = URL.createObjectURL(videoFile);
    const vid = document.createElement('video');
    vid.preload = 'auto';
    vid.muted = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';
    vid.src = objectUrl;

    let done = false;
    const finish = (file: File | null, orientation: 'portrait' | 'landscape' = 'portrait') => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(objectUrl);
      resolve({ file, orientation });
    };

    const timeout = window.setTimeout(() => finish(null, 'portrait'), 6000);

    const captureFrame = () => {
      try {
        const w = vid.videoWidth || 720;
        const h = vid.videoHeight || 1280;
        const detectedOrient: 'portrait' | 'landscape' = w > h * 1.08 ? 'landscape' : 'portrait';
        const scale = Math.min(1, 720 / Math.max(w, 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(160, Math.round(w * scale));
        canvas.height = Math.max(160, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null, detectedOrient);
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          blob => {
            window.clearTimeout(timeout);
            if (!blob) return finish(null, detectedOrient);
            finish(new File([blob], `pulse_thumb_${Date.now()}.jpg`, { type: 'image/jpeg' }), detectedOrient);
          },
          'image/jpeg',
          0.86
        );
      } catch {
        window.clearTimeout(timeout);
        finish(null, 'portrait');
      }
    };

    vid.onloadeddata = () => {
      const targetTime = Number.isFinite(vid.duration) && vid.duration > 0.6 ? Math.min(0.9, vid.duration * 0.22) : 0.05;
      try {
        vid.currentTime = targetTime;
      } catch {
        captureFrame();
      }
    };
    vid.onseeked = captureFrame;
    vid.onerror = () => {
      window.clearTimeout(timeout);
      finish(null, 'portrait');
    };
  });
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

export function ShortVideosView({
  user,
  lang,
  focusedVideoId = null,
  onOpenProfile,
  onOpenProfileByUsername,
  onOpenHashtag,
}: ShortVideosViewProps) {
  const { bottomDockHidden, setBottomDockHidden } = useLayout();
  const [videos, setVideos] = useState<ShortVideoItem[]>([]);
  const [videoBuffering, setVideoBuffering] = useState(false);
  const likeInFlightRef = useRef<Record<string, boolean>>({});
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
  const [muted, setMuted] = useState(false);
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
    if (drawerVideo || shareVideo || uploadOpen || editingVideo || reportRequest) return;
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

  // Comments Sheet (Instant cache + loading skeleton — NEVER flashes 0 comments while loading!)
  const [drawerVideo, setDrawerVideo] = useState<ShortVideoItem | null>(null);
  const [comments, setComments] = useState<VideoCommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentsCacheRef = useRef<Record<string, VideoCommentItem[]>>({});
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

  // Full-Screen 2-Step TikTok Creator Studio (Step 1: Camera + Gallery Picker -> Step 2: Unified Caption Publish Screen)
  const [uploadOpen, setUploadOpen] = useState(false);
  const [studioStep, setStudioStep] = useState<'capture' | 'publish'>('capture');
  const [studioDurationSec, setStudioDurationSec] = useState<15 | 60 | 180>(60);
  const [studioOrientation, setStudioOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isRecordingClip, setIsRecordingClip] = useState(false);
  const [recordElapsedSec, setRecordElapsedSec] = useState(0);
  const studioVideoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const studioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newTags, setNewTags] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [uploadedPosterUrl, setUploadedPosterUrl] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [publishingVideo, setPublishingVideo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const posterFileRef = useRef<HTMLInputElement | null>(null);

  const stopStudioCamera = useCallback(() => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    setIsRecordingClip(false);
    setRecordElapsedSec(0);
    if (studioStreamRef.current) {
      studioStreamRef.current.getTracks().forEach(tr => tr.stop());
      studioStreamRef.current = null;
    }
    if (studioVideoPreviewRef.current) {
      studioVideoPreviewRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const closeCreatorStudio = useCallback(() => {
    stopStudioCamera();
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    setUploadOpen(false);
    setStudioStep('capture');
    setNewTitle('');
    setNewTags('');
    setUploadedVideoUrl(null);
    setUploadedPosterUrl(null);
    setCameraError('');
  }, [stopStudioCamera, localPreviewUrl]);

  useEffect(() => {
    if (!uploadOpen || studioStep !== 'capture') {
      stopStudioCamera();
      return;
    }
    let cancelled = false;
    setCameraError('');
    setCameraReady(false);

    async function bootCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(lang === 'en' ? 'Camera unavailable on this device. Choose a video from Gallery.' : 'الكاميرا غير متاحة على هذا الجهاز — يمكنك اختيار فيديو من المعرض.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video:
            studioOrientation === 'landscape'
              ? { facingMode: { ideal: cameraFacing }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { facingMode: { ideal: cameraFacing }, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach(tr => tr.stop());
          return;
        }
        studioStreamRef.current = stream;
        if (studioVideoPreviewRef.current) {
          studioVideoPreviewRef.current.srcObject = stream;
          studioVideoPreviewRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch {
        if (!cancelled) {
          setCameraError(lang === 'en' ? 'Camera permission skipped — tap Gallery below to pick any video.' : 'يمكنك السماح بالكاميرا للتصوير أو اختيار فيديو مباشرة من المعرض بالأسفل.');
        }
      }
    }

    bootCamera();
    return () => {
      cancelled = true;
      stopStudioCamera();
    };
  }, [uploadOpen, studioStep, cameraFacing, studioOrientation, lang, stopStudioCamera]);

  // Edit Own Pulse Comment Inline
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);

  // Interactive Bottom Scrubber Hover/Drag State
  const [scrubHover, setScrubHover] = useState(false);
  const scrubberBarRef = useRef<HTMLDivElement | null>(null);

  // Edit Own Pulse Video Modal
  const [editingVideo, setEditingVideo] = useState<ShortVideoItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Sensitive Content Blur & Universal Reporting
  const [reportRequest, setReportRequest] = useState<ReportRequest | null>(null);
  const [revealedVideos, setRevealedVideos] = useState<Record<string, boolean>>({});
  const [revealedComments, setRevealedComments] = useState<Record<string, boolean>>({});

  // Inline Multi-Language Comment Translation
  const [commentTranslations, setCommentTranslations] = useState<Record<string, { text: string; lang: string }>>({});
  const [translatingCommentId, setTranslatingCommentId] = useState<string | null>(null);
  const [commentLangMenuId, setCommentLangMenuId] = useState<string | null>(null);

  async function translatePulseComment(commentId: string, text: string, targetLang: string) {
    if (!text.trim()) return;
    setCommentLangMenuId(null);
    setTranslatingCommentId(commentId);
    try {
      const res = await apiPost<{ ok: boolean; translated: string }>('/api/translate', { text, targetLang });
      if (res.translated) {
        setCommentTranslations(prev => ({
          ...prev,
          [commentId]: { text: res.translated, lang: targetLang },
        }));
      }
    } catch {
      // ignore
    } finally {
      setTranslatingCommentId(cur => (cur === commentId ? null : cur));
    }
  }

  const loadVideos = useCallback(async () => {
    const res = await apiGet<{ ok: boolean; videos: ShortVideoItem[] }>(`/api/videos?userId=${user.id}`);
    setVideos(res.videos);
  }, [user.id]);

  async function followCreator(creatorId: string) {
    if (creatorId === user.id) return;
    setVideos(prev =>
      prev.map(item => (item.userId === creatorId ? { ...item, isFollowingAuthor: true } : item))
    );
    try {
      const res = await apiPost<{ ok: boolean; following: boolean }>(`/api/users/${creatorId}/follow`, {
        followerId: user.id,
      });
      setVideos(prev =>
        prev.map(item => (item.userId === creatorId ? { ...item, isFollowingAuthor: res.following } : item))
      );
      if (res.following) showToast('تمت المتابعة');
    } catch {
      loadVideos();
    }
  }

  useEffect(() => {
    loadVideos();
    return () => setBottomDockHidden(false);
  }, [loadVideos, setBottomDockHidden]);

  const orderedVideos = React.useMemo(() => {
    if (feedTab === 'following') {
      const followed = videos.filter(v => v.isFollowingAuthor || v.userId === user.id);
      return followed.length > 0 ? followed : [...videos].reverse();
    }
    if (feedTab === 'friends') return videos.slice(1).concat(videos.slice(0, 1));
    return videos;
  }, [videos, feedTab, user.id]);

  // Deep-link jump when opened via /pulse/:id
  useEffect(() => {
    if (!focusedVideoId || orderedVideos.length === 0) return;
    const targetIdx = orderedVideos.findIndex(v => v.id === focusedVideoId);
    if (targetIdx >= 0) {
      setActiveIndex(targetIdx);
      swiperRef.current?.slideTo(targetIdx, 0);
    }
  }, [focusedVideoId, orderedVideos, setActiveIndex]);

  useEffect(() => {
    setPaused(false);
    setSpeed2x(false);
    setCurrentTime(0);
    setVideoBuffering(true);
    Object.entries(videoRefs.current).forEach(([idxStr, el]) => {
      if (!el) return;
      el.playbackRate = 1;
      if (Number(idxStr) === activeIndex) {
        el.currentTime = 0;
        const p = el.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // Mobile browsers block unmuted autoplay — smoothly fall back to muted play so video NEVER freezes!
            el.muted = true;
            setMuted(true);
            el.play().catch(() => {
              setVideoBuffering(false);
            });
          });
        }
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
    // Strictly 1 like per user account: double-tapping an already-liked video plays animation WITHOUT duplicating likes!
    if (forceLike && v.likedByMe) return;
    if (likeInFlightRef.current[v.id]) return;
    likeInFlightRef.current[v.id] = true;

    const optimisticLiked = forceLike ? true : !v.likedByMe;
    const optimisticDelta = optimisticLiked === v.likedByMe ? 0 : optimisticLiked ? 1 : -1;
    if (optimisticDelta !== 0) {
      setVideos(prev =>
        prev.map(item =>
          item.id === v.id
            ? {
                ...item,
                likedByMe: optimisticLiked,
                likesCount: Math.max(0, item.likesCount + optimisticDelta),
              }
            : item
        )
      );
    }

    try {
      const res = await apiPost<{ ok: boolean; liked: boolean; likesCount?: number }>(`/api/videos/${v.id}/like`, {
        userId: user.id,
        forceLike,
      });
      setVideos(prev =>
        prev.map(item =>
          item.id === v.id
            ? {
                ...item,
                likedByMe: res.liked,
                likesCount: typeof res.likesCount === 'number' ? res.likesCount : item.likesCount,
              }
            : item
        )
      );
    } catch {
      loadVideos();
    } finally {
      likeInFlightRef.current[v.id] = false;
    }
  }

  function trackPulseShare(videoId: string, channel: string) {
    apiPost<{ ok: boolean; counted: boolean; sharesCount: number }>('/api/shares/track', {
      targetType: 'video',
      targetId: videoId,
      userId: user.id,
      channel,
    })
      .then(res => {
        if (res.ok) {
          setVideos(prev =>
            prev.map(item => (item.id === videoId ? { ...item, sharesCount: res.sharesCount } : item))
          );
        }
      })
      .catch(() => {});
  }

  async function toggleSave(v: ShortVideoItem) {
    const nextSaved = !v.savedByMe;
    setVideos(prev =>
      prev.map(item =>
        item.id === v.id
          ? {
              ...item,
              savedByMe: nextSaved,
              savesCount: Math.max(0, item.savesCount + (nextSaved ? 1 : -1)),
            }
          : item
      )
    );
    try {
      const res = await apiPost<{ ok: boolean; saved: boolean }>(`/api/videos/${v.id}/save`, { userId: user.id });
      if (res.saved !== nextSaved) {
        setVideos(prev =>
          prev.map(item =>
            item.id === v.id
              ? {
                  ...item,
                  savedByMe: res.saved,
                  savesCount: Math.max(0, item.savesCount + (res.saved ? 1 : -1)),
                }
              : item
          )
        );
      }
    } catch {
      loadVideos();
    }
  }

  async function openComments(v: ShortVideoItem) {
    setDrawerVideo(v);
    const cached = commentsCacheRef.current[v.id];
    if (cached) {
      setComments(cached);
      setLoadingComments(false);
    } else {
      setComments([]);
      setLoadingComments(true);
    }
    try {
      const res = await apiGet<{ ok: boolean; comments: VideoCommentItem[] }>(`/api/videos/${v.id}/comments?userId=${user.id}`);
      commentsCacheRef.current[v.id] = res.comments;
      setComments(res.comments);
    } finally {
      setLoadingComments(false);
    }
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
    trackPulseShare(shareVideo.id, 'lm_chat');
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
      const up = await apiUploadFile(file, 'voice');
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
    setComments(prev =>
      prev.map(c =>
        c.id === commentId
          ? {
              ...c,
              likedByMe: !c.likedByMe,
              likesCount: Math.max(0, c.likesCount + (c.likedByMe ? -1 : 1)),
            }
          : c
      )
    );
    try {
      const res = await apiPost<{ ok: boolean; likesCount: number; liked: boolean }>(`/api/video-comments/${commentId}/like`, {
        userId: user.id,
      });
      setComments(prev => prev.map(c => (c.id === commentId ? { ...c, likesCount: res.likesCount, likedByMe: res.liked } : c)));
    } catch {
      // ignore
    }
  }

  async function saveEditedComment(commentId: string) {
    if (!editingCommentText.trim() || savingCommentEdit) return;
    setSavingCommentEdit(true);
    try {
      const clean = editingCommentText.trim();
      await api(`/api/video-comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ userId: user.id, content: clean }),
      });
      setComments(prev => prev.map(c => (c.id === commentId ? { ...c, content: clean, isEdited: true } : c)));
      setEditingCommentId(null);
      setEditingCommentText('');
    } finally {
      setSavingCommentEdit(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!drawerVideo) return;
    await api(`/api/video-comments/${commentId}?userId=${user.id}`, { method: 'DELETE' });
    setComments(prev => {
      const next = prev.filter(c => c.id !== commentId && c.parentId !== commentId);
      setVideos(vids => vids.map(v => (v.id === drawerVideo.id ? { ...v, commentsCount: next.length } : v)));
      return next;
    });
  }

  function scrubFromPointer(clientX: number) {
    const bar = scrubberBarRef.current;
    if (!bar || duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(rect.width, 1)));
    scrubTo(ratio * duration);
  }

  async function processSelectedVideoFile(f: File, keepChosenOrient = false) {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const previewObj = URL.createObjectURL(f);
    setLocalPreviewUrl(previewObj);
    setStudioStep('publish');
    setUploadingVideo(true);
    setGeneratingThumb(true);
    try {
      const [upVideo, thumbResult] = await Promise.all([apiUploadFile(f, 'pulse_video'), generateVideoThumbnail(f)]);
      setUploadedVideoUrl(upVideo.url);
      if (!keepChosenOrient) {
        setStudioOrientation(thumbResult.orientation);
      }
      if (thumbResult.file) {
        const upThumb = await apiUploadFile(thumbResult.file, 'pulse_poster');
        setUploadedPosterUrl(upThumb.url);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر رفع الفيديو.');
    } finally {
      setUploadingVideo(false);
      setGeneratingThumb(false);
    }
  }

  async function handleVideoUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    await processSelectedVideoFile(f);
  }

  function toggleStudioRecording() {
    if (isRecordingClip) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      setIsRecordingClip(false);
      return;
    }

    const stream = studioStreamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      fileRef.current?.click();
      return;
    }

    try {
      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = ev => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const chunks = recordedChunksRef.current;
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `lm_pulse_${Date.now()}.${ext}`, { type: blob.type });
        void processSelectedVideoFile(file, true);
      };

      recorder.start(250);
      setIsRecordingClip(true);
      setRecordElapsedSec(0);
      const startedAt = Date.now();
      recordTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setRecordElapsedSec(elapsed);
        if (elapsed >= studioDurationSec && recorder.state !== 'inactive') {
          recorder.stop();
          if (recordTimerRef.current) {
            window.clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
          }
          setIsRecordingClip(false);
        }
      }, 250);
    } catch {
      fileRef.current?.click();
    }
  }

  async function handleManualPosterFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setGeneratingThumb(true);
    try {
      const up = await apiUploadFile(f, 'pulse_poster');
      setUploadedPosterUrl(up.url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر رفع صورة الغلاف.');
    } finally {
      setGeneratingThumb(false);
      e.target.value = '';
    }
  }

  async function publishPulse(e: React.FormEvent) {
    e.preventDefault();
    if ((!newTitle.trim() && !uploadedVideoUrl) || uploadingVideo || publishingVideo) return;
    setPublishingVideo(true);
    try {
      const extractedTags = (newTitle.match(/#[\p{L}\p{N}_]+/gu) || []).join(' ');
      await apiPost('/api/videos', {
        userId: user.id,
        title: newTitle.trim(),
        description: '',
        tags: newTags.trim() || extractedTags || '#LM',
        videoUrl: uploadedVideoUrl || '/uploads/seed/reel1.mp4',
        posterUrl: uploadedPosterUrl,
        orientation: studioOrientation,
      });
      closeCreatorStudio();
      await loadVideos();
      setActiveIndex(0);
      swiperRef.current?.slideTo(0, 0);
      showToast('تم نشر الفيديو بنجاح');
    } finally {
      setPublishingVideo(false);
    }
  }

  function openEditVideoModal(v: ShortVideoItem) {
    setEditingVideo(v);
    setEditTitle(v.title);
    setEditDesc(v.description || '');
    setEditTags(v.tags || '');
  }

  async function saveEditedVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!editingVideo || !editTitle.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await api<{ ok: boolean; video: ShortVideoItem }>(`/api/videos/${editingVideo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          userId: user.id,
          title: editTitle.trim(),
          description: editDesc.trim(),
          tags: editTags.trim(),
        }),
      });
      if (res.video) {
        setVideos(prev => prev.map(v => (v.id === editingVideo.id ? { ...v, ...res.video } : v)));
      }
      setEditingVideo(null);
      showToast('تم حفظ تعديلات الفيديو');
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteOwnVideo(videoId: string) {
    await api(`/api/videos/${videoId}?userId=${user.id}`, { method: 'DELETE' });
    setVideos(prev => prev.filter(v => v.id !== videoId));
    showToast('تمت إزالة الفيديو');
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
        {/* Centered Top Tabs: Safe Top Inset + متابعون | أصدقاء | لك */}
        <div
          style={{ top: 'max(14px, calc(env(safe-area-inset-top) + 8px))' }}
          className="absolute inset-x-3.5 sm:inset-x-4 z-30 flex items-center justify-between pointer-events-none"
        >
          <button
            type="button"
            onClick={() => setMuted(m => !m)}
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            className="pointer-events-auto w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <div className="pointer-events-auto flex items-center gap-5 text-[15px] font-bold">
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
                    active ? 'text-white' : 'text-white/60 hover:text-white/90'
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
            onClick={() => {
              setStudioStep('capture');
              setUploadOpen(true);
            }}
            aria-label="نشر فيديو جديد"
            className="pointer-events-auto w-10 h-10 rounded-full bg-[#FE2C55] hover:bg-[#EA284E] text-white flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
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
                  onContextMenu={e => e.preventDefault()}
                  onClick={e => handleStageClick(e, v)}
                  style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                  className="w-full h-full relative cursor-pointer select-none"
                >
                  {/* Mount active <video> ONLY on the visible slide — supports BOTH Portrait (9:16) & Landscape (16:9)! */}
                  {idx === activeIndex ? (
                    <video
                      ref={el => {
                        videoRefs.current[idx] = el;
                      }}
                      src={v.videoUrl || '/uploads/seed/reel1.mp4'}
                      poster={v.posterUrl || undefined}
                      autoPlay
                      loop
                      playsInline
                      preload="auto"
                      muted={muted}
                      disablePictureInPicture
                      controlsList="nodownload noplaybackrate"
                      onContextMenu={e => e.preventDefault()}
                      onLoadStart={() => setVideoBuffering(true)}
                      onWaiting={() => setVideoBuffering(true)}
                      onCanPlay={() => setVideoBuffering(false)}
                      onPlaying={() => setVideoBuffering(false)}
                      onError={() => setVideoBuffering(false)}
                      onTimeUpdate={e => {
                        if (!isScrubbing) {
                          setCurrentTime(e.currentTarget.currentTime);
                          if (e.currentTarget.duration) setDuration(e.currentTarget.duration);
                        }
                      }}
                      onLoadedMetadata={e => {
                        if (e.currentTarget.duration) {
                          setDuration(e.currentTarget.duration);
                        }
                      }}
                      className={`pointer-events-none w-full h-full bg-black select-none ${
                        v.orientation === 'landscape' ? 'object-contain' : 'object-cover'
                      }`}
                    />
                  ) : v.posterUrl ? (
                    <img
                      src={v.posterUrl}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className={`pointer-events-none w-full h-full bg-black select-none ${
                        v.orientation === 'landscape' ? 'object-contain' : 'object-cover'
                      }`}
                    />
                  ) : (
                    <div className="pointer-events-none w-full h-full bg-[#0C0C10]" />
                  )}

                  {idx === activeIndex && videoBuffering && !paused && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                      <span className="w-9 h-9 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                    </div>
                  )}

                  {idx === activeIndex && <TapBurstOverlay items={bursts} />}

                  {/* Telegram-Style Animated Particle Sensitive Blur (z-10 so z-20 Comments & Actions remain accessible!) */}
                  {v.isSensitive && !revealedVideos[v.id] && (
                    <SensitiveMediaShield
                      revealed={false}
                      onReveal={() => setRevealedVideos(prev => ({ ...prev, [v.id]: true }))}
                    />
                  )}

                  {/* Modern Organic Curved Translucent Play Icon (Zero old sharp triangle!) */}
                  {idx === activeIndex && paused && (!v.isSensitive || revealedVideos[v.id]) && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                      <PulsePlayGlyph className="w-[72px] h-[72px] drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]" />
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                  {/* Bottom Metadata: Positioned cleanly above the visible video scrubber lane! */}
                  <div
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    className={`absolute z-20 space-y-1.5 transition-all duration-200 ease-out md:bottom-12 md:start-4 md:end-20 md:items-start md:text-start flex flex-col ${
                      bottomDockHidden
                        ? 'bottom-[max(44px,calc(env(safe-area-inset-bottom)+38px))] start-4 end-20 items-start text-start'
                        : 'bottom-[calc(104px+env(safe-area-inset-bottom))] start-4 end-20 items-start text-start'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-white flex-wrap justify-start">
                      <button
                        type="button"
                        onClick={() => onOpenProfile?.(v.userId)}
                        className="inline-flex items-center gap-2 hover:underline cursor-pointer"
                      >
                        <UserAvatar initials={v.avatarInitials} avatarUrl={v.avatarUrl} size={30} />
                        <span>{v.displayName}</span>
                      </button>
                      {v.verified && <VerifiedIcon />}
                      <span className="text-[11.5px] font-normal text-white/70 font-mono-num">@{v.username}</span>
                      {v.userId !== user.id && !v.isFollowingAuthor && (
                        <button
                          type="button"
                          onClick={() => followCreator(v.userId)}
                          className="ms-0.5 px-2.5 py-0.5 rounded-full bg-[#FE2C55] hover:bg-[#EA284E] text-[11px] font-bold text-white inline-flex items-center gap-0.5 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" strokeWidth={2.8} />
                          <span>متابعة</span>
                        </button>
                      )}
                    </div>

                    {v.title && (
                      <div className="text-[13.5px] text-white/95 leading-snug max-w-full">
                        {isLong && !isExpanded ? (
                          <>
                            <span>{v.title.slice(0, 74)}... </span>
                            <button
                              type="button"
                              onClick={() => setExpandedCaptions(prev => ({ ...prev, [v.id]: true }))}
                              className="text-white/80 hover:text-white font-semibold cursor-pointer"
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
                                className="ms-1.5 text-white/80 hover:text-white font-semibold cursor-pointer"
                              >
                                أقل
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {v.tags && (isExpanded || !isLong) && (
                      <div className="text-xs text-white/80 max-w-full">
                        <RichMessageText
                          text={v.tags}
                          onMentionClick={onOpenProfileByUsername}
                          onHashtagClick={onOpenHashtag}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-white/85 pt-0.5 max-w-full justify-start">
                      <Music2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{v.audioTitle}</span>
                    </div>
                  </div>

                  {/* Right Action Rail: Uniform Crisp TikTok Icons Positioned Above Scrubber Lane */}
                  <div
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    className={`absolute end-3 z-20 flex flex-col items-center gap-4 transition-all duration-200 ease-out md:bottom-12 ${
                      bottomDockHidden
                        ? 'bottom-[max(44px,calc(env(safe-area-inset-bottom)+38px))]'
                        : 'bottom-[calc(104px+env(safe-area-inset-bottom))]'
                    }`}
                  >
                    <div className="relative mb-1">
                      <button
                        type="button"
                        onClick={() => onOpenProfile?.(v.userId)}
                        title={v.displayName}
                        className={`block p-[2px] rounded-full cursor-pointer hover:scale-105 transition-transform ${
                          v.hasActiveStory
                            ? 'bg-gradient-to-tr from-[#FE2C55] via-[#FF5E7E] to-[#25F4EE]'
                            : 'border border-white/40'
                        }`}
                      >
                        <div className="p-[1.5px] rounded-full bg-black">
                          <UserAvatar initials={v.avatarInitials} avatarUrl={v.avatarUrl} size={42} />
                        </div>
                      </button>

                      {v.userId !== user.id && !v.isFollowingAuthor && (
                        <button
                          type="button"
                          onClick={() => followCreator(v.userId)}
                          title={`متابعة ${v.displayName}`}
                          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#FE2C55] hover:bg-[#EA284E] text-white border-2 border-black flex items-center justify-center cursor-pointer transition-transform"
                        >
                          <Plus className="w-3 h-3" strokeWidth={3} />
                        </button>
                      )}
                    </div>

                    <button type="button" onClick={() => toggleLike(v)} className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform">
                      <Heart
                        className={`w-7 h-7 ${v.likedByMe ? 'text-[#FE2C55] fill-current' : 'text-white'}`}
                        strokeWidth={2}
                      />
                      <span className="text-[11.5px] font-semibold font-mono-num text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{compactNum(v.likesCount)}</span>
                    </button>

                    <button type="button" onClick={() => openComments(v)} className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform">
                      <MessageCircle className="w-7 h-7 text-white" strokeWidth={2} />
                      <span className="text-[11.5px] font-semibold font-mono-num text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{compactNum(v.commentsCount)}</span>
                    </button>

                    <button type="button" onClick={() => toggleSave(v)} className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform">
                      <Bookmark
                        className={`w-7 h-7 ${v.savedByMe ? 'text-[#FACC15] fill-current' : 'text-white'}`}
                        strokeWidth={2}
                      />
                      <span className="text-[11.5px] font-semibold font-mono-num text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{compactNum(v.savesCount)}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openShareSheet(v)}
                      title={lang === 'en' ? 'Share' : 'مشاركة'}
                      className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                    >
                      <Share2 className="w-7 h-7 text-white" strokeWidth={2} />
                      <span className="text-[11.5px] font-semibold font-mono-num text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{compactNum(v.sharesCount)}</span>
                    </button>

                    {v.userId === user.id && (
                      <ActionMenuOrb
                        align="end"
                        direction="up"
                        editLabel="تعديل الفيديو"
                        removeLabel="إزالة الفيديو"
                        onEdit={() => openEditVideoModal(v)}
                        onRemove={() => deleteOwnVideo(v.id)}
                      />
                    )}

                    <div className="w-10 h-10 rounded-full bg-[#1C1D24] border border-white/25 flex items-center justify-center">
                      <Music2 className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Always-Visible Advanced Video Progress Scrubber (Cleanly lifted ABOVE bottom dock & safe-area!) */}
                  {idx === activeIndex && (
                    <div
                      dir="ltr"
                      onClick={e => e.stopPropagation()}
                      onMouseEnter={() => setScrubHover(true)}
                      onMouseLeave={() => {
                        if (!isScrubbing) setScrubHover(false);
                      }}
                      onPointerDown={e => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setIsScrubbing(true);
                        scrubFromPointer(e.clientX);
                      }}
                      onPointerMove={e => {
                        if (!isScrubbing) return;
                        e.stopPropagation();
                        scrubFromPointer(e.clientX);
                      }}
                      onPointerUp={e => {
                        e.stopPropagation();
                        setIsScrubbing(false);
                        setScrubHover(false);
                      }}
                      onPointerCancel={e => {
                        e.stopPropagation();
                        setIsScrubbing(false);
                        setScrubHover(false);
                      }}
                      className={`absolute inset-x-3 md:inset-x-4 z-30 h-9 flex items-center cursor-pointer touch-none select-none transition-all duration-200 md:bottom-2 ${
                        bottomDockHidden
                          ? 'bottom-[max(10px,calc(env(safe-area-inset-bottom)+6px))]'
                          : 'bottom-[calc(70px+env(safe-area-inset-bottom))]'
                      }`}
                    >
                      {/* Floating Live Timestamp Preview Pill while scrubbing forward/backward */}
                      {isScrubbing && (
                        <div className="pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#161823]/95 border border-white/15 text-[13px] font-mono-num text-white flex items-center gap-2 whitespace-nowrap">
                          <span className="font-bold text-white">{fmtSec(currentTime)}</span>
                          <span className="text-white/40">/</span>
                          <span className="text-white/75">{fmtSec(duration)}</span>
                        </div>
                      )}

                      <div
                        ref={scrubberBarRef}
                        className={`relative w-full rounded-full bg-white/30 transition-all duration-150 ${
                          isScrubbing || scrubHover ? 'h-[8px]' : 'h-[4px]'
                        }`}
                      >
                        <div
                          style={{ width: `${progressPct}%` }}
                          className="h-full rounded-full bg-[#FE2C55] relative"
                        >
                          <span
                            className={`absolute -end-2 top-1/2 -translate-y-1/2 rounded-full bg-white border border-black/30 block transition-all duration-150 ${
                              isScrubbing || scrubHover ? 'w-4 h-4' : 'w-2.5 h-2.5'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* Compact Subtle Pill Toast (Zero boxy banners!) */}
        {shareToast && (
          <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-[#1C1D24]/95 text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap">
            <Check className="w-3.5 h-3.5 text-[#25F4EE]" strokeWidth={2.5} />
            <span>{shareToast}</span>
          </div>
        )}

        {/* SLEEK COMPACT 2026 SHARE SHEET (Zero bulky preview box, crisp matte rows!) */}
        {shareVideo && (
          <div onClick={() => setShareVideo(null)} className="absolute inset-0 z-50 bg-black/58 flex items-end justify-center">
            <div
              onClick={e => e.stopPropagation()}
              style={{ paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 12px))' }}
              className="w-full rounded-t-[24px] bg-[#181920] border-t border-white/[0.1] pt-2.5 px-4 space-y-4"
            >
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-1 rounded-full bg-white/25" />
              <span className="text-[13px] font-bold text-white">مشاركة</span>
            </div>

            {/* Row 1: Direct LM Contacts */}
            {contacts.length > 0 && (
              <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pb-0.5">
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

            {/* Row 2: Authentic Vector Social Brand Icons + Report Right Beside Them + Unique Per-User Share Counting! */}
            <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pt-2 border-t border-white/[0.07]">
              {SHARE_PLATFORMS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const deepUrl = `${window.location.origin}/pulse/${shareVideo.id}`;
                    const txt = `${shareVideo.title} — @${shareVideo.username}`;
                    trackPulseShare(shareVideo.id, p.id);
                    if (p.id === 'copy') {
                      navigator.clipboard?.writeText(deepUrl);
                      showToast('تم نسخ رابط الفيديو');
                    } else if (p.id === 'whatsapp') {
                      window.open(`https://wa.me/?text=${encodeURIComponent(`${txt}\n${deepUrl}`)}`, '_blank', 'noopener');
                    } else if (p.id === 'telegram') {
                      window.open(`https://t.me/share/url?url=${encodeURIComponent(deepUrl)}&text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
                    } else if (p.id === 'x') {
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(deepUrl)}`, '_blank', 'noopener');
                    } else if (p.id === 'facebook') {
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(deepUrl)}`, '_blank', 'noopener');
                    } else if (p.id === 'sms') {
                      window.open(`sms:?body=${encodeURIComponent(`${txt}\n${deepUrl}`)}`, '_self');
                    } else {
                      navigator.clipboard?.writeText(deepUrl);
                      showToast(`تم نسخ الرابط للمشاركة عبر ${p.label}`);
                    }
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

              {/* Discreet Report Icon Right Beside Social Platforms inside Share Sheet! */}
              {shareVideo.userId !== user.id && (
                <button
                  type="button"
                  onClick={() => {
                    const vidId = shareVideo.id;
                    setShareVideo(null);
                    setReportRequest({
                      targetType: 'video',
                      targetId: vidId,
                      label: lang === 'en' ? 'this Pulse video' : 'فيديو نبض',
                    });
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full bg-[#FB7185]/16 hover:bg-[#FB7185]/26 text-[#FDA4AF] border border-[#FB7185]/30 flex items-center justify-center transition-colors">
                    <Flag className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <span className="text-[10.5px] text-[#FDA4AF] truncate w-full text-center">{t(lang, 'report')}</span>
                </button>
              )}
            </div>

            {/* Row 3: Quick Actions */}
            <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pt-2 border-t border-white/[0.07]">
              {[
                {
                  id: 'repost',
                  label: 'إعادة نشر',
                  icon: Repeat2,
                  action: () => {
                    trackPulseShare(shareVideo.id, 'repost');
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
                  id: 'not_interested',
                  label: lang === 'en' ? 'Not interested' : 'غير مهتم',
                  icon: EyeOff,
                  action: () => {
                    showToast(lang === 'en' ? 'Showing less similar content' : 'سنعرض محتوى أقل مشابهًا');
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
              <span className="text-xs font-semibold text-white">
                {loadingComments ? drawerVideo.commentsCount : comments.length} تعليق
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-4">
              {loadingComments ? (
                <CommentListSkeleton rows={4} />
              ) : rootComments.length === 0 ? (
                <EmptyState2026
                  compact
                  icon={<MessageCircle className="w-5 h-5" />}
                  title={lang === 'en' ? 'No comments yet' : 'لا توجد تعليقات بعد'}
                  subtitle={
                    lang === 'en'
                      ? 'Be the first to share your thoughts or summon LM AI.'
                      : 'كن أول من يضيف تعليقًا أو يبدأ النقاش على هذا الفيديو.'
                  }
                />
              ) : (
              rootComments.map(c => {
                const sub = repliesOf(c.id);
                return (
                  <div key={c.id} className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      {c.isAi ? (
                        <UserAvatar initials={c.avatarInitials} avatarUrl={c.avatarUrl} size={32} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerVideo(null);
                            onOpenProfile?.(c.userId);
                          }}
                          className="shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                        >
                          <UserAvatar initials={c.avatarInitials} avatarUrl={c.avatarUrl} size={32} />
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs flex-wrap">
                          {c.isAi ? (
                            <span className="font-semibold text-[#F2F2F5]">{c.displayName}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDrawerVideo(null);
                                onOpenProfile?.(c.userId);
                              }}
                              className="font-semibold text-[#F2F2F5] hover:underline cursor-pointer"
                            >
                              {c.displayName}
                            </button>
                          )}
                          {c.verified && <VerifiedIcon />}
                          {c.isAi && <AiSummonBadge label="LM AI" compact />}
                          {!c.isAi && c.aiSummoned && <AiSummonBadge label="AI" compact />}
                          <span className="text-[#7A7A85]">{c.createdAt}</span>
                          {c.isEdited && <span className="text-[10px] text-[#FBBF24]/80">(معدّل)</span>}
                        </div>
                        <SensitiveCommentShield
                          revealed={!c.isSensitive || Boolean(revealedComments[c.id])}
                          onReveal={() => setRevealedComments(prev => ({ ...prev, [c.id]: true }))}
                        >
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
                        ) : editingCommentId === c.id ? (
                          <div className="mt-1.5 space-y-1.5">
                            <textarea
                              rows={2}
                              value={editingCommentText}
                              onChange={e => setEditingCommentText(e.target.value)}
                              className="w-full rounded-xl bg-[#0A0A0C] border border-white/[0.15] p-2 text-xs text-white outline-none resize-none"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="px-2.5 py-1 rounded-full bg-white/[0.07] text-[10.5px] text-[#A1A1AA] hover:text-white cursor-pointer"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                disabled={savingCommentEdit || !editingCommentText.trim()}
                                onClick={() => saveEditedComment(c.id)}
                                className="px-3 py-1 rounded-full bg-white text-black text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                              >
                                <Check className="w-3 h-3" />
                                <span>حفظ</span>
                              </button>
                            </div>
                          </div>
                        ) : c.isAi ? (
                          <div className="text-[13.5px] text-[#E4E4E7] mt-0.5 leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_LINK_COMPONENTS}>
                              {c.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="text-[13.5px] text-[#E4E4E7] mt-0.5 leading-relaxed">
                            <RichMessageText
                              text={c.content}
                              maxChars={200}
                              lang={lang}
                              onMentionClick={handle => {
                                setDrawerVideo(null);
                                onOpenProfileByUsername?.(handle);
                              }}
                              onHashtagClick={tag => {
                                setDrawerVideo(null);
                                onOpenHashtag?.(tag);
                              }}
                            />
                          </div>
                        )}
                        </SensitiveCommentShield>

                        {commentTranslations[c.id] && (
                          <div className="mt-1.5 ps-2.5 border-s-2 border-[#34D399]/60 py-0.5 text-[12px] text-[#D4D4D8] leading-relaxed flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[9.5px] font-semibold text-[#34D399] block mb-0.5">
                                {PULSE_TRANSLATE_LANGS.find(l => l.code === commentTranslations[c.id].lang)?.label || commentTranslations[c.id].lang}
                              </span>
                              <span>{commentTranslations[c.id].text}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setCommentTranslations(prev => {
                                  const copy = { ...prev };
                                  delete copy[c.id];
                                  return copy;
                                })
                              }
                              className="text-[#7A7A85] hover:text-white cursor-pointer shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
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
                            className="text-[11px] text-[#7A7A85] hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <CornerDownLeft className="w-3 h-3" />
                            <span>{c.isAi ? (lang === 'en' ? 'Reply to AI' : 'الرد على AI') : t(lang, 'reply')}</span>
                          </button>

                          {!c.audioUrl && c.content.trim() && (
                            <div className="relative">
                              <button
                                type="button"
                                disabled={translatingCommentId === c.id}
                                onClick={() => setCommentLangMenuId(cur => (cur === c.id ? null : c.id))}
                                className="text-[11px] text-[#7A7A85] hover:text-[#34D399] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Languages className="w-3 h-3" />
                                <span>{translatingCommentId === c.id ? '...' : t(lang, 'translate')}</span>
                              </button>
                              {commentLangMenuId === c.id && (
                                <div className="absolute bottom-full start-0 mb-1.5 z-30 rounded-xl bg-[#16161E] border border-white/[0.14] shadow-2xl p-1 flex flex-wrap gap-1 w-[170px]">
                                  {PULSE_TRANSLATE_LANGS.map(lg => (
                                    <button
                                      key={lg.code}
                                      type="button"
                                      onClick={() => translatePulseComment(c.id, c.content, lg.code)}
                                      className="px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.15] text-[10.5px] text-white cursor-pointer"
                                    >
                                      {lg.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {c.userId === user.id && !c.audioUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(c.id);
                                setEditingCommentText(c.content);
                              }}
                              className="text-[11px] text-[#7A7A85] hover:text-[#FBBF24] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <StylusEditIcon className="w-3 h-3" />
                              <span>{t(lang, 'edit')}</span>
                            </button>
                          )}
                          {c.userId === user.id && (
                            <QuickRemovePill onRemove={() => deleteComment(c.id)} />
                          )}
                          {!c.isAi && c.userId !== user.id && (
                            <button
                              type="button"
                              onClick={() =>
                                setReportRequest({
                                  targetType: 'video_comment',
                                  targetId: c.id,
                                  label: lang === 'en' ? 'this comment' : 'هذا التعليق',
                                })
                              }
                              className="text-[11px] text-[#7A7A85] hover:text-[#FB7185] flex items-center gap-1 cursor-pointer"
                            >
                              <Flag className="w-2.5 h-2.5" />
                              <span>{t(lang, 'report')}</span>
                            </button>
                          )}
                        </div>
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
                            {rep.isAi ? (
                              <UserAvatar initials={rep.avatarInitials} avatarUrl={rep.avatarUrl} size={24} />
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setDrawerVideo(null);
                                  onOpenProfile?.(rep.userId);
                                }}
                                className="shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                              >
                                <UserAvatar initials={rep.avatarInitials} avatarUrl={rep.avatarUrl} size={24} />
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 text-[11.5px] flex-wrap">
                                {rep.isAi ? (
                                  <span className="font-semibold text-[#F2F2F5]">{rep.displayName}</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDrawerVideo(null);
                                      onOpenProfile?.(rep.userId);
                                    }}
                                    className="font-semibold text-[#F2F2F5] hover:underline cursor-pointer"
                                  >
                                    {rep.displayName}
                                  </button>
                                )}
                                {rep.isAi && <AiSummonBadge label="LM AI" compact />}
                                {!rep.isAi && rep.aiSummoned && <AiSummonBadge label="AI" compact />}
                                <span className="text-[#7A7A85]">{rep.createdAt}</span>
                                {rep.isEdited && <span className="text-[10px] text-[#FBBF24]/80">(معدّل)</span>}
                              </div>
                              <SensitiveCommentShield
                                revealed={!rep.isSensitive || Boolean(revealedComments[rep.id])}
                                onReveal={() => setRevealedComments(prev => ({ ...prev, [rep.id]: true }))}
                              >
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
                              ) : editingCommentId === rep.id ? (
                                <div className="mt-1 space-y-1.5">
                                  <textarea
                                    rows={2}
                                    value={editingCommentText}
                                    onChange={e => setEditingCommentText(e.target.value)}
                                    className="w-full rounded-xl bg-[#0A0A0C] border border-white/[0.15] p-2 text-xs text-white outline-none resize-none"
                                  />
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditingCommentId(null)}
                                      className="px-2.5 py-1 rounded-full bg-white/[0.07] text-[10.5px] text-[#A1A1AA] hover:text-white cursor-pointer"
                                    >
                                      إلغاء
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingCommentEdit || !editingCommentText.trim()}
                                      onClick={() => saveEditedComment(rep.id)}
                                      className="px-3 py-1 rounded-full bg-white text-black text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>حفظ</span>
                                    </button>
                                  </div>
                                </div>
                              ) : rep.isAi ? (
                                <div className="text-[13px] text-[#D4D4D8] mt-0.5 leading-relaxed">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_LINK_COMPONENTS}>
                                    {rep.content}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <div className="text-[13px] text-[#D4D4D8] mt-0.5">
                                  <RichMessageText
                                    text={rep.content}
                                    maxChars={180}
                                    lang={lang}
                                    onMentionClick={handle => {
                                      setDrawerVideo(null);
                                      onOpenProfileByUsername?.(handle);
                                    }}
                                    onHashtagClick={tag => {
                                      setDrawerVideo(null);
                                      onOpenHashtag?.(tag);
                                    }}
                                  />
                                </div>
                              )}
                              </SensitiveCommentShield>

                              {commentTranslations[rep.id] && (
                                <div className="mt-1 ps-2 border-s-2 border-[#34D399]/60 py-0.5 text-[11.5px] text-[#D4D4D8] leading-relaxed flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[9.5px] font-semibold text-[#34D399] block mb-0.5">
                                      {PULSE_TRANSLATE_LANGS.find(l => l.code === commentTranslations[rep.id].lang)?.label || commentTranslations[rep.id].lang}
                                    </span>
                                    <span>{commentTranslations[rep.id].text}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCommentTranslations(prev => {
                                        const copy = { ...prev };
                                        delete copy[rep.id];
                                        return copy;
                                      })
                                    }
                                    className="text-[#7A7A85] hover:text-white cursor-pointer shrink-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              <div className="mt-1 flex items-center gap-3 flex-wrap">
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
                                  className="text-[10.5px] text-[#7A7A85] hover:text-white flex items-center gap-1 cursor-pointer"
                                >
                                  <CornerDownLeft className="w-2.5 h-2.5" />
                                  <span>{rep.isAi ? (lang === 'en' ? 'Reply to AI' : 'الرد على AI') : t(lang, 'reply')}</span>
                                </button>

                                {!rep.audioUrl && rep.content.trim() && (
                                  <div className="relative">
                                    <button
                                      type="button"
                                      disabled={translatingCommentId === rep.id}
                                      onClick={() => setCommentLangMenuId(cur => (cur === rep.id ? null : rep.id))}
                                      className="text-[10.5px] text-[#7A7A85] hover:text-[#34D399] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                      <Languages className="w-2.5 h-2.5" />
                                      <span>{translatingCommentId === rep.id ? '...' : t(lang, 'translate')}</span>
                                    </button>
                                    {commentLangMenuId === rep.id && (
                                      <div className="absolute bottom-full start-0 mb-1.5 z-30 rounded-xl bg-[#16161E] border border-white/[0.14] shadow-2xl p-1 flex flex-wrap gap-1 w-[170px]">
                                        {PULSE_TRANSLATE_LANGS.map(lg => (
                                          <button
                                            key={lg.code}
                                            type="button"
                                            onClick={() => translatePulseComment(rep.id, rep.content, lg.code)}
                                            className="px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.15] text-[10.5px] text-white cursor-pointer"
                                          >
                                            {lg.label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {rep.userId === user.id && !rep.audioUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(rep.id);
                                      setEditingCommentText(rep.content);
                                    }}
                                    className="text-[10.5px] text-[#7A7A85] hover:text-[#FBBF24] flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <StylusEditIcon className="w-2.5 h-2.5" />
                                    <span>{t(lang, 'edit')}</span>
                                  </button>
                                )}
                                {rep.userId === user.id && (
                                  <QuickRemovePill onRemove={() => deleteComment(rep.id)} />
                                )}
                                {!rep.isAi && rep.userId !== user.id && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReportRequest({
                                        targetType: 'video_comment',
                                        targetId: rep.id,
                                        label: lang === 'en' ? 'this reply' : 'هذا الرد',
                                      })
                                    }
                                    className="text-[10.5px] text-[#7A7A85] hover:text-[#FB7185] flex items-center gap-1 cursor-pointer"
                                  >
                                    <Flag className="w-2.5 h-2.5" />
                                    <span>{t(lang, 'report')}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
              )}

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

            {/* FLOATING Comment Composer + Side-Aligned Reply Card (Lifts ONLY composer above mobile keyboard!) */}
            <div
              style={{ bottom: 'calc(max(12px, env(safe-area-inset-bottom) + 8px) + var(--lm-kb-offset, 0px))' }}
              className="pointer-events-none absolute inset-x-3 z-20 flex flex-col gap-2 transition-[bottom] duration-150"
            >
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

      {/* FULL-SCREEN 2-STEP TIKTOK CREATOR STUDIO (ZERO Bottom Popup Modal!) */}
      {uploadOpen && (
        <div className="fixed inset-0 z-[72] bg-[#0B0B0D] flex flex-col">
          <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoUploadFile} className="hidden" />
          <input ref={posterFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleManualPosterFile} className="hidden" />

          {studioStep === 'capture' ? (
            /* STEP 1: Full-Screen TikTok Camera + Gallery Studio */
            <div className="relative flex-1 w-full max-w-[540px] mx-auto bg-black flex flex-col overflow-hidden">
              {/* Live Camera Feed (Adapts seamlessly between Portrait 9:16 & Landscape 16:9!) */}
              <video
                ref={studioVideoPreviewRef}
                autoPlay
                muted
                playsInline
                className={`absolute inset-0 w-full h-full ${studioOrientation === 'landscape' ? 'object-contain bg-black' : 'object-cover'} ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''} ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
              />

              {/* Clean Fallback Canvas if Camera isn't active */}
              {!cameraReady && (
                <div className="absolute inset-0 bg-[#121212] flex flex-col items-center justify-center px-6 text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-[#1C1D24] flex items-center justify-center text-white/80">
                    <Camera className="w-8 h-8" strokeWidth={1.7} />
                  </div>
                  <div className="space-y-1.5 max-w-xs">
                    <div className="text-base font-bold text-white">استوديو نشر فيديو جديد</div>
                    <p className="text-xs text-[#9E9EA8] leading-relaxed">
                      {cameraError || 'جارٍ تجهيز الكاميرا... أو يمكنك اختيار فيديو مباشرة من جهازك.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="h-11 px-6 rounded-xl bg-[#FE2C55] hover:bg-[#EA284E] text-sm font-bold text-white flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Film className="w-4 h-4" />
                    <span>اختيار فيديو من المعرض</span>
                  </button>
                </div>
              )}

              {/* Top Bar: Close + Recording Timer + Flip Camera */}
              <div
                style={{ paddingTop: 'max(16px, calc(env(safe-area-inset-top) + 10px))' }}
                className="relative z-20 px-4 pb-3 flex items-center justify-between"
              >
                <button
                  type="button"
                  onClick={closeCreatorStudio}
                  aria-label="إغلاق"
                  className="w-10 h-10 rounded-full bg-black/55 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                {isRecordingClip ? (
                  <div className="px-3.5 py-1 rounded-full bg-[#FE2C55] text-xs font-bold font-mono-num text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>{fmtSec(recordElapsedSec)} / {fmtSec(studioDurationSec)}</span>
                  </div>
                ) : (
                  <span className="text-sm font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    إنشاء فيديو
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isRecordingClip}
                    onClick={() => setStudioOrientation(o => (o === 'portrait' ? 'landscape' : 'portrait'))}
                    aria-label="تغيير اتجاه الفيديو"
                    className="h-10 px-3 rounded-full bg-black/55 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
                  >
                    {studioOrientation === 'landscape' ? (
                      <>
                        <Monitor className="w-4 h-4 text-[#25F4EE]" />
                        <span>عريض</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4 text-white" />
                        <span>طولي</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCameraFacing(f => (f === 'user' ? 'environment' : 'user'))}
                    aria-label="تبديل الكاميرا"
                    className="w-10 h-10 rounded-full bg-black/55 text-white flex items-center justify-center cursor-pointer"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1" />

              {/* Bottom TikTok Creator Dock (Duration Selector + Shutter Circle + Gallery Picker) */}
              <div
                style={{ paddingBottom: 'max(28px, calc(env(safe-area-inset-bottom) + 18px))' }}
                className="relative z-20 px-6 pt-6 bg-gradient-to-t from-black/90 via-black/45 to-transparent space-y-5"
              >
                {/* Duration Selector */}
                <div className="flex items-center justify-center gap-6 text-xs font-bold">
                  {([15, 60, 180] as const).map(sec => (
                    <button
                      key={sec}
                      type="button"
                      disabled={isRecordingClip}
                      onClick={() => setStudioDurationSec(sec)}
                      className={`pb-1 transition-colors cursor-pointer ${
                        studioDurationSec === sec ? 'text-white border-b-2 border-[#FE2C55]' : 'text-white/55 hover:text-white/85'
                      }`}
                    >
                      {sec === 180 ? '3m' : `${sec}s`}
                    </button>
                  ))}
                </div>

                {/* Main Capture Controls Row */}
                <div className="flex items-center justify-around">
                  {/* Left: Quick Skip to Caption if User Already Uploaded */}
                  <div className="w-16 flex flex-col items-center">
                    {uploadedVideoUrl && (
                      <button
                        type="button"
                        onClick={() => setStudioStep('publish')}
                        className="flex flex-col items-center gap-1 text-white cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl bg-[#25F4EE] text-black flex items-center justify-center">
                          <Check className="w-5 h-5" strokeWidth={2.5} />
                        </div>
                        <span className="text-[11px] font-semibold">التالي</span>
                      </button>
                    )}
                  </div>

                  {/* Center: Iconic TikTok Flat Shutter Ring (ZERO Neon Glow!) */}
                  <button
                    type="button"
                    onClick={toggleStudioRecording}
                    aria-label={isRecordingClip ? 'إيقاف التصوير' : 'بدء التصوير'}
                    className="w-[78px] h-[78px] rounded-full border-[4px] border-white flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                  >
                    <span
                      className={`transition-all duration-150 bg-[#FE2C55] block ${
                        isRecordingClip ? 'w-7 h-7 rounded-lg' : 'w-[62px] h-[62px] rounded-full'
                      }`}
                    />
                  </button>

                  {/* Right: Gallery Picker Square (Opens Device Videos Immediately) */}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-16 flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#1C1D24] border border-white/25 group-hover:border-white/60 flex items-center justify-center text-white transition-colors">
                      <Film className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-white">رفع</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: Full-Screen TikTok Post Screen (Unified Caption, NO Boxes, NO Character Limit Badges!) */
            <form onSubmit={publishPulse} className="flex-1 w-full max-w-[640px] mx-auto bg-[#121212] flex flex-col">
              {/* Top Header */}
              <div
                style={{ paddingTop: 'max(14px, calc(env(safe-area-inset-top) + 8px))' }}
                className="px-4 pb-3 border-b border-white/[0.08] flex items-center justify-between shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setStudioStep('capture')}
                  className="flex items-center gap-1.5 text-sm font-semibold text-[#F1F1F2] hover:text-white cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                  <span>رجوع</span>
                </button>
                <span className="text-[15px] font-bold text-white">نشر</span>
                <button
                  type="button"
                  onClick={closeCreatorStudio}
                  aria-label="إغلاق"
                  className="w-9 h-9 rounded-full hover:bg-white/[0.08] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Content: TikTok Split Preview + Unified Free-Form Caption */}
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
                <div className="flex items-start gap-3.5 pb-5 border-b border-white/[0.08]">
                  {/* Unified Caption Textarea (Serves as Title & Description — NO forced separate boxes or counters!) */}
                  <textarea
                    rows={5}
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="اكتب وصفًا أو عنوانًا للفيديو... يمكنك إضافة #هاشتاج بحرية"
                    className="flex-1 bg-transparent text-[15px] text-[#F1F1F2] placeholder:text-[#71717A] leading-relaxed outline-none resize-none"
                  />

                  {/* Adaptive Video Cover Thumbnail (Matches Portrait or Landscape!) */}
                  <div
                    className={`rounded-xl overflow-hidden bg-black border border-white/[0.1] shrink-0 relative flex items-center justify-center transition-all ${
                      studioOrientation === 'landscape' ? 'w-36 h-24' : 'w-24 h-36'
                    }`}
                  >
                    {uploadedPosterUrl ? (
                      <img src={uploadedPosterUrl} alt="" className={`w-full h-full ${studioOrientation === 'landscape' ? 'object-contain' : 'object-cover'}`} />
                    ) : localPreviewUrl || uploadedVideoUrl ? (
                      <video src={localPreviewUrl || uploadedVideoUrl || ''} muted playsInline className={`w-full h-full ${studioOrientation === 'landscape' ? 'object-contain' : 'object-cover'}`} />
                    ) : (
                      <Film className="w-6 h-6 text-[#71717A]" />
                    )}

                    {(uploadingVideo || generatingThumb) && (
                      <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
                        <span className="w-6 h-6 rounded-full border-2 border-white/25 border-t-[#FE2C55] animate-spin" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => posterFileRef.current?.click()}
                      className="absolute inset-x-0 bottom-0 py-1.5 bg-black/75 text-[10.5px] font-semibold text-white text-center cursor-pointer"
                    >
                      تغيير الغلاف
                    </button>
                  </div>
                </div>

                {/* Orientation Switcher: User Freely Chooses Portrait (9:16) OR Landscape (16:9)! */}
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-xs font-semibold text-[#D4D4D8]">وضع عرض الفيديو</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStudioOrientation('portrait')}
                      className={`h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        studioOrientation === 'portrait'
                          ? 'bg-[#FE2C55] text-white'
                          : 'bg-[#1E1F28] text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>طولي 9:16</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudioOrientation('landscape')}
                      className={`h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        studioOrientation === 'landscape'
                          ? 'bg-[#25F4EE] text-black font-bold'
                          : 'bg-[#1E1F28] text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      <span>عريض 16:9</span>
                    </button>
                  </div>
                </div>

                {/* Quick Hashtag Helper Chips + Swap Video */}
                <div className="flex items-center gap-2 flex-wrap">
                  {['#LM', '#نبض', '#ترند', '#يومي'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNewTitle(prev => (prev.includes(tag) ? prev : `${prev.trim()} ${tag}`.trim()))}
                      className="h-8 px-3 rounded-lg bg-[#1E1F28] hover:bg-[#272936] text-xs font-medium text-[#E4E4E7] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Hash className="w-3 h-3 text-[#25F4EE]" />
                      <span>{tag.slice(1)}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={uploadingVideo}
                    onClick={() => fileRef.current?.click()}
                    className="ms-auto h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-[#D4D4D8] cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {uploadingVideo ? 'جارٍ رفع الفيديو...' : 'تغيير الفيديو'}
                  </button>
                </div>
              </div>

              {/* Bottom Action Bar (Flat Matte TikTok Red Publish Button — ZERO Glow!) */}
              <div
                style={{
                  paddingBottom: 'calc(max(16px, env(safe-area-inset-bottom) + 12px) + var(--lm-kb-offset, 0px))',
                }}
                className="px-4 pt-3 border-t border-white/[0.08] flex items-center gap-3 shrink-0 transition-[padding-bottom] duration-150"
              >
                <button
                  type="button"
                  onClick={closeCreatorStudio}
                  className="h-12 px-5 rounded-xl bg-[#1E1F28] hover:bg-[#272936] text-sm font-semibold text-[#D4D4D8] cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={(!newTitle.trim() && !uploadedVideoUrl) || uploadingVideo || publishingVideo}
                  className="flex-1 h-12 rounded-xl bg-[#FE2C55] hover:bg-[#EA284E] disabled:opacity-45 text-sm font-bold text-white cursor-pointer transition-colors"
                >
                  {publishingVideo ? 'جارٍ النشر...' : uploadingVideo ? 'جارٍ تجهيز الفيديو...' : 'نشر'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {/* 2026 Edit Own Pulse Video Modal (Unified Caption) */}
      {editingVideo && (
        <StudioModalOverlay onClose={() => setEditingVideo(null)}>
          <form onSubmit={saveEditedVideo}>
            <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <StylusEditIcon className="w-4 h-4 text-[#25F4EE]" />
                <span>تعديل الفيديو</span>
              </div>
              <CloseOrbButton onClick={() => setEditingVideo(null)} />
            </div>

            <div className="p-5 space-y-4">
              <textarea
                rows={4}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="اكتب عنوان أو وصف الفيديو..."
                className="w-full rounded-xl bg-[#121212] border border-white/[0.1] focus:border-[#FE2C55]/60 p-3.5 text-sm text-white outline-none resize-none transition-colors"
              />

              <input
                value={editTags}
                onChange={e => setEditTags(e.target.value)}
                placeholder="الوسوم (مثال: #LM #نبض)..."
                className="w-full h-11 rounded-xl bg-[#121212] border border-white/[0.1] focus:border-[#FE2C55]/60 px-3.5 text-xs text-white outline-none transition-colors"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingVideo(null)}
                  className="px-4 py-2 rounded-full bg-white/[0.07] text-xs text-[#A1A1AA] hover:text-white cursor-pointer"
                >
                  إلغاء
                </button>
                <PublishActionButton
                  type="submit"
                  variant="rose"
                  loading={savingEdit}
                  disabled={!editTitle.trim()}
                  label="حفظ التعديلات"
                  loadingLabel="جارٍ الحفظ..."
                  icon={<Check className="w-3.5 h-3.5" />}
                />
              </div>
            </div>
          </form>
        </StudioModalOverlay>
      )}

      {/* Universal Discreet Content Reporting Sheet/Modal */}
      <ReportContentModal
        request={reportRequest}
        reporterId={user.id}
        lang={lang}
        onClose={() => setReportRequest(null)}
        onReported={res => {
          if (res.targetType === 'video') {
            setVideos(prev =>
              prev.map(v =>
                v.id === res.targetId
                  ? { ...v, reportsCount: res.reportsCount, isSensitive: res.isSensitive }
                  : v
              )
            );
          } else if (res.targetType === 'video_comment') {
            setComments(prev =>
              prev.map(c =>
                c.id === res.targetId
                  ? { ...c, reportsCount: res.reportsCount, isSensitive: res.isSensitive }
                  : c
              )
            );
          }
        }}
      />
    </div>
  );
}
