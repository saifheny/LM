import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Repeat2,
  Image as ImageIcon,
  BarChart2,
  X,
  CornerDownLeft,
  Mic,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Bookmark,
  Share2,
  Maximize2,
  Minimize2,
  Plus,
  Sparkles,
  Check,
  Flag,
  Music,
  Play,
  Pause,
  Upload,
  Volume2,
  VolumeX,
  Send,
  Languages,
  Square,
  Link2,
  Quote,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

import { Lang, LicensedMusicTrack, PostCommentItem, PostPoll, ShortVideoItem, SocialPost, StoryItem, UserProfile } from '../../types';
import { AiSummonBadge, MARKDOWN_LINK_COMPONENTS, RichMessageText, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ChromeArrowButton, ObsidianComposerPill } from '../shared/HardwareUI';
import { MediaCollageGrid } from '../shared/MediaCollageGrid';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { FacebookReactionButton, REACTION_LIST, resolveReaction } from '../shared/TelegramReactions';
import { NavAiIcon } from '../shared/Icons2026Pro';
import { ActionMenuOrb, QuickRemovePill } from '../shared/ActionOrb2026';
import { CloseOrbButton, PublishActionButton, StudioModalOverlay } from '../shared/ModalChrome2026';
import type { SharePayload } from '../shared/ShareSheetModal';
import { ReportContentModal, ReportRequest, SensitiveCommentShield, SensitiveMediaShield } from '../shared/SensitiveShield';
import { TranslateSheetModal, TRANSLATE_SHEET_LANGUAGES } from '../shared/TranslateSheetModal';
import { CommentListSkeleton, EmptyState2026 } from '../shared/EmptyState2026';
import { api, apiGet, apiPost, apiUploadFile } from '../../lib/api';
import { t } from '../../lib/i18n';

const COMMENT_TRANSLATE_LANGS = TRANSLATE_SHEET_LANGUAGES.map(l => ({ code: l.code, label: l.native }));

function formatDurationMMSS(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

interface SocialViewProps {
  user: UserProfile;
  allUsers?: UserProfile[];
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
  activeHashtag?: string | null;
  focusedPostId?: string | null;
  onClearFocusedPost?: () => void;
  onSelectHashtag?: (tag: string | null) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenProfileByUsername?: (username: string) => void;
  onMessageUser?: (userId: string) => void;
  onOpenVideo?: (videoId: string) => void;
  onShare?: (payload: SharePayload) => void;
}

function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function SocialView({
  user,
  allUsers = [],
  lang,
  lastWsEvent,
  activeHashtag = null,
  focusedPostId = null,
  onClearFocusedPost,
  onSelectHashtag,
  onOpenProfile,
  onOpenProfileByUsername,
  onMessageUser,
  onOpenVideo,
  onShare,
}: SocialViewProps) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState('');
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [myActiveStory, setMyActiveStory] = useState(false);
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [storyReplyText, setStoryReplyText] = useState('');
  const [sendingStoryReply, setSendingStoryReply] = useState(false);
  const [storyFeedback, setStoryFeedback] = useState<string | null>(null);
  const [storyBurstRx, setStoryBurstRx] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Unified Hashtag Hub (Returns BOTH Community Posts + Pulse Videos!)
  const [hashtagVideos, setHashtagVideos] = useState<ShortVideoItem[]>([]);
  const [hashtagFilter, setHashtagFilter] = useState<'all' | 'posts' | 'videos'>('all');

  // Licensed Royalty-Free Studio Music Library + Pinned User Uploads + 60s Voice Recorder
  const [musicLibrary, setMusicLibrary] = useState<LicensedMusicTrack[]>([]);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [musicMoodFilter, setMusicMoodFilter] = useState<string>('all');
  const [selectedMusic, setSelectedMusic] = useState<{ url: string; title: string } | null>(null);
  const [uploadingCustomAudio, setUploadingCustomAudio] = useState(false);
  const [previewingMusicUrl, setPreviewingMusicUrl] = useState<string | null>(null);
  const [playingPostMusicId, setPlayingPostMusicId] = useState<string | null>(null);
  const [libRecording, setLibRecording] = useState(false);
  const [libRecordSec, setLibRecordSec] = useState(0);
  const [libRecBars, setLibRecBars] = useState<number[]>(() => Array(18).fill(18));
  const customAudioRef = useRef<HTMLInputElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const postMusicAudioRef = useRef<HTMLAudioElement | null>(null);
  const libRecRef = useRef<MediaRecorder | null>(null);
  const libStreamRef = useRef<MediaStream | null>(null);
  const libAudioCtxRef = useRef<AudioContext | null>(null);
  const libRafRef = useRef<number>(0);
  const libChunksRef = useRef<Blob[]>([]);
  const libTimerRef = useRef<number | null>(null);
  const libSecRef = useRef(0);

  // Inline Multi-Language Comment Translation & Comment Loading Skeleton State
  const [loadingCommentsByPost, setLoadingCommentsByPost] = useState<Record<string, boolean>>({});
  const [commentTranslations, setCommentTranslations] = useState<Record<string, { text: string; lang: string }>>({});
  const [translatingCommentId, setTranslatingCommentId] = useState<string | null>(null);
  const [translateTargetComment, setTranslateTargetComment] = useState<{ id: string; content: string } | null>(null);

  // 2026 Repost Menu & Quote Repost Studio
  const [repostMenuPostId, setRepostMenuPostId] = useState<string | null>(null);
  const [quotingPost, setQuotingPost] = useState<SocialPost | null>(null);
  const [quoteDraft, setQuoteDraft] = useState('');
  const [publishingQuote, setPublishingQuote] = useState(false);

  // Sensitive Content Blur & Universal Reporting
  const [reportRequest, setReportRequest] = useState<ReportRequest | null>(null);
  const [revealedPosts, setRevealedPosts] = useState<Record<string, boolean>>({});
  const [revealedComments, setRevealedComments] = useState<Record<string, boolean>>({});
  const [revealedTagVideos, setRevealedTagVideos] = useState<Record<string, boolean>>({});

  // Story Studio Upload Modal State
  const [storyStudioOpen, setStoryStudioOpen] = useState(false);
  const [storyMediaUrl, setStoryMediaUrl] = useState<string | null>(null);
  const [storyCaption, setStoryCaption] = useState('');
  const [uploadingStory, setUploadingStory] = useState(false);
  const [publishingStory, setPublishingStory] = useState(false);
  const storyFileRef = useRef<HTMLInputElement | null>(null);

  // Full-Screen Interactive Lightbox State
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number; caption: string; author: string } | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);

  const tapTimersRef = useRef<Record<string, number>>({});
  const lastTapMsRef = useRef<Record<string, number>>({});

  // Post Composer State (Supports up to 4 images + Full-Page Expand Mode!)
  const [draft, setDraft] = useState('');
  const [composerActive, setComposerActive] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>([]);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Session-Only Newly Published Post Hoisting (Shows brand-new post #1 right in front of you until you leave/reload!)
  const [sessionNewPostIds, setSessionNewPostIds] = useState<string[]>([]);

  // Facebook-Style Dedicated Post Detail Page (Post on TOP + Full Comments BELOW!)
  const [detailPostId, setDetailPostId] = useState<string | null>(focusedPostId || null);

  // Comments + In-Composer Voice Replies + AI Summon (Drafts persisted across close & browser refresh!)
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostCommentItem[]>>({});
  const [replyDrafts, setReplyDraftsState] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('lm_draft_social_comments');
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [replyParentByPost, setReplyParentByPost] = useState<
    Record<string, { id: string; name: string; snippet?: string; isAi?: boolean } | null>
  >({});
  const [replyAiModeByPost, setReplyAiModeByPost] = useState<Record<string, boolean>>({});
  const [recordingPostId, setRecordingPostId] = useState<string | null>(null);
  const [submittingCommentPost, setSubmittingCommentPost] = useState<string | null>(null);
  const [aiTypingPostId, setAiTypingPostId] = useState<string | null>(null);
  const [doubleTapPostId, setDoubleTapPostId] = useState<string | null>(null);

  // Live @mention autocomplete query in Post Composer
  const mentionMatch = draft.match(/(?:^|\s)@([A-Za-z0-9_\u0600-\u06FF]*)$/);
  const mentionSuggestions = React.useMemo(() => {
    if (!mentionMatch) return [];
    const q = mentionMatch[1].toLowerCase();
    return allUsers
      .filter(u => !q || u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q))
      .slice(0, 5);
  }, [mentionMatch, allUsers]);

  function insertMentionHandle(username: string) {
    setDraft(prev => prev.replace(/(^|\s)@[A-Za-z0-9_\u0600-\u06FF]*$/, `$1@${username} `));
  }

  const setReplyDraftForPost = useCallback((postId: string, val: string) => {
    setReplyDraftsState(prev => {
      const next = { ...prev, [postId]: val };
      try {
        localStorage.setItem('lm_draft_social_comments', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const loadFeed = useCallback(async () => {
    const sPromise = apiGet<{ ok: boolean; stories: StoryItem[]; myActiveStory?: boolean }>(
      `/api/stories?userId=${user.id}`
    );
    if (activeHashtag) {
      const [hRes, sRes] = await Promise.all([
        apiGet<{ ok: boolean; posts: SocialPost[]; videos: ShortVideoItem[] }>(
          `/api/hashtags/${encodeURIComponent(activeHashtag)}?userId=${user.id}`
        ),
        sPromise,
      ]);
      setPosts(hRes.posts || []);
      setHashtagVideos(hRes.videos || []);
      setStories(sRes.stories || []);
      setMyActiveStory(Boolean(sRes.myActiveStory));
      return;
    }

    const [pRes, sRes] = await Promise.all([
      apiGet<{ ok: boolean; posts: SocialPost[] }>(`/api/posts?userId=${user.id}`),
      sPromise,
    ]);
    setPosts(pRes.posts || []);
    setHashtagVideos([]);
    setStories(sRes.stories || []);
    setMyActiveStory(Boolean(sRes.myActiveStory));
  }, [user.id, activeHashtag]);

  useEffect(() => {
    setHashtagFilter('all');
    loadFeed();
  }, [loadFeed]);

  const loadMusicLibrary = useCallback(async () => {
    try {
      const res = await apiGet<{ ok: boolean; tracks: LicensedMusicTrack[] }>(
        `/api/music/library?userId=${encodeURIComponent(user.id)}`
      );
      setMusicLibrary(res.tracks || []);
    } catch {
      // ignore
    }
  }, [user.id]);

  useEffect(() => {
    loadMusicLibrary();
  }, [loadMusicLibrary]);

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
      postMusicAudioRef.current?.pause();
      if (libTimerRef.current) window.clearInterval(libTimerRef.current);
      libStreamRef.current?.getTracks().forEach(tr => tr.stop());
    };
  }, []);

  useEffect(() => {
    if (!lastWsEvent) return;
    if (lastWsEvent.event === 'social:new_post' || lastWsEvent.event === 'story:new') {
      loadFeed();
      return;
    }
    if (lastWsEvent.event === 'content:reported') {
      const payload = lastWsEvent.payload as {
        targetType?: string;
        targetId?: string;
        reportsCount?: number;
        isSensitive?: boolean;
      };
      if (payload.targetType === 'post' && payload.targetId) {
        setPosts(prev =>
          prev.map(p =>
            p.id === payload.targetId
              ? { ...p, reportsCount: payload.reportsCount, isSensitive: payload.isSensitive }
              : p
          )
        );
      } else if (payload.targetType === 'post_comment' && payload.targetId) {
        setCommentsByPost(prev => {
          const next = { ...prev };
          for (const pid of Object.keys(next)) {
            next[pid] = next[pid].map(c =>
              c.id === payload.targetId
                ? { ...c, reportsCount: payload.reportsCount, isSensitive: payload.isSensitive }
                : c
            );
          }
          return next;
        });
      }
    }
  }, [lastWsEvent, loadFeed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox) {
          setLightbox(null);
          setLightboxZoomed(false);
          return;
        }
        if (detailPostId) {
          setDetailPostId(null);
          onClearFocusedPost?.();
          return;
        }
        setActiveStory(null);
        setStoryStudioOpen(false);
        setComposerExpanded(false);
        setMusicPickerOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, detailPostId, onClearFocusedPost]);

  function stopPreviewMusic() {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setPreviewingMusicUrl(null);
  }

  function togglePreviewTrack(url: string) {
    if (previewingMusicUrl === url) {
      stopPreviewMusic();
      return;
    }
    postMusicAudioRef.current?.pause();
    setPlayingPostMusicId(null);
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.loop = true;
    }
    previewAudioRef.current.src = url;
    previewAudioRef.current.play().catch(() => {});
    setPreviewingMusicUrl(url);
  }

  function togglePostMusic(postId: string, musicUrl: string) {
    stopPreviewMusic();
    if (playingPostMusicId === postId) {
      postMusicAudioRef.current?.pause();
      setPlayingPostMusicId(null);
      return;
    }
    if (!postMusicAudioRef.current) {
      postMusicAudioRef.current = new Audio();
      postMusicAudioRef.current.loop = true;
    }
    postMusicAudioRef.current.src = musicUrl;
    postMusicAudioRef.current.play().catch(() => {});
    setPlayingPostMusicId(postId);
  }

  function notifyUploadError(err: unknown) {
    const msg = err instanceof Error ? err.message : 'تعذر رفع الملف.';
    setUploadError(msg);
    setTimeout(() => setUploadError(cur => (cur === msg ? null : cur)), 3800);
  }

  async function handleStoryReact(storyId: string, reactionId: string) {
    setStoryBurstRx(reactionId);
    setTimeout(() => setStoryBurstRx(cur => (cur === reactionId ? null : cur)), 650);
    try {
      const res = await apiPost<{ ok: boolean; reactions: Record<string, number>; myReaction: string | null }>(
        `/api/stories/${storyId}/react`,
        { userId: user.id, reaction: reactionId }
      );
      setStories(prev =>
        prev.map(s => (s.id === storyId ? { ...s, reactions: res.reactions, myReaction: res.myReaction } : s))
      );
      setActiveStory(prev =>
        prev && prev.id === storyId ? { ...prev, reactions: res.reactions, myReaction: res.myReaction } : prev
      );
    } catch {
      // ignore
    }
  }

  async function handleStoryReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeStory || !storyReplyText.trim() || sendingStoryReply) return;
    setSendingStoryReply(true);
    try {
      await apiPost(`/api/stories/${activeStory.id}/reply`, {
        userId: user.id,
        text: storyReplyText.trim(),
      });
      setStoryReplyText('');
      setStoryFeedback('تم إرسال ردك في المحادثة');
      setTimeout(() => setStoryFeedback(null), 2600);
    } catch (err) {
      setStoryFeedback(err instanceof Error ? err.message : 'تعذر إرسال الرد');
      setTimeout(() => setStoryFeedback(null), 2600);
    } finally {
      setSendingStoryReply(false);
    }
  }

  async function handleCustomAudioSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingCustomAudio(true);
    try {
      const up = await apiUploadFile(f, 'music');
      const saved = await apiPost<{ ok: boolean; track: LicensedMusicTrack }>('/api/music/user-tracks', {
        userId: user.id,
        url: up.url,
        kind: 'upload',
        durationSec: 30,
      });
      // Instant local state update (ZERO redundant library roundtrip delay!)
      setMusicLibrary(prev => [saved.track, ...prev.filter(tr => tr.id !== saved.track.id)]);
      setSelectedMusic({ url: saved.track.url, title: saved.track.title });
      setMusicMoodFilter('mine');
      stopPreviewMusic();
    } catch (err) {
      notifyUploadError(err);
    } finally {
      setUploadingCustomAudio(false);
      e.target.value = '';
    }
  }

  function cleanupLibAudioAnalyser() {
    if (libRafRef.current) {
      cancelAnimationFrame(libRafRef.current);
      libRafRef.current = 0;
    }
    if (libAudioCtxRef.current) {
      libAudioCtxRef.current.close().catch(() => {});
      libAudioCtxRef.current = null;
    }
  }

  function cancelLibVoiceRec() {
    if (libTimerRef.current) {
      window.clearInterval(libTimerRef.current);
      libTimerRef.current = null;
    }
    cleanupLibAudioAnalyser();
    try {
      if (libRecRef.current && libRecRef.current.state !== 'inactive') {
        libRecRef.current.onstop = null;
        libRecRef.current.stop();
      }
    } catch {
      // ignore
    }
    libStreamRef.current?.getTracks().forEach(tr => tr.stop());
    libStreamRef.current = null;
    libRecRef.current = null;
    libChunksRef.current = [];
    libSecRef.current = 0;
    setLibRecording(false);
    setLibRecordSec(0);
    setLibRecBars(Array(18).fill(18));
  }

  function stopLibVoiceRec() {
    if (libTimerRef.current) {
      window.clearInterval(libTimerRef.current);
      libTimerRef.current = null;
    }
    cleanupLibAudioAnalyser();
    try {
      if (libRecRef.current && libRecRef.current.state !== 'inactive') {
        try { libRecRef.current.requestData(); } catch { /* ignore */ }
        libRecRef.current.stop();
      }
    } catch {
      setLibRecording(false);
    }
  }

  async function startLibVoiceRec() {
    if (libRecording || uploadingCustomAudio) return;
    stopPreviewMusic();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      libStreamRef.current = stream;
      libChunksRef.current = [];
      libSecRef.current = 0;
      setLibRecordSec(0);
      setLibRecBars(Array(18).fill(18));
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      libRecRef.current = mr;
      mr.ondataavailable = ev => {
        if (ev.data.size > 0) libChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        const finalSec = Math.max(1, Math.min(60, Math.round(libSecRef.current) || 1));
        cleanupLibAudioAnalyser();
        stream.getTracks().forEach(tr => tr.stop());
        libStreamRef.current = null;
        setLibRecording(false);
        const blob = new Blob(libChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        libChunksRef.current = [];
        if (blob.size < 250) return;
        setUploadingCustomAudio(true);
        try {
          const ext = (mr.mimeType || '').includes('mp4') ? 'm4a' : (mr.mimeType || '').includes('ogg') ? 'ogg' : 'webm';
          const file = new File([blob], `lm_voice_${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
          const up = await apiUploadFile(file, 'voice');
          const saved = await apiPost<{ ok: boolean; track: LicensedMusicTrack }>('/api/music/user-tracks', {
            userId: user.id,
            url: up.url,
            kind: 'voice',
            durationSec: finalSec,
          });
          setMusicLibrary(prev => [saved.track, ...prev.filter(tr => tr.id !== saved.track.id)]);
          setSelectedMusic({ url: saved.track.url, title: saved.track.title });
          setMusicMoodFilter('mine');
        } catch (err) {
          notifyUploadError(err);
        } finally {
          setUploadingCustomAudio(false);
          setLibRecordSec(0);
        }
      };
      mr.start(100);
      setLibRecording(true);
      const startedAt = Date.now();
      libTimerRef.current = window.setInterval(() => {
        const sec = (Date.now() - startedAt) / 1000;
        libSecRef.current = sec;
        setLibRecordSec(Math.floor(sec));
        if (sec >= 60) {
          stopLibVoiceRec();
        }
      }, 200);

      // Live Web Audio RMS waveform meter so recording feels immediate and tactile!
      try {
        const ctx = new AudioContext();
        libAudioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let lastTick = 0;
        const pump = (now: number) => {
          if (!libAudioCtxRef.current) return;
          if (now - lastTick >= 70) {
            lastTick = now;
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            const h = Math.max(16, Math.min(100, Math.round(16 + Math.pow(Math.max(0, rms - 0.008) * 4.5, 0.72) * 84)));
            setLibRecBars(prev => [...prev.slice(1), h]);
          }
          libRafRef.current = requestAnimationFrame(pump);
        };
        libRafRef.current = requestAnimationFrame(pump);
      } catch {
        // ignore visualizer failure
      }
    } catch {
      notifyUploadError(new Error(lang === 'en' ? 'Microphone access denied.' : 'يرجى السماح بالوصول للميكروفون للتسجيل الصوتي.'));
    }
  }

  async function deleteUserAudioTrack(trackId: string) {
    try {
      await api(`/api/music/user-tracks/${trackId}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      const removed = musicLibrary.find(tr => tr.id === trackId);
      if (removed && selectedMusic?.url === removed.url) setSelectedMusic(null);
      if (removed && previewingMusicUrl === removed.url) stopPreviewMusic();
      setMusicLibrary(prev => prev.filter(tr => tr.id !== trackId));
    } catch {
      // ignore
    }
  }

  async function handleStoryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingStory(true);
    try {
      const up = await apiUploadFile(f, 'story');
      setStoryMediaUrl(up.url);
    } catch (err) {
      notifyUploadError(err);
    } finally {
      setUploadingStory(false);
      e.target.value = '';
    }
  }

  async function publishStory(e: React.FormEvent) {
    e.preventDefault();
    if (!storyMediaUrl || publishingStory) return;
    setPublishingStory(true);
    try {
      await apiPost('/api/stories', {
        userId: user.id,
        mediaUrl: storyMediaUrl,
        caption: storyCaption.trim(),
      });
      setStoryStudioOpen(false);
      setStoryMediaUrl(null);
      setStoryCaption('');
      loadFeed();
    } finally {
      setPublishingStory(false);
    }
  }

  async function deleteStory(storyId: string) {
    await api(`/api/stories/${storyId}?userId=${user.id}`, { method: 'DELETE' });
    setActiveStory(null);
    loadFeed();
  }

  async function toggleSavePost(postId: string) {
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, savedByMe: !p.savedByMe } : p)));
    try {
      const res = await apiPost<{ ok: boolean; saved: boolean }>(`/api/posts/${postId}/save`, { userId: user.id });
      setPosts(prev => prev.map(p => (p.id === postId ? { ...p, savedByMe: res.saved } : p)));
    } catch {
      loadFeed();
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = Math.max(0, 4 - uploadedMediaUrls.length);
    const slice = files.slice(0, remainingSlots);
    const urls: string[] = [];
    for (const f of slice) {
      try {
        const up = await apiUploadFile(f, 'post_image');
        urls.push(up.url);
      } catch (err) {
        notifyUploadError(err);
      }
    }
    if (urls.length > 0) {
      setUploadedMediaUrls(prev => [...prev, ...urls].slice(0, 4));
      setComposerActive(true);
    }
    e.target.value = '';
  }

  function removeUploadedImg(idx: number) {
    setUploadedMediaUrls(prev => prev.filter((_, i) => i !== idx));
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() && uploadedMediaUrls.length === 0 && !selectedMusic) return;
    setPublishing(true);
    try {
      const validPoll =
        showPollBuilder && pollQuestion.trim() && pollOpts.filter(o => o.trim()).length >= 2
          ? { question: pollQuestion.trim(), options: pollOpts.filter(o => o.trim()) }
          : null;

      const created = await apiPost<{ ok: boolean; id?: string }>('/api/posts', {
        userId: user.id,
        content: draft.trim() || pollQuestion.trim() || '',
        mediaUrls: uploadedMediaUrls,
        poll: validPoll,
        musicUrl: selectedMusic?.url || null,
        musicTitle: selectedMusic?.title || null,
      });
      if (created?.id) {
        setSessionNewPostIds(prev => [created.id!, ...prev.filter(x => x !== created.id)]);
      }
      setDraft('');
      setUploadedMediaUrls([]);
      setSelectedMusic(null);
      setMusicPickerOpen(false);
      stopPreviewMusic();
      setShowPollBuilder(false);
      setPollQuestion('');
      setPollOpts(['', '']);
      setComposerExpanded(false);
      setComposerActive(false);
      await loadFeed();
    } finally {
      setPublishing(false);
    }
  }

  async function handlePostReact(postId: string, reactionId: string, forceSet = false) {
    // Optimistic instant update so Facebook-style floating reactions feel instantaneous!
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const curRx = { ...(p.reactions || {}) };
        const prevMine = p.myReaction || null;
        let nextMine: string | null = reactionId;
        let delta = 0;

        if (prevMine === reactionId && !forceSet) {
          if (curRx[reactionId]) curRx[reactionId] = Math.max(0, curRx[reactionId] - 1);
          nextMine = null;
          delta = -1;
        } else {
          if (prevMine && curRx[prevMine]) curRx[prevMine] = Math.max(0, curRx[prevMine] - 1);
          else delta = 1;
          curRx[reactionId] = (curRx[reactionId] || 0) + 1;
        }
        return {
          ...p,
          reactions: curRx,
          myReaction: nextMine,
          score: Math.max(0, p.score + delta),
          likesCount: Math.max(0, p.likesCount + delta),
        };
      })
    );

    try {
      const res = await apiPost<{
        ok: boolean;
        reactions: Record<string, number>;
        myReaction: string | null;
        score: number;
        likesCount: number;
      }>(`/api/posts/${postId}/react`, {
        userId: user.id,
        reaction: reactionId,
        forceSet,
      });
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? {
                ...p,
                reactions: res.reactions,
                myReaction: res.myReaction,
                score: res.score,
                likesCount: res.likesCount,
              }
            : p
        )
      );
    } catch {
      // ignore
    }
  }

  function handleMediaTap(post: SocialPost, mediaIndex: number) {
    const now = Date.now();
    const prev = lastTapMsRef.current[post.id] || 0;
    lastTapMsRef.current[post.id] = now;

    if (now - prev < 260) {
      window.clearTimeout(tapTimersRef.current[post.id]);
      lastTapMsRef.current[post.id] = 0;
      handlePostReact(post.id, 'love', true);
      setDoubleTapPostId(post.id);
      setTimeout(() => setDoubleTapPostId(cur => (cur === post.id ? null : cur)), 650);
      return;
    }

    window.clearTimeout(tapTimersRef.current[post.id]);
    tapTimersRef.current[post.id] = window.setTimeout(() => {
      setLightboxZoomed(false);
      setLightbox({
        urls: post.mediaUrls,
        index: mediaIndex,
        caption: post.content,
        author: post.displayName,
      });
    }, 260);
  }

  async function handlePollVote(postId: string, optionId: string) {
    const res = await apiPost<{ ok: boolean; poll: PostPoll }>(`/api/posts/${postId}/poll-vote`, {
      userId: user.id,
      optionId,
    });
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, poll: res.poll } : p)));
  }

  async function handleRepost(postId: string) {
    // Optimistic X-style single-action toggle (strictly 1 repost per user)
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const nextReposted = !p.repostedByMe;
        return {
          ...p,
          repostedByMe: nextReposted,
          sharesCount: Math.max(0, p.sharesCount + (nextReposted ? 1 : -1)),
          repostedBy: nextReposted
            ? { userId: user.id, displayName: user.displayName, username: user.username }
            : p.repostedBy?.userId === user.id
              ? null
              : p.repostedBy,
        };
      })
    );
    try {
      const res = await apiPost<{ ok: boolean; reposted: boolean; sharesCount: number }>(
        `/api/posts/${postId}/repost`,
        { userId: user.id }
      );
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? {
                ...p,
                repostedByMe: res.reposted,
                sharesCount: res.sharesCount,
                repostedBy: res.reposted
                  ? { userId: user.id, displayName: user.displayName, username: user.username }
                  : p.repostedBy?.userId === user.id
                    ? null
                    : p.repostedBy,
              }
            : p
        )
      );
    } catch {
      loadFeed();
    }
  }

  async function submitQuotePost(e: React.FormEvent) {
    e.preventDefault();
    if (!quotingPost || publishingQuote) return;
    setPublishingQuote(true);
    try {
      const trimmed = quoteDraft.trim();
      if (!trimmed) {
        // Direct Repost when user didn't add custom thoughts
        if (!quotingPost.repostedByMe) {
          await handleRepost(quotingPost.id);
        }
        setQuotingPost(null);
        setQuoteDraft('');
        return;
      }
      const created = await apiPost<{ ok: boolean; id?: string }>('/api/posts', {
        userId: user.id,
        content: trimmed,
        quotedPostId: quotingPost.id,
      });
      if (created?.id) {
        setSessionNewPostIds(prev => [created.id!, ...prev.filter(x => x !== created.id)]);
      }
      setQuotingPost(null);
      setQuoteDraft('');
      await loadFeed();
    } finally {
      setPublishingQuote(false);
    }
  }

  async function translateCommentText(commentId: string, text: string, targetLang: string) {
    if (!text.trim()) return;
    setTranslateTargetComment(null);
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

  async function saveEditedPost(postId: string) {
    if (!editingPostText.trim()) return;
    await api(`/api/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify({ userId: user.id, content: editingPostText.trim() }),
    });
    setEditingPostId(null);
    setEditingPostText('');
    await loadFeed();
  }

  async function deletePost(postId: string) {
    await api(`/api/posts/${postId}?userId=${user.id}`, { method: 'DELETE' });
    setPosts(prev => prev.filter(p => p.id !== postId));
    setSessionNewPostIds(prev => prev.filter(id => id !== postId));
    if (detailPostId === postId) {
      closePostDetail();
    }
  }

  async function deleteComment(postId: string, commentId: string) {
    await api(`/api/post-comments/${commentId}?userId=${user.id}`, { method: 'DELETE' });
    const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`);
    setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: res.comments.length } : p)));
  }

  const loadCommentsForPost = useCallback(async (postId: string) => {
    setLoadingCommentsByPost(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`);
      setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
    } finally {
      setLoadingCommentsByPost(prev => ({ ...prev, [postId]: false }));
    }
  }, []);

  const openPostDetail = useCallback(
    (postId: string) => {
      setDetailPostId(postId);
      void loadCommentsForPost(postId);
    },
    [loadCommentsForPost]
  );

  const closePostDetail = useCallback(() => {
    setDetailPostId(null);
    setRecordingPostId(null);
    onClearFocusedPost?.();
  }, [onClearFocusedPost]);

  // Automatically open Facebook-style Post Detail when navigated from Profile or /post/:id link!
  useEffect(() => {
    if (focusedPostId) {
      openPostDetail(focusedPostId);
    }
  }, [focusedPostId, openPostDetail]);

  async function toggleThread(postId: string) {
    openPostDetail(postId);
  }

  async function submitComment(postId: string, e: React.FormEvent) {
    e.preventDefault();
    const text = (replyDrafts[postId] || '').trim();
    if (!text || submittingCommentPost === postId) return;
    const parent = replyParentByPost[postId];
    const invokeAi =
      Boolean(replyAiModeByPost[postId]) ||
      Boolean(parent?.isAi) ||
      /^(\/ai|-ai|\/|@(lm\s*ai|ai))/i.test(text);
    const cleanedText = text.replace(/^(\/ai|-ai|\/)\s*/i, '').trim() || text;

    // 1. Immediately clear draft & show the user's comment optimistically (0ms feedback!)
    setReplyDraftForPost(postId, '');
    setReplyParentByPost(prev => ({ ...prev, [postId]: null }));
    setReplyAiModeByPost(prev => ({ ...prev, [postId]: false }));

    const tempComment: PostCommentItem = {
      id: `tmp_pc_${Date.now()}`,
      postId,
      userId: user.id,
      parentId: parent?.id || null,
      displayName: user.displayName,
      username: user.username,
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      avatarUrl: user.avatarUrl,
      verified: user.verified,
      aiSummoned: invokeAi,
      content: cleanedText,
      audioUrl: null,
      audioDurationSec: 0,
      transcript: null,
      createdAt: 'الآن',
    };
    setCommentsByPost(prev => ({ ...prev, [postId]: [...(prev[postId] || []), tempComment] }));

    setSubmittingCommentPost(postId);
    if (invokeAi) setAiTypingPostId(postId);

    try {
      await apiPost(`/api/posts/${postId}/comments`, {
        userId: user.id,
        content: cleanedText,
        parentId: parent?.id || null,
        invokeAi,
      });

      const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`);
      setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
      setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: res.comments.length } : p)));
    } catch {
      const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`).catch(() => null);
      if (res) setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
    } finally {
      setSubmittingCommentPost(null);
      setAiTypingPostId(cur => (cur === postId ? null : cur));
    }
  }

  async function submitVoiceComment(postId: string, file: File, durationSec: number, liveTranscript?: string | null) {
    setRecordingPostId(null);
    const parent = replyParentByPost[postId];
    const invokeAi = Boolean(replyAiModeByPost[postId]) || Boolean(parent?.isAi);

    setReplyParentByPost(prev => ({ ...prev, [postId]: null }));
    setReplyAiModeByPost(prev => ({ ...prev, [postId]: false }));
    if (invokeAi) setAiTypingPostId(postId);

    try {
      const up = await apiUploadFile(file, 'voice');
      await apiPost(`/api/posts/${postId}/comments`, {
        userId: user.id,
        content: '',
        parentId: parent?.id || null,
        audioUrl: up.url,
        audioDurationSec: durationSec,
        transcript: liveTranscript || null,
        invokeAi,
      });
      const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`);
      setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
      setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: res.comments.length } : p)));
    } finally {
      setAiTypingPostId(cur => (cur === postId ? null : cur));
    }
  }

  const showExpandIcon = composerActive || draft.length > 0 || uploadedMediaUrls.length > 0;
  const myLatestStory = stories.find(s => s.userId === user.id) || null;
  const followedStories = stories.filter(s => s.userId !== user.id);

  return (
    <div
      onClick={() => {
        if (repostMenuPostId) setRepostMenuPostId(null);
        // Clicking anywhere outside an open comments section collapses it while PRESERVING drafts!
        if (Object.values(openThreads).some(Boolean)) {
          setOpenThreads({});
          setRecordingPostId(null);
        }
      }}
      className="min-h-full w-full max-w-full overflow-x-hidden bg-[#121212] text-[#F2F2F5]"
    >
      {/* Seamless Borderless Feed Column (ZERO Side Walls/Borders on Laptop, ZERO Sideways Overflow on Mobile!) */}
      <div className="max-w-[620px] w-full mx-auto min-h-full px-1 sm:px-0 overflow-x-hidden">
        {/* Stories Strip: Safe Top Inset + ONLY User + Followed Creators' Active Stories */}
        <div
          style={{ paddingTop: 'max(14px, calc(env(safe-area-inset-top) + 8px))' }}
          className="px-3.5 sm:px-4 pb-3.5 border-b border-white/[0.07] flex items-center gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar"
        >
          {/* Your Story Tile (Colored Ring ONLY if you have an active story!) */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 group">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (myLatestStory) {
                    setActiveStory(myLatestStory);
                  } else {
                    setStoryMediaUrl(null);
                    setStoryCaption('');
                    setStoryStudioOpen(true);
                  }
                }}
                className={`block p-[2px] rounded-full cursor-pointer transition-transform group-hover:scale-[1.03] ${
                  myActiveStory
                    ? 'bg-gradient-to-tr from-[#F59E0B] via-[#FB7185] to-[#FF2D55]'
                    : 'border border-white/[0.22]'
                }`}
              >
                <div className="p-[2px] rounded-full bg-[#121212]">
                  <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={50} />
                </div>
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setStoryMediaUrl(null);
                  setStoryCaption('');
                  setStoryStudioOpen(true);
                }}
                title="نشر قصة جديدة"
                className="absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full bg-white text-black border-2 border-[#0A0A0C] flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer"
              >
                <Plus className="w-3 h-3" strokeWidth={2.8} />
              </button>
            </div>
            <span className={`text-[11px] font-medium max-w-[64px] truncate ${myActiveStory ? 'text-white' : 'text-[#A1A1AA]'}`}>
              {lang === 'ar' ? 'قصتك' : 'Your Story'}
            </span>
          </div>

          {followedStories.map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => setActiveStory(st)}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
            >
              <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#F59E0B] via-[#FB7185] to-[#FF2D55] group-hover:scale-[1.04] transition-transform">
                <div className="p-[2px] rounded-full bg-[#121212]">
                  <UserAvatar initials={st.avatarInitials} avatarUrl={st.avatarUrl} size={50} />
                </div>
              </div>
              <span className="text-[11px] text-[#C4C4CC] group-hover:text-white max-w-[64px] truncate transition-colors">
                {st.displayName.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>

        {/* Unified Hashtag Hub Banner + Matching Pulse Videos Grid (Shows BOTH Community + Pulse!) */}
        {activeHashtag && (
          <div className="border-b border-white/[0.08] bg-gradient-to-b from-[#FB7185]/[0.08] to-transparent">
            <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-[#FB7185]/18 border border-[#FB7185]/35 text-[#FDA4AF] font-semibold">
                  #{activeHashtag}
                </span>
                <span className="text-[#A1A1AA] font-mono-num">
                  {posts.length} منشور · {hashtagVideos.length} نبض
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectHashtag?.(null)}
                className="px-2.5 py-1 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-[11px] text-[#E4E4E7] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <X className="w-3 h-3" />
                <span>عرض الكل</span>
              </button>
            </div>

            {/* Unified Filter Pills */}
            <div className="px-4 pb-3 flex items-center gap-1.5">
              {[
                { id: 'all' as const, label: `الكل (${posts.length + hashtagVideos.length})` },
                { id: 'posts' as const, label: `المجتمع (${posts.length})` },
                { id: 'videos' as const, label: `نبض (${hashtagVideos.length})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHashtagFilter(tab.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors ${
                    hashtagFilter === tab.id
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/[0.06] text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Matching Pulse Short Videos Grid */}
            {(hashtagFilter === 'all' || hashtagFilter === 'videos') && hashtagVideos.length > 0 && (
              <div className="px-4 pb-4 space-y-2">
                <div className="text-[11px] font-semibold text-[#C4C4CC]">فيديوهات نبض في #{activeHashtag}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {hashtagVideos.map(v => (
                    <div
                      key={v.id}
                      onClick={() => onOpenVideo?.(v.id)}
                      className="group relative aspect-[9/14] rounded-2xl overflow-hidden bg-[#121217] border border-white/[0.09] cursor-pointer"
                    >
                      {v.posterUrl ? (
                        <img
                          src={v.posterUrl}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <video src={v.videoUrl || ''} muted className="w-full h-full object-cover" />
                      )}
                      {v.isSensitive && (
                        <SensitiveMediaShield
                          compact
                          revealed={Boolean(revealedTagVideos[v.id])}
                          onReveal={() => setRevealedTagVideos(prev => ({ ...prev, [v.id]: true }))}
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 z-20 p-2 bg-gradient-to-t from-black/90 via-black/45 to-transparent space-y-0.5 pointer-events-none">
                        <p className="text-[11px] font-medium text-white line-clamp-2 leading-snug">{v.title}</p>
                        <div className="flex items-center justify-between text-[10px] text-white/75 font-mono-num">
                          <span className="truncate">@{v.username}</span>
                          <span className="flex items-center gap-0.5 shrink-0">
                            <Play className="w-2.5 h-2.5 fill-current text-[#FF2D55]" />
                            {formatCount(v.viewsCount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hidden Multi-Image, Story & Custom Audio File Inputs */}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleFileSelect} className="hidden" />
        <input ref={storyFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={handleStoryFile} className="hidden" />
        <input ref={customAudioRef} type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm" onChange={handleCustomAudioSelect} className="hidden" />

        {uploadError && (
          <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-2xl bg-[#EF4444]/14 border border-[#FB7185]/35 text-xs text-[#FDA4AF] flex items-center justify-between gap-2">
            <span>{uploadError}</span>
            <CloseOrbButton size="xs" onClick={() => setUploadError(null)} />
          </div>
        )}

        {/* Inline Post Composer with Expand-to-Full-Page Trigger & Licensed Music Picker */}
        <form onSubmit={submitPost} className="px-4 py-4 border-b border-white/[0.07] flex gap-3 relative">
          <button
            type="button"
            onClick={() => onOpenProfile?.(user.id)}
            className="shrink-0 h-fit cursor-pointer hover:opacity-85 transition-opacity"
          >
            <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={38} />
          </button>
          <div className="flex-1 min-w-0">
            {/* Top Row with Expand Icon when Typing / Active */}
            <div className="flex items-start gap-2">
              <textarea
                rows={2}
                value={draft}
                onFocus={() => setComposerActive(true)}
                onChange={e => {
                  setDraft(e.target.value);
                  setComposerActive(true);
                }}
                placeholder={lang === 'ar' ? 'شارك لحظة أو فكرة...' : 'Share something...'}
                className="flex-1 bg-transparent resize-none text-[15px] text-[#F2F2F5] placeholder:text-[#63636C] outline-none leading-relaxed"
              />

              {showExpandIcon && (
                <button
                  type="button"
                  onClick={() => setComposerExpanded(true)}
                  title="توسيع لصفحة كاملة"
                  className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-[#C4C4CC] hover:text-white flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live @mention Autocomplete Popover */}
            {mentionSuggestions.length > 0 && (
              <div className="mt-2 rounded-2xl bg-[#14141B]/98 backdrop-blur-2xl border border-white/[0.13] p-1.5 shadow-2xl space-y-0.5">
                {mentionSuggestions.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => insertMentionHandle(u.username)}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/[0.07] flex items-center gap-2.5 text-start cursor-pointer transition-colors"
                  >
                    <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate flex items-center gap-1">
                        <span>{u.displayName}</span>
                        {u.verified && <VerifiedIcon />}
                      </div>
                      <div className="text-[10.5px] text-[#FBBF24] font-mono-num">@{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Music Pill in Composer */}
            {selectedMusic && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#10B981]/12 border border-[#34D399]/35 text-xs text-[#6EE7B7]">
                <Music className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[200px] font-medium">{selectedMusic.title}</span>
                <button
                  type="button"
                  onClick={() => togglePreviewTrack(selectedMusic.url)}
                  className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  {previewingMusicUrl === selectedMusic.url ? (
                    <Pause className="w-2.5 h-2.5" />
                  ) : (
                    <Play className="w-2.5 h-2.5 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopPreviewMusic();
                    setSelectedMusic(null);
                  }}
                  className="text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Inline Preview of Up to 4 Selected Photos */}
            {uploadedMediaUrls.length > 0 && (
              <div
                className={`mt-2.5 grid gap-1.5 ${
                  uploadedMediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                }`}
              >
                {uploadedMediaUrls.map((url, idx) => (
                  <div key={idx} className="relative rounded-2xl overflow-hidden border border-white/[0.09] bg-[#131318]">
                    <img
                      src={url}
                      alt=""
                      className={`w-full object-cover block ${uploadedMediaUrls.length === 1 ? 'max-h-[280px]' : 'h-[150px]'}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeUploadedImg(idx)}
                      className="absolute top-2 end-2 w-6 h-6 rounded-full bg-black/80 border border-white/15 text-white flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showPollBuilder && (
              <div className="mt-2.5 pt-2.5 border-t border-white/[0.07] space-y-2">
                <input
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  placeholder="سؤال الاستطلاع..."
                  className="w-full h-9 rounded-xl bg-[#131318] border border-white/[0.09] px-3 text-xs text-white placeholder:text-[#585860] outline-none"
                />
                {pollOpts.map((opt, idx) => (
                  <input
                    key={idx}
                    value={opt}
                    onChange={e => {
                      const next = [...pollOpts];
                      next[idx] = e.target.value;
                      setPollOpts(next);
                    }}
                    placeholder={`الخيار ${idx + 1}`}
                    className="w-full h-8 rounded-xl bg-[#131318] border border-white/[0.08] px-3 text-xs text-white placeholder:text-[#585860] outline-none"
                  />
                ))}
                {pollOpts.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setPollOpts([...pollOpts, ''])}
                    className="text-[11px] text-[#8E8E93] hover:text-white cursor-pointer"
                  >
                    + خيار إضافي
                  </button>
                )}
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-white/[0.07] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  title="إضافة صور"
                  className="w-9 h-9 rounded-full hover:bg-white/[0.08] text-[#A6A7B2] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ImageIcon className="w-5 h-5" strokeWidth={1.85} />
                </button>
                <button
                  type="button"
                  onClick={() => setMusicPickerOpen(true)}
                  title="إضافة موسيقى"
                  className={`w-9 h-9 rounded-full hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors ${
                    selectedMusic ? 'text-[#25F4EE]' : 'text-[#A6A7B2] hover:text-white'
                  }`}
                >
                  <Music className="w-5 h-5" strokeWidth={1.85} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPollBuilder(v => !v)}
                  title="استطلاع"
                  className={`w-9 h-9 rounded-full hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors ${
                    showPollBuilder ? 'text-[#FE2C55]' : 'text-[#A6A7B2] hover:text-white'
                  }`}
                >
                  <BarChart2 className="w-5 h-5" strokeWidth={1.85} />
                </button>
              </div>

              <PublishActionButton
                type="submit"
                variant="luminous"
                loading={publishing}
                disabled={!draft.trim() && uploadedMediaUrls.length === 0 && !selectedMusic}
                label={lang === 'ar' ? 'نشر' : 'Post'}
                loadingLabel="جارٍ النشر..."
              />
            </div>
          </div>
        </form>

        {/* Shared Post Deep-Link Banner (Appears when opened via /post/:id!) */}
        {focusedPostId && posts.some(p => p.id === focusedPostId) && (
          <div className="px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.04] flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">منشور مشارَك</span>
            <button
              type="button"
              onClick={() => onClearFocusedPost?.()}
              className="px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[11px] text-[#E4E4E7] flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>عرض كل المنشورات</span>
            </button>
          </div>
        )}

        {/* Open Borderless Feed (ZERO Post Boxes — Session-newly-published posts hoisted #1 right in front of you!) */}
        {(!activeHashtag || hashtagFilter !== 'videos') && (
        <div className="divide-y divide-white/[0.08]">
          {(() => {
            let list = posts;
            if (sessionNewPostIds.length > 0) {
              const pinnedSet = new Set(sessionNewPostIds);
              const pinned = sessionNewPostIds
                .map(id => posts.find(p => p.id === id))
                .filter((p): p is SocialPost => Boolean(p));
              list = [...pinned, ...posts.filter(p => !pinnedSet.has(p.id))];
            }
            if (focusedPostId && list.some(p => p.id === focusedPostId)) {
              list = [...list.filter(p => p.id === focusedPostId), ...list.filter(p => p.id !== focusedPostId)];
            }
            return list;
          })().map(post => {
            const isThreadOpen = Boolean(openThreads[post.id]);
            const postComments = commentsByPost[post.id] || [];
            const rootComments = postComments.filter(c => !c.parentId);
            const getReplies = (parentId: string) => postComments.filter(c => c.parentId === parentId);
            const totalPollVotes = post.poll ? post.poll.options.reduce((acc, o) => acc + o.votes, 0) : 0;
            const aiMode = Boolean(replyAiModeByPost[post.id]);
            const commentText = replyDrafts[post.id] || '';
            const hasCommentText = commentText.trim().length > 0;
            const isPostMusicPlaying = playingPostMusicId === post.id;
            const isPostSensitiveHidden = Boolean(post.isSensitive) && !revealedPosts[post.id];

            return (
              <article key={post.id} className="px-3.5 sm:px-4 py-4 max-w-full overflow-x-clip">
                {/* X-Style Single-Action Repost Attribution Banner */}
                {post.repostedBy && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onOpenProfile?.(post.repostedBy!.userId);
                    }}
                    className="mb-2 ps-12 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#8E8E93] hover:text-[#34D399] transition-colors cursor-pointer"
                  >
                    <Repeat2 className="w-3.5 h-3.5 text-[#34D399]" />
                    <span>
                      {post.repostedBy.userId === user.id
                        ? lang === 'en'
                          ? 'You reposted'
                          : 'أعدت النشر'
                        : lang === 'en'
                          ? `${post.repostedBy.displayName} reposted`
                          : `أعاد ${post.repostedBy.displayName} النشر`}
                    </span>
                  </button>
                )}

                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onOpenProfile?.(post.userId);
                      }}
                      className={`cursor-pointer rounded-full ${
                        post.hasActiveStory
                          ? 'p-[1.5px] bg-gradient-to-tr from-[#F59E0B] via-[#FB7185] to-[#FF2D55]'
                          : ''
                      }`}
                    >
                      <div className={post.hasActiveStory ? 'p-[1.5px] rounded-full bg-[#121212]' : ''}>
                        <UserAvatar initials={post.avatarInitials} avatarUrl={post.avatarUrl} size={40} />
                      </div>
                    </button>
                    {isThreadOpen && <div className="w-[1.5px] flex-1 bg-white/[0.12] mt-2" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onOpenProfile?.(post.userId);
                          }}
                          className="text-[14px] font-semibold text-[#F2F2F5] hover:underline truncate cursor-pointer"
                        >
                          {post.displayName}
                        </button>
                        {post.verified && <VerifiedIcon />}
                        <span className="text-xs text-[#7A7A85] font-mono-num">@{post.username}</span>
                        <span className="text-[#585860]">·</span>
                        <span className="text-xs text-[#7A7A85]">{post.createdAt}</span>
                        {post.isEdited && <span className="text-[10.5px] text-[#7A7A85]">(معدّل)</span>}
                      </div>

                      <div onClick={e => e.stopPropagation()} className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (onShare) {
                              onShare({
                                kind: 'post',
                                targetId: post.id,
                                title: post.displayName,
                                subtitle: `@${post.username}`,
                                snippet: post.content || 'منشور مصوّر على منصة LM',
                                imageUrl: post.mediaUrls[0] || null,
                                avatarUrl: post.avatarUrl,
                                avatarInitials: post.avatarInitials,
                                path: `/post/${post.id}`,
                                onShared: (nextCount) => {
                                  setPosts(prev =>
                                    prev.map(p => (p.id === post.id ? { ...p, sharesCount: nextCount } : p))
                                  );
                                },
                              });
                            } else {
                              navigator.clipboard?.writeText(`${window.location.origin}/post/${post.id}`);
                              apiPost<{ ok: boolean; sharesCount: number }>('/api/shares/track', {
                                targetType: 'post',
                                targetId: post.id,
                                userId: user.id,
                                channel: 'copy',
                              })
                                .then(r => {
                                  if (r.ok) {
                                    setPosts(prev =>
                                      prev.map(p => (p.id === post.id ? { ...p, sharesCount: r.sharesCount } : p))
                                    );
                                  }
                                })
                                .catch(() => {});
                            }
                          }}
                          title={lang === 'en' ? 'Share post' : 'مشاركة المنشور'}
                          className="w-9 h-9 rounded-full text-[#A6A7B2] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Share2 className="w-[19px] h-[19px]" strokeWidth={1.9} />
                        </button>

                        {post.userId === user.id && (
                          <ActionMenuOrb
                            editLabel={lang === 'en' ? 'Edit post' : 'تعديل المنشور'}
                            removeLabel={lang === 'en' ? 'Delete post' : 'حذف المنشور'}
                            onEdit={() => {
                              setEditingPostId(post.id);
                              setEditingPostText(post.content);
                            }}
                            onRemove={() => deletePost(post.id)}
                          />
                        )}
                      </div>
                    </div>

                    {editingPostId === post.id ? (
                      <div onClick={e => e.stopPropagation()} className="mt-2 space-y-2">
                        <textarea
                          rows={3}
                          value={editingPostText}
                          onChange={e => setEditingPostText(e.target.value)}
                          className="w-full rounded-2xl bg-[#131318] border border-white/[0.15] p-3 text-sm text-white outline-none resize-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPostId(null)}
                            className="px-3 py-1.5 rounded-full bg-white/[0.07] text-xs text-[#A1A1AA] hover:text-white cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditedPost(post.id)}
                            className="px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>حفظ</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      post.content && (
                        post.mediaUrls.length === 0 && isPostSensitiveHidden ? (
                          <div className="relative mt-2 min-h-[124px] rounded-2xl overflow-hidden border border-white/[0.08] bg-[#121216] p-3">
                            <div className="text-[15px] text-[#F2F2F5] leading-[1.6] whitespace-pre-wrap select-none blur-md">
                              {post.content}
                            </div>
                            <SensitiveMediaShield
                              compact
                              revealed={false}
                              onReveal={() => setRevealedPosts(prev => ({ ...prev, [post.id]: true }))}
                            />
                          </div>
                        ) : (
                          <div
                            onDoubleClick={() => handlePostReact(post.id, 'love', true)}
                            className="mt-1.5 text-[15px] text-[#F2F2F5] leading-[1.6] whitespace-pre-wrap select-text"
                          >
                            <RichMessageText
                              text={post.content}
                              maxChars={260}
                              lang={lang}
                              onMentionClick={onOpenProfileByUsername}
                              onHashtagClick={tag => onSelectHashtag?.(tag)}
                            />
                          </div>
                        )
                      )
                    )}

                    {/* Voice-Note-Style Interactive Audio Player for Text+Audio Posts (Play/Pause, Smooth Track Scrubbing, Speed 0.5x–2x!) */}
                    {post.musicUrl && post.mediaUrls.length === 0 && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="mt-2.5 p-3 rounded-2xl bg-[#191A22]"
                      >
                        <SmartVoicePill
                          url={post.musicUrl}
                          title={post.musicTitle || (lang === 'en' ? 'Audio Post' : 'مقطع صوتي')}
                        />
                      </div>
                    )}

                    {/* Media: Telegram-Grade Seamless Collage Grid | Single-Tap opens Lightbox | Double-Tap triggers Upvote */}
                    {post.mediaUrls.length > 0 && (
                      <div className="relative mt-2.5 rounded-[16px] overflow-hidden border border-[#94B3D6]/[0.12] bg-[#0B121B]">
                        <MediaCollageGrid
                          urls={post.mediaUrls}
                          onSelect={idx => handleMediaTap(post, idx)}
                        />

                        {/* Telegram-Style Animated Particle Sensitive Blur (Auto-Triggered at 3 Reports) */}
                        {isPostSensitiveHidden && (
                          <SensitiveMediaShield
                            revealed={false}
                            onReveal={() => setRevealedPosts(prev => ({ ...prev, [post.id]: true }))}
                          />
                        )}

                        {/* Facebook-Style Floating Photo Music Bar + Speaker Toggle */}
                        {post.musicUrl && !isPostSensitiveHidden && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2"
                          >
                            <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/72 backdrop-blur-xl border border-white/15 max-w-[75%]">
                              <Music
                                className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                  isPostMusicPlaying ? 'text-[#34D399]' : 'text-white/80'
                                }`}
                              />
                              {isPostMusicPlaying && (
                                <span className="inline-flex items-end gap-[2px] h-3 shrink-0">
                                  <span className="w-[2px] h-2 bg-[#34D399] rounded-full animate-pulse" />
                                  <span className="w-[2px] h-3 bg-[#34D399] rounded-full animate-pulse [animation-delay:150ms]" />
                                  <span className="w-[2px] h-1.5 bg-[#34D399] rounded-full animate-pulse [animation-delay:300ms]" />
                                </span>
                              )}
                              <span className="text-[11.5px] font-medium text-white truncate">
                                {post.musicTitle || (lang === 'en' ? 'Attached Audio' : 'موسيقى مرفقة')}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                togglePostMusic(post.id, post.musicUrl!);
                              }}
                              title={isPostMusicPlaying ? 'إيقاف الموسيقى' : 'تشغيل الموسيقى'}
                              className={`pointer-events-auto w-9 h-9 rounded-full backdrop-blur-xl border flex items-center justify-center cursor-pointer shadow-lg transition-all ${
                                isPostMusicPlaying
                                  ? 'bg-[#10B981]/80 border-[#6EE7B7]/60 text-black scale-105'
                                  : 'bg-black/72 border-white/25 text-white hover:bg-white hover:text-black'
                              }`}
                            >
                              {isPostMusicPlaying ? (
                                <Volume2 className="w-4 h-4" strokeWidth={2.1} />
                              ) : (
                                <VolumeX className="w-4 h-4" strokeWidth={2.1} />
                              )}
                            </button>
                          </div>
                        )}

                        {doubleTapPostId === post.id && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
                            <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center animate-ping">
                              {resolveReaction('love').renderIcon(40)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {post.poll && (
                      <div className="mt-3 space-y-2">
                        <div className="text-[13.5px] font-medium text-[#E4E4E7]">{post.poll.question}</div>
                        {post.poll.options.map(opt => {
                          const pct = totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                          const chosen = post.poll?.votedOptionId === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handlePollVote(post.id, opt.id)}
                              className={`relative w-full h-9 rounded-lg border overflow-hidden flex items-center justify-between px-3 text-xs cursor-pointer transition-colors ${
                                chosen ? 'border-white/35 text-white font-semibold' : 'border-white/[0.09] text-[#D4D4D8] hover:border-white/20'
                              }`}
                            >
                              <span
                                style={{ width: `${pct}%` }}
                                className={`absolute inset-y-0 start-0 transition-all duration-300 ${
                                  chosen ? 'bg-white/[0.16]' : 'bg-white/[0.06]'
                                }`}
                              />
                              <span className="relative z-10 truncate">{opt.text}</span>
                              <span className="relative z-10 font-mono-num text-[11px] text-[#A1A1AA]">{pct}%</span>
                            </button>
                          );
                        })}
                        <div className="text-[11px] text-[#7A7A85] font-mono-num">{formatCount(totalPollVotes)} صوت</div>
                      </div>
                    )}

                    {/* Embedded Quoted Post Card (Quote Repost) */}
                    {post.quotedPost && (
                      <div
                        onClick={e => {
                          e.stopPropagation();
                          onOpenProfile?.(post.quotedPost!.userId);
                        }}
                        className="mt-3 rounded-2xl bg-[#111116] border border-white/[0.1] hover:border-white/[0.22] p-3 space-y-2 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 text-xs min-w-0">
                          <UserAvatar
                            initials={post.quotedPost.avatarInitials}
                            avatarUrl={post.quotedPost.avatarUrl}
                            size={22}
                          />
                          <span className="font-semibold text-white truncate">{post.quotedPost.displayName}</span>
                          {post.quotedPost.verified && <VerifiedIcon />}
                          <span className="text-[11px] text-[#7A7A85] font-mono-num truncate">@{post.quotedPost.username}</span>
                          <span className="text-[#585860]">·</span>
                          <span className="text-[10.5px] text-[#7A7A85] shrink-0">{post.quotedPost.createdAt}</span>
                        </div>
                        {post.quotedPost.content && (
                          <div className="text-[13px] text-[#D4D4D8] leading-relaxed line-clamp-3">
                            {post.quotedPost.content}
                          </div>
                        )}
                        {post.quotedPost.mediaUrl && (
                          <img
                            src={post.quotedPost.mediaUrl}
                            alt=""
                            className="w-full max-h-[220px] rounded-xl object-cover border border-white/[0.08]"
                          />
                        )}
                      </div>
                    )}

                    {/* Action Row — Enlarged, Evenly Spaced, ZERO Overlap on Mobile or Laptop! */}
                    <div className="mt-3.5 flex items-center justify-between gap-3 text-[#A6A7B2] min-w-0">
                      <div className="flex items-center gap-5 sm:gap-6 min-w-0 flex-wrap">
                        <FacebookReactionButton
                          reactions={post.reactions}
                          myReaction={post.myReaction}
                          totalCount={post.score}
                          onReact={rxId => handlePostReact(post.id, rxId)}
                          lang={lang}
                        />

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            toggleThread(post.id);
                          }}
                          className={`flex items-center gap-2 text-[13px] hover:text-white transition-colors cursor-pointer py-1 ${
                            isThreadOpen ? 'text-white' : ''
                          }`}
                        >
                          <MessageCircle className="w-5 h-5" strokeWidth={1.85} />
                          <span className="font-mono-num">{formatCount(post.commentsCount)}</span>
                        </button>

                        {/* Direct Full-Page Repost & Quote Composer Trigger (NO 2-item popup!) */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setQuotingPost(post);
                            setQuoteDraft('');
                          }}
                          title={lang === 'en' ? 'Repost' : 'إعادة النشر'}
                          className={`flex items-center gap-2 text-[13px] transition-colors cursor-pointer py-1 ${
                            post.repostedByMe ? 'text-[#25F4EE] font-semibold' : 'hover:text-white'
                          }`}
                        >
                          <Repeat2 className="w-5 h-5" strokeWidth={post.repostedByMe ? 2.2 : 1.85} />
                          <span className="font-mono-num">{formatCount(post.sharesCount)}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleSavePost(post.id)}
                          title={post.savedByMe ? (lang === 'en' ? 'Unsave' : 'إزالة من المحفوظات') : lang === 'en' ? 'Save post' : 'حفظ المنشور'}
                          className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                            post.savedByMe ? 'text-[#FACC15]' : 'hover:text-white'
                          }`}
                        >
                          <Bookmark className={`w-5 h-5 ${post.savedByMe ? 'fill-current' : ''}`} strokeWidth={1.85} />
                        </button>
                      </div>
                    </div>

                    {/* Threaded Comments with In-Composer Voice Button + Luxury AI Summon + Sensitive Shield + Report */}
                    {isThreadOpen && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="mt-3.5 pt-3 border-t border-white/[0.08] space-y-3.5"
                      >
                        {loadingCommentsByPost[post.id] ? (
                          <CommentListSkeleton rows={2} />
                        ) : rootComments.length === 0 ? (
                          <EmptyState2026
                            compact
                            icon={<MessageCircle className="w-4 h-4" />}
                            title={lang === 'en' ? 'No comments yet' : 'لا توجد تعليقات بعد'}
                            subtitle={lang === 'en' ? 'Start the conversation below.' : 'كن أول من يضيف تعليقًا على هذا المنشور.'}
                          />
                        ) : (
                        rootComments.map(c => {
                          const replies = getReplies(c.id);
                          return (
                            <div key={c.id} className="space-y-2.5">
                              <div className="flex gap-2.5">
                                {c.isAi ? (
                                  <UserAvatar initials={c.avatarInitials} avatarUrl={c.avatarUrl} size={28} />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onOpenProfile?.(c.userId)}
                                    className="shrink-0 h-fit cursor-pointer hover:opacity-85 transition-opacity"
                                  >
                                    <UserAvatar initials={c.avatarInitials} avatarUrl={c.avatarUrl} size={28} />
                                  </button>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 text-xs flex-wrap">
                                    {c.isAi ? (
                                      <span className="font-semibold text-[#F2F2F5]">{c.displayName}</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => onOpenProfile?.(c.userId)}
                                        className="font-semibold text-[#F2F2F5] hover:underline cursor-pointer"
                                      >
                                        {c.displayName}
                                      </button>
                                    )}
                                    {c.verified && <VerifiedIcon />}
                                    {c.isAi && <AiSummonBadge label="LM AI" compact />}
                                    {!c.isAi && c.aiSummoned && <AiSummonBadge label="AI" compact />}
                                    <span className="text-[#7A7A85]">· {c.createdAt}</span>
                                  </div>

                                  <SensitiveCommentShield
                                    revealed={!c.isSensitive || Boolean(revealedComments[c.id])}
                                    onReveal={() => setRevealedComments(prev => ({ ...prev, [c.id]: true }))}
                                  >
                                    {c.audioUrl ? (
                                      <div
                                        className={`mt-1.5 p-2.5 rounded-2xl border max-w-[300px] ${
                                          c.aiSummoned
                                            ? 'lm-ai-summon-ring'
                                            : 'bg-[#15151B] border-white/[0.08]'
                                        }`}
                                      >
                                        <SmartVoicePill
                                          url={c.audioUrl}
                                          transcript={c.transcript}
                                          recordId={c.id}
                                          table="post_comments"
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
                                        <RichMessageText
                                          text={c.content}
                                          maxChars={220}
                                          lang={lang}
                                          onMentionClick={onOpenProfileByUsername}
                                          onHashtagClick={tag => onSelectHashtag?.(tag)}
                                        />
                                      </div>
                                    )}
                                  </SensitiveCommentShield>

                                  {/* Inline Translated Comment Block */}
                                  {commentTranslations[c.id] && (
                                    <div className="mt-1.5 ps-2.5 border-s-2 border-[#34D399]/60 py-0.5 text-[12.5px] text-[#D4D4D8] leading-relaxed flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <span className="text-[10px] font-semibold text-[#34D399] block mb-0.5">
                                          {COMMENT_TRANSLATE_LANGS.find(l => l.code === commentTranslations[c.id].lang)?.label || commentTranslations[c.id].lang}
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

                                  <div className="mt-1 flex items-center gap-3 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyParentByPost(prev => ({
                                          ...prev,
                                          [post.id]: {
                                            id: c.id,
                                            name: c.displayName,
                                            snippet: c.audioUrl ? (c.transcript || 'رسالة صوتية') : c.content.slice(0, 56),
                                            isAi: Boolean(c.isAi),
                                          },
                                        }));
                                        if (c.isAi) setReplyAiModeByPost(prev => ({ ...prev, [post.id]: true }));
                                      }}
                                        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#A6A7B2] hover:text-white cursor-pointer py-0.5"
                                      >
                                        <CornerDownLeft className="w-4 h-4" />
                                        <span>{t(lang, 'reply')}</span>
                                      </button>

                                      {!c.audioUrl && c.content.trim() && (
                                        <button
                                          type="button"
                                          disabled={translatingCommentId === c.id}
                                          onClick={() => setTranslateTargetComment({ id: c.id, content: c.content })}
                                          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#A6A7B2] hover:text-[#25F4EE] cursor-pointer disabled:opacity-50 py-0.5"
                                        >
                                          <Languages className="w-4 h-4" />
                                          <span>{translatingCommentId === c.id ? '...' : t(lang, 'translate')}</span>
                                        </button>
                                      )}

                                      {c.userId === user.id && (
                                        <QuickRemovePill onRemove={() => deleteComment(post.id, c.id)} />
                                      )}

                                      {/* Report strictly LAST & hidden on own comments */}
                                      {!c.isAi && c.userId !== user.id && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setReportRequest({
                                              targetType: 'post_comment',
                                              targetId: c.id,
                                              label: lang === 'en' ? 'this comment' : 'هذا التعليق',
                                            })
                                          }
                                          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#A6A7B2] hover:text-[#FB7185] cursor-pointer py-0.5"
                                        >
                                          <Flag className="w-3.5 h-3.5" />
                                          <span>{t(lang, 'report')}</span>
                                        </button>
                                      )}
                                  </div>
                                </div>
                              </div>

                              {replies.length > 0 && (
                                <div className="ms-3.5 ps-3.5 border-s border-white/[0.12] space-y-2.5">
                                  {replies.map(rep => (
                                    <div key={rep.id} className="flex gap-2">
                                      {rep.isAi ? (
                                        <UserAvatar initials={rep.avatarInitials} avatarUrl={rep.avatarUrl} size={24} />
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => onOpenProfile?.(rep.userId)}
                                          className="shrink-0 h-fit cursor-pointer hover:opacity-85 transition-opacity"
                                        >
                                          <UserAvatar initials={rep.avatarInitials} avatarUrl={rep.avatarUrl} size={24} />
                                        </button>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 text-[11.5px] flex-wrap">
                                          {rep.isAi ? (
                                            <span className="font-semibold text-[#F2F2F5] flex items-center gap-1">
                                              {rep.displayName}
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => onOpenProfile?.(rep.userId)}
                                              className="font-semibold text-[#F2F2F5] hover:underline flex items-center gap-1 cursor-pointer"
                                            >
                                              {rep.displayName}
                                            </button>
                                          )}
                                          {rep.isAi && <AiSummonBadge label="LM AI" compact />}
                                          {!rep.isAi && rep.aiSummoned && <AiSummonBadge label="AI" compact />}
                                          <span className="text-[#7A7A85]">· {rep.createdAt}</span>
                                        </div>

                                        <SensitiveCommentShield
                                          revealed={!rep.isSensitive || Boolean(revealedComments[rep.id])}
                                          onReveal={() => setRevealedComments(prev => ({ ...prev, [rep.id]: true }))}
                                        >
                                          {rep.audioUrl ? (
                                            <div
                                              className={`mt-1 p-2 rounded-2xl border max-w-[280px] ${
                                                rep.aiSummoned
                                                  ? 'lm-ai-summon-ring'
                                                  : 'bg-[#15151B] border-white/[0.08]'
                                              }`}
                                            >
                                              <SmartVoicePill
                                                url={rep.audioUrl}
                                                transcript={rep.transcript}
                                                recordId={rep.id}
                                                table="post_comments"
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
                                            <div className="text-[13px] text-[#D4D4D8] mt-0.5 leading-relaxed">
                                              <RichMessageText
                                                text={rep.content}
                                                maxChars={200}
                                                lang={lang}
                                                onMentionClick={onOpenProfileByUsername}
                                                onHashtagClick={tag => onSelectHashtag?.(tag)}
                                              />
                                            </div>
                                          )}
                                        </SensitiveCommentShield>

                                        {commentTranslations[rep.id] && (
                                          <div className="mt-1 ps-2 border-s-2 border-[#34D399]/60 py-0.5 text-[12px] text-[#D4D4D8] leading-relaxed flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <span className="text-[9.5px] font-semibold text-[#34D399] block mb-0.5">
                                                {COMMENT_TRANSLATE_LANGS.find(l => l.code === commentTranslations[rep.id].lang)?.label || commentTranslations[rep.id].lang}
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

                                          <div className="mt-1.5 flex items-center gap-4 flex-wrap">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setReplyParentByPost(prev => ({
                                                  ...prev,
                                                  [post.id]: {
                                                    id: rep.id,
                                                    name: rep.displayName,
                                                    snippet: rep.audioUrl ? (rep.transcript || 'رسالة صوتية') : rep.content.slice(0, 56),
                                                    isAi: Boolean(rep.isAi),
                                                  },
                                                }));
                                                if (rep.isAi) setReplyAiModeByPost(prev => ({ ...prev, [post.id]: true }));
                                              }}
                                              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#A6A7B2] hover:text-white cursor-pointer py-0.5"
                                            >
                                              <CornerDownLeft className="w-3.5 h-3.5" />
                                              <span>{rep.isAi ? (lang === 'en' ? 'Reply to AI' : 'الرد على AI') : t(lang, 'reply')}</span>
                                            </button>

                                            {!rep.audioUrl && rep.content.trim() && (
                                              <button
                                                type="button"
                                                disabled={translatingCommentId === rep.id}
                                                onClick={() => setTranslateTargetComment({ id: rep.id, content: rep.content })}
                                                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#A6A7B2] hover:text-[#25F4EE] cursor-pointer disabled:opacity-50 py-0.5"
                                              >
                                                <Languages className="w-3.5 h-3.5" />
                                                <span>{translatingCommentId === rep.id ? '...' : t(lang, 'translate')}</span>
                                              </button>
                                            )}

                                            {rep.userId === user.id && (
                                              <QuickRemovePill onRemove={() => deleteComment(post.id, rep.id)} />
                                            )}

                                            {!rep.isAi && rep.userId !== user.id && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setReportRequest({
                                                    targetType: 'post_comment',
                                                    targetId: rep.id,
                                                    label: lang === 'en' ? 'this reply' : 'هذا الرد',
                                                  })
                                                }
                                                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#A6A7B2] hover:text-[#FB7185] cursor-pointer py-0.5"
                                              >
                                                <Flag className="w-3.5 h-3.5" />
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

                        {/* Live LM AI Typing Indicator inside Community Comments */}
                        {aiTypingPostId === post.id && (
                          <div className="flex items-center gap-2.5 ps-3 py-1.5">
                            <UserAvatar initials="AI" avatarUrl={null} size={24} />
                            <div className="px-3 py-1.5 rounded-2xl bg-[#15151C] border border-white/[0.13] text-xs text-[#D4D4D8] flex items-center gap-2">
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

                        {/* Unified Floating Comment Composer */}
                        <div className="pt-1 flex flex-col gap-2">
                          {/* Compact Side-Aligned Reply Banner */}
                          {replyParentByPost[post.id] && (
                            <div className="w-fit max-w-[290px] self-start rounded-2xl bg-[#15151C]/95 backdrop-blur-xl border border-white/[0.11] px-3 py-1.5 flex items-center gap-2.5 shadow-md">
                              <span className="w-[2.5px] self-stretch rounded-full shrink-0 bg-white/50" />
                              <div className="min-w-0">
                                <div className="text-[10.5px] font-semibold text-white truncate">
                                  الرد على {replyParentByPost[post.id]?.name}
                                </div>
                                {replyParentByPost[post.id]?.snippet && (
                                  <div className="text-[11px] text-[#9E9EA8] truncate max-w-[195px]">
                                    {replyParentByPost[post.id]?.snippet}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setReplyParentByPost(prev => ({ ...prev, [post.id]: null }))}
                                className="w-5 h-5 rounded-full bg-white/[0.07] hover:bg-white/[0.16] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {recordingPostId === post.id ? (
                            <LiveVoiceRecorder
                              onCancel={() => setRecordingPostId(null)}
                              onSend={(file, sec, liveTxt) => submitVoiceComment(post.id, file, sec, liveTxt)}
                            />
                          ) : (
                            <ObsidianComposerPill
                              value={commentText}
                              onChange={v => setReplyDraftForPost(post.id, v)}
                              onSubmit={e => submitComment(post.id, e)}
                              placeholder={aiMode ? 'اسأل الذكاء الاصطناعي...' : 'أضف تعليقًا...'}
                              extraEnd={
                                <button
                                  type="button"
                                  onClick={() => setReplyAiModeByPost(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
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
                                hasCommentText ? (
                                  <ChromeArrowButton
                                    type="submit"
                                    disabled={submittingCommentPost === post.id}
                                    size={36}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setRecordingPostId(post.id)}
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
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        )}
      </div>

      {/* FACEBOOK-STYLE DEDICATED POST DETAIL PAGE (Post on TOP + Full Threaded Comments BELOW + Sticky Composer!) */}
      {detailPostId && (() => {
        const dPost = posts.find(p => p.id === detailPostId) || null;
        const dComments = commentsByPost[detailPostId] || [];
        const dRootComments = dComments.filter(c => !c.parentId);
        const getDReplies = (parentId: string) => dComments.filter(c => c.parentId === parentId);
        const dAiMode = Boolean(replyAiModeByPost[detailPostId]);
        const dCommentText = replyDrafts[detailPostId] || '';
        const dHasCommentText = dCommentText.trim().length > 0;
        const dTotalPollVotes = dPost?.poll ? dPost.poll.options.reduce((acc, o) => acc + o.votes, 0) : 0;
        const dMusicPlaying = dPost ? playingPostMusicId === dPost.id : false;
        const dSensitiveHidden = Boolean(dPost?.isSensitive) && dPost ? !revealedPosts[dPost.id] : false;
        const BackArrow = lang === 'en' ? ArrowLeft : ArrowRight;

        return (
          <div
            onClick={e => e.stopPropagation()}
            className="fixed inset-0 z-[55] bg-[#121212] text-[#EEF2F7] flex flex-col overflow-hidden"
          >
            {/* Floating Borderless Top Navigation Bar (ZERO surrounding borders/frames!) */}
            <header
              style={{ paddingTop: 'max(12px, calc(env(safe-area-inset-top) + 6px))' }}
              className="shrink-0 bg-[#121212]/88 backdrop-blur-xl px-3.5 sm:px-5 pb-2.5"
            >
              <div className="max-w-[660px] mx-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={closePostDetail}
                    aria-label={t(lang, 'back')}
                    className="w-10 h-10 rounded-full text-white hover:bg-white/[0.08] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                  >
                    <BackArrow className="w-5 h-5" />
                  </button>
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-white truncate">
                      {dPost
                        ? lang === 'en'
                          ? `${dPost.displayName}'s Post`
                          : `منشور ${dPost.displayName}`
                        : lang === 'en'
                          ? 'Post'
                          : 'المنشور'}
                    </div>
                    {dPost && (
                      <div className="text-[11.5px] text-[#A6A7B2] font-mono-num truncate">
                        @{dPost.username} · {dPost.createdAt}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {dPost && onShare && (
                    <button
                      type="button"
                      onClick={() =>
                        onShare({
                          kind: 'post',
                          targetId: dPost.id,
                          title: dPost.displayName,
                          subtitle: `@${dPost.username}`,
                          snippet: dPost.content || 'منشور على منصة LM',
                          imageUrl: dPost.mediaUrls[0] || null,
                          avatarUrl: dPost.avatarUrl,
                          avatarInitials: dPost.avatarInitials,
                          path: `/post/${dPost.id}`,
                          onShared: nextCount => {
                            setPosts(prev => prev.map(p => (p.id === dPost.id ? { ...p, sharesCount: nextCount } : p)));
                          },
                        })
                      }
                      title={lang === 'en' ? 'Share' : 'مشاركة'}
                      className="w-10 h-10 rounded-full text-[#D4D4D8] hover:text-white hover:bg-white/[0.08] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  )}
                  {dPost && dPost.userId === user.id && (
                    <ActionMenuOrb
                      editLabel={lang === 'en' ? 'Edit post' : 'تعديل المنشور'}
                      removeLabel={lang === 'en' ? 'Delete post' : 'حذف المنشور'}
                      onEdit={() => {
                        setEditingPostId(dPost.id);
                        setEditingPostText(dPost.content);
                        closePostDetail();
                      }}
                      onRemove={() => deletePost(dPost.id)}
                    />
                  )}
                </div>
              </div>
            </header>

            {/* Scrollable Stage: OPEN BORDERLESS POST ON TOP + OPEN BORDERLESS COMMENTS BELOW */}
            <div className="flex-1 overflow-y-auto px-3.5 sm:px-5 pt-4 pb-28">
              <div className="max-w-[660px] mx-auto space-y-4">
                {!dPost ? (
                  <div className="py-6">
                    <CommentListSkeleton rows={3} />
                  </div>
                ) : (
                  <>
                    {/* TOP SECTION: OPEN FULL POST (ZERO Outer Card Box!) */}
                    <article className="pb-4 border-b border-white/[0.08] space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            closePostDetail();
                            onOpenProfile?.(dPost.userId);
                          }}
                          className="flex items-center gap-2.5 min-w-0 text-start cursor-pointer group"
                        >
                          <UserAvatar initials={dPost.avatarInitials} avatarUrl={dPost.avatarUrl} size={42} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[14.5px] font-bold text-white group-hover:underline truncate">
                              <span className="truncate">{dPost.displayName}</span>
                              {dPost.verified && <VerifiedIcon />}
                            </div>
                            <div className="text-[11.5px] text-[#8DA2BC] font-mono-num">
                              @{dPost.username} · {dPost.createdAt}
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleSavePost(dPost.id)}
                          title={dPost.savedByMe ? 'إزالة من المحفوظات' : 'حفظ المنشور'}
                          className={`w-8 h-8 rounded-full hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors ${
                            dPost.savedByMe ? 'text-[#FACC15]' : 'text-[#96A7BC] hover:text-white'
                          }`}
                        >
                          <Bookmark className={`w-4 h-4 ${dPost.savedByMe ? 'fill-current' : ''}`} />
                        </button>
                      </div>

                      {dPost.content && (
                        <div className="text-[15.5px] leading-[1.7] text-[#F2F6FB] whitespace-pre-wrap break-words">
                          <RichMessageText
                            text={dPost.content}
                            maxChars={4000}
                            lang={lang}
                            onMentionClick={u => {
                              closePostDetail();
                              onOpenProfileByUsername?.(u);
                            }}
                            onHashtagClick={tag => {
                              closePostDetail();
                              onSelectHashtag?.(tag);
                            }}
                          />
                        </div>
                      )}

                      {dPost.musicUrl && dPost.mediaUrls.length === 0 && (
                        <div className="p-3 rounded-2xl bg-[#191A22]">
                          <SmartVoicePill
                            url={dPost.musicUrl}
                            title={dPost.musicTitle || (lang === 'en' ? 'Attached Audio' : 'مقطع صوتي')}
                          />
                        </div>
                      )}

                      {dPost.mediaUrls.length > 0 && (
                        <div className="relative rounded-[16px] overflow-hidden border border-[#94B3D6]/[0.12] bg-[#0B121B]">
                          <MediaCollageGrid
                            urls={dPost.mediaUrls}
                            onSelect={idx =>
                              setLightbox({
                                urls: dPost.mediaUrls,
                                index: idx,
                                caption: dPost.content,
                                author: dPost.displayName,
                              })
                            }
                          />
                          {dSensitiveHidden && (
                            <SensitiveMediaShield
                              revealed={false}
                              onReveal={() => setRevealedPosts(prev => ({ ...prev, [dPost.id]: true }))}
                            />
                          )}
                        </div>
                      )}

                      {dPost.poll && (
                        <div className="p-3 rounded-2xl bg-[#101925] border border-[#94B3D6]/[0.12] space-y-2">
                          <div className="text-xs font-semibold text-white">{dPost.poll.question}</div>
                          {dPost.poll.options.map(opt => {
                            const pct = dTotalPollVotes > 0 ? Math.round((opt.votes / dTotalPollVotes) * 100) : 0;
                            const chosen = dPost.poll?.votedOptionId === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handlePollVote(dPost.id, opt.id)}
                                className={`relative w-full h-9 rounded-lg border overflow-hidden flex items-center justify-between px-3 text-xs cursor-pointer transition-colors ${
                                  chosen ? 'border-[#7C5CFF] text-white font-semibold' : 'border-white/[0.1] text-[#D7E3F0]'
                                }`}
                              >
                                <span
                                  style={{ width: `${pct}%` }}
                                  className={`absolute inset-y-0 start-0 transition-all duration-300 ${
                                    chosen ? 'bg-[#7C5CFF]/30' : 'bg-white/[0.06]'
                                  }`}
                                />
                                <span className="relative z-10 truncate">{opt.text}</span>
                                <span className="relative z-10 font-mono-num text-[11px] text-[#A9BCD3]">{pct}%</span>
                              </button>
                            );
                          })}
                          <div className="text-[11px] text-[#8DA2BC] font-mono-num">{formatCount(dTotalPollVotes)} صوت</div>
                        </div>
                      )}

                      {dPost.quotedPost && (
                        <div
                          onClick={() => {
                            closePostDetail();
                            onOpenProfile?.(dPost.quotedPost!.userId);
                          }}
                          className="rounded-2xl bg-[#101925] border border-[#94B3D6]/[0.14] p-3 space-y-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <UserAvatar
                              initials={dPost.quotedPost.avatarInitials}
                              avatarUrl={dPost.quotedPost.avatarUrl}
                              size={22}
                            />
                            <span className="font-semibold text-white">{dPost.quotedPost.displayName}</span>
                            <span className="text-[11px] text-[#8DA2BC] font-mono-num">@{dPost.quotedPost.username}</span>
                          </div>
                          {dPost.quotedPost.content && (
                            <p className="text-[13px] text-[#D7E3F0] leading-relaxed">{dPost.quotedPost.content}</p>
                          )}
                          {dPost.quotedPost.mediaUrl && (
                            <img
                              src={dPost.quotedPost.mediaUrl}
                              alt=""
                              className="w-full max-h-[220px] rounded-xl object-cover"
                            />
                          )}
                        </div>
                      )}

                      {/* Post Engagement Bar */}
                      <div className="pt-3 border-t border-[#94B3D6]/[0.12] flex items-center justify-between gap-3 text-[#96A7BC]">
                        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                          <FacebookReactionButton
                            reactions={dPost.reactions}
                            myReaction={dPost.myReaction}
                            totalCount={dPost.score}
                            onReact={rxId => handlePostReact(dPost.id, rxId)}
                            lang={lang}
                          />

                          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                            <MessageCircle className="w-4 h-4 text-[#60A5FA]" strokeWidth={1.9} />
                            <span className="font-mono-num">{formatCount(dPost.commentsCount)}</span>
                            <span>{lang === 'en' ? 'Comments' : 'تعليق'}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setQuotingPost(dPost);
                              setQuoteDraft('');
                            }}
                            className={`flex items-center gap-1.5 text-[13px] cursor-pointer transition-colors ${
                              dPost.repostedByMe ? 'text-[#25F4EE] font-semibold' : 'hover:text-white'
                            }`}
                          >
                            <Repeat2 className="w-5 h-5" />
                            <span className="font-mono-num">{formatCount(dPost.sharesCount)}</span>
                          </button>
                        </div>
                      </div>
                    </article>

                    {/* COMMENTS SECTION HEADER */}
                    <div className="flex items-center justify-between px-1 pt-1">
                      <div className="flex items-center gap-2 text-[13.5px] font-bold text-white">
                        <span>{lang === 'en' ? 'Comments' : 'التعليقات'}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#1C2A3B] text-[11px] font-mono-num text-[#A8C5E8]">
                          {dComments.length}
                        </span>
                      </div>
                    </div>

                    {/* ALL THREADED COMMENTS & NESTED REPLIES — COMPLETELY OPEN BORDERLESS! */}
                    <div className="divide-y divide-white/[0.06]">
                      {loadingCommentsByPost[dPost.id] ? (
                        <CommentListSkeleton rows={3} />
                      ) : dRootComments.length === 0 ? (
                        <div className="py-8">
                          <EmptyState2026
                            compact
                            icon={<MessageCircle className="w-5 h-5" />}
                            title={lang === 'en' ? 'No comments yet' : 'لا توجد تعليقات بعد'}
                            subtitle={lang === 'en' ? 'Be the first to share your thoughts below.' : 'كن أول من يضيف تعليقًا في الأسفل.'}
                          />
                        </div>
                      ) : (
                        dRootComments.map(c => {
                          const replies = getDReplies(c.id);
                          return (
                            <div key={c.id} className="py-3.5 space-y-2.5">
                              <div className="flex gap-3 items-start">
                                {c.isAi ? (
                                  <UserAvatar initials={c.avatarInitials} avatarUrl={c.avatarUrl} size={34} />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      closePostDetail();
                                      onOpenProfile?.(c.userId);
                                    }}
                                    className="shrink-0 cursor-pointer hover:opacity-85"
                                  >
                                    <UserAvatar initials={c.avatarInitials} avatarUrl={c.avatarUrl} size={34} />
                                  </button>
                                )}

                                <div className="flex-1 min-w-0">
                                  <div>
                                    <div className="flex items-center gap-1.5 text-xs flex-wrap mb-1">
                                      <span className="font-bold text-white">{c.displayName}</span>
                                      {c.verified && <VerifiedIcon />}
                                      {c.isAi && <AiSummonBadge label="LM AI" compact />}
                                      {!c.isAi && c.aiSummoned && <AiSummonBadge label="AI" compact />}
                                      <span className="text-[11px] text-[#A6A7B2]">· {c.createdAt}</span>
                                    </div>

                                    <SensitiveCommentShield
                                      revealed={!c.isSensitive || Boolean(revealedComments[c.id])}
                                      onReveal={() => setRevealedComments(prev => ({ ...prev, [c.id]: true }))}
                                    >
                                      {c.audioUrl ? (
                                        <div className="mt-1 max-w-[300px]">
                                          <SmartVoicePill
                                            url={c.audioUrl}
                                            transcript={c.transcript}
                                            recordId={c.id}
                                            table="post_comments"
                                            accent={c.aiSummoned ? 'ai' : 'default'}
                                            compact
                                          />
                                        </div>
                                      ) : c.isAi ? (
                                        <div className="text-[14px] text-[#E6EEF7] leading-relaxed">
                                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_LINK_COMPONENTS}>
                                            {c.content}
                                          </ReactMarkdown>
                                        </div>
                                      ) : (
                                        <div className="text-[14px] text-[#E6EEF7] leading-relaxed">
                                          <RichMessageText
                                            text={c.content}
                                            maxChars={500}
                                            lang={lang}
                                            onMentionClick={u => {
                                              closePostDetail();
                                              onOpenProfileByUsername?.(u);
                                            }}
                                            onHashtagClick={tag => {
                                              closePostDetail();
                                              onSelectHashtag?.(tag);
                                            }}
                                          />
                                        </div>
                                      )}
                                    </SensitiveCommentShield>

                                    {commentTranslations[c.id] && (
                                      <div className="mt-2 ps-2.5 border-s-2 border-[#34D399]/60 py-0.5 text-[13px] text-[#D7E3F0] flex items-start justify-between gap-2">
                                        <span>{commentTranslations[c.id].text}</span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setCommentTranslations(prev => {
                                              const copy = { ...prev };
                                              delete copy[c.id];
                                              return copy;
                                            })
                                          }
                                          className="text-[#8DA2BC] hover:text-white cursor-pointer shrink-0"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-2 px-1 flex items-center gap-4 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyParentByPost(prev => ({
                                          ...prev,
                                          [dPost.id]: {
                                            id: c.id,
                                            name: c.displayName,
                                            snippet: c.audioUrl ? (c.transcript || 'رسالة صوتية') : c.content.slice(0, 56),
                                            isAi: Boolean(c.isAi),
                                          },
                                        }));
                                        if (c.isAi) setReplyAiModeByPost(prev => ({ ...prev, [dPost.id]: true }));
                                      }}
                                      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#A6A7B2] hover:text-white cursor-pointer py-0.5"
                                    >
                                      <CornerDownLeft className="w-4 h-4" />
                                      <span>{t(lang, 'reply')}</span>
                                    </button>

                                    {!c.audioUrl && c.content.trim() && (
                                      <button
                                        type="button"
                                        disabled={translatingCommentId === c.id}
                                        onClick={() => setTranslateTargetComment({ id: c.id, content: c.content })}
                                        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#A6A7B2] hover:text-[#25F4EE] cursor-pointer py-0.5"
                                      >
                                        <Languages className="w-4 h-4" />
                                        <span>{translatingCommentId === c.id ? '...' : t(lang, 'translate')}</span>
                                      </button>
                                    )}

                                    {c.userId === user.id && (
                                      <QuickRemovePill onRemove={() => deleteComment(dPost.id, c.id)} />
                                    )}

                                    {!c.isAi && c.userId !== user.id && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setReportRequest({
                                            targetType: 'post_comment',
                                            targetId: c.id,
                                            label: lang === 'en' ? 'this comment' : 'هذا التعليق',
                                          })
                                        }
                                        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#A6A7B2] hover:text-[#FB7185] cursor-pointer py-0.5"
                                      >
                                        <Flag className="w-3.5 h-3.5" />
                                        <span>{t(lang, 'report')}</span>
                                      </button>
                                    )}
                                  </div>

                                  {replies.length > 0 && (
                                    <div className="mt-2.5 ms-2 ps-3 border-s border-white/[0.12] space-y-2.5">
                                      {replies.map(rep => (
                                        <div key={rep.id} className="flex gap-2.5 items-start">
                                          <UserAvatar initials={rep.avatarInitials} avatarUrl={rep.avatarUrl} size={26} />
                                          <div className="flex-1 min-w-0">
                                            <div>
                                              <div className="flex items-center gap-1.5 text-[11.5px] flex-wrap mb-0.5">
                                                <span className="font-bold text-white">{rep.displayName}</span>
                                                {rep.verified && <VerifiedIcon />}
                                                {rep.isAi && <AiSummonBadge label="LM AI" compact />}
                                                <span className="text-[10.5px] text-[#A6A7B2]">· {rep.createdAt}</span>
                                              </div>
                                              {rep.audioUrl ? (
                                                <SmartVoicePill
                                                  url={rep.audioUrl}
                                                  transcript={rep.transcript}
                                                  recordId={rep.id}
                                                  table="post_comments"
                                                  compact
                                                />
                                              ) : (
                                                <div className="text-[13.5px] text-[#DCE6F2] leading-relaxed">
                                                  <RichMessageText text={rep.content} maxChars={320} lang={lang} />
                                                </div>
                                              )}
                                              {commentTranslations[rep.id] && (
                                                <div className="mt-1.5 ps-2 border-s-2 border-[#25F4EE]/60 py-0.5 text-[12.5px] text-[#D7E3F0] flex items-start justify-between gap-2">
                                                  <span>{commentTranslations[rep.id].text}</span>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setCommentTranslations(prev => {
                                                        const copy = { ...prev };
                                                        delete copy[rep.id];
                                                        return copy;
                                                      })
                                                    }
                                                    className="text-[#8DA2BC] hover:text-white cursor-pointer shrink-0"
                                                  >
                                                    <X className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                            <div className="mt-1.5 px-1 flex items-center gap-4 flex-wrap">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setReplyParentByPost(prev => ({
                                                    ...prev,
                                                    [dPost.id]: {
                                                      id: c.id,
                                                      name: rep.displayName,
                                                      snippet: rep.content.slice(0, 56),
                                                      isAi: Boolean(rep.isAi),
                                                    },
                                                  }));
                                                }}
                                                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#A6A7B2] hover:text-white cursor-pointer py-0.5"
                                              >
                                                <CornerDownLeft className="w-3.5 h-3.5" />
                                                <span>{t(lang, 'reply')}</span>
                                              </button>
                                              {!rep.audioUrl && rep.content.trim() && (
                                                <button
                                                  type="button"
                                                  disabled={translatingCommentId === rep.id}
                                                  onClick={() => setTranslateTargetComment({ id: rep.id, content: rep.content })}
                                                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#A6A7B2] hover:text-[#25F4EE] cursor-pointer py-0.5"
                                                >
                                                  <Languages className="w-3.5 h-3.5" />
                                                  <span>{translatingCommentId === rep.id ? '...' : t(lang, 'translate')}</span>
                                                </button>
                                              )}
                                              {rep.userId === user.id && (
                                                <QuickRemovePill onRemove={() => deleteComment(dPost.id, rep.id)} />
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {aiTypingPostId === dPost.id && (
                        <div className="flex items-center gap-2.5 py-1.5">
                          <UserAvatar initials="AI" avatarUrl={null} size={28} />
                          <div className="px-3.5 py-2 rounded-2xl bg-[#17212B] border border-[#7C5CFF]/30 text-xs text-[#E2EEFF] flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-[#A78BFA] animate-pulse" />
                            <span>LM AI يكتب الآن...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Borderless Floating Comment Composer — ONLY input pill lifts cleanly above mobile keyboard! */}
            {dPost && (
              <div
                style={{ bottom: 'calc(max(10px, env(safe-area-inset-bottom) + 6px) + var(--lm-kb-offset, 0px))' }}
                className="pointer-events-none fixed inset-x-3 sm:inset-x-4 z-[58] transition-[bottom] duration-150"
              >
                <div className="pointer-events-auto max-w-[660px] mx-auto space-y-2">
                  {replyParentByPost[dPost.id] && (
                    <div className="w-fit max-w-[300px] rounded-2xl bg-[#1D2C3D] border border-[#94B3D6]/[0.18] px-3 py-1.5 flex items-center gap-2.5">
                      <span className="w-[2.5px] self-stretch rounded-full bg-[#7C5CFF]" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white truncate">
                          الرد على {replyParentByPost[dPost.id]?.name}
                        </div>
                        {replyParentByPost[dPost.id]?.snippet && (
                          <div className="text-[11px] text-[#96A7BC] truncate max-w-[200px]">
                            {replyParentByPost[dPost.id]?.snippet}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyParentByPost(prev => ({ ...prev, [dPost.id]: null }))}
                        className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {recordingPostId === dPost.id ? (
                    <LiveVoiceRecorder
                      onCancel={() => setRecordingPostId(null)}
                      onSend={(file, sec, liveTxt) => submitVoiceComment(dPost.id, file, sec, liveTxt)}
                    />
                  ) : (
                    <ObsidianComposerPill
                      value={dCommentText}
                      onChange={v => setReplyDraftForPost(dPost.id, v)}
                      onSubmit={e => submitComment(dPost.id, e)}
                      placeholder={dAiMode ? 'اسأل الذكاء الاصطناعي...' : 'اكتب تعليقًا...'}
                      extraEnd={
                        <button
                          type="button"
                          onClick={() => setReplyAiModeByPost(prev => ({ ...prev, [dPost.id]: !prev[dPost.id] }))}
                          title="استدعاء الذكاء الاصطناعي"
                          className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                            dAiMode
                              ? 'bg-[#7C5CFF]/25 text-white border border-[#7C5CFF]/45'
                              : 'text-[#8DA2BC] hover:text-white'
                          }`}
                        >
                          <NavAiIcon active={dAiMode} className="w-[17px] h-[17px]" />
                        </button>
                      }
                      customAction={
                        dHasCommentText ? (
                          <ChromeArrowButton
                            type="submit"
                            disabled={submittingCommentPost === dPost.id}
                            size={36}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRecordingPostId(dPost.id)}
                            title="رد صوتي"
                            className="chrome-rim-btn w-[36px] h-[36px] shrink-0 cursor-pointer"
                          >
                            <span className="chrome-rim-btn-inner text-[#D7E3F0] hover:text-white transition-colors">
                              <Mic className="w-[16px] h-[16px]" strokeWidth={1.9} />
                            </span>
                          </button>
                        )
                      }
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* FULL-PAGE EXPANDED COMPOSER (ZERO Glowing Buttons, ZERO Bottom Container, ZERO 4/4 or Char Counters!) */}
      {composerExpanded && (
        <form
          onSubmit={submitPost}
          className="fixed inset-0 z-50 bg-[#121212] flex flex-col justify-between"
        >
          {/* Floating Borderless Top Bar */}
          <div
            style={{ paddingTop: 'max(14px, calc(env(safe-area-inset-top) + 8px))' }}
            className="px-4 sm:px-5 pb-3 flex items-center justify-between max-w-[780px] w-full mx-auto"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setComposerExpanded(false)}
                title="تصغير"
                className="w-9 h-9 rounded-full text-[#D4D4D8] hover:text-white hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5">
                <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={34} />
                <span className="text-sm font-semibold text-white">{user.displayName}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={publishing || (!draft.trim() && uploadedMediaUrls.length === 0 && !selectedMusic)}
              className="h-9 px-5 rounded-full bg-[#FE2C55] hover:bg-[#E5254B] text-white text-xs font-bold cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
            >
              {publishing ? 'جارٍ النشر...' : 'نشر'}
            </button>
          </div>

          {/* Spacious Full-Height Writing Area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 pt-5 pb-28 max-w-[780px] w-full mx-auto">
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={lang === 'ar' ? 'اكتب فكرتك بحرية...' : 'Write freely...'}
              className="w-full min-h-[240px] bg-transparent resize-none text-[18px] leading-[1.8] text-[#F1F1F2] placeholder:text-[#6E707D] outline-none"
            />

            {uploadedMediaUrls.length > 0 && (
              <div className="mt-4 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
                {uploadedMediaUrls.map((url, idx) => (
                  <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeUploadedImg(idx)}
                      className="absolute top-1 end-1 w-6 h-6 rounded-full bg-black/75 text-white flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showPollBuilder && (
              <div className="mt-4 pt-4 border-t border-white/[0.08] space-y-2.5 max-w-[520px]">
                <input
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  placeholder="سؤال الاستطلاع..."
                  className="w-full h-10 rounded-xl bg-[#1E1F26] px-3.5 text-sm text-white outline-none"
                />
                {pollOpts.map((opt, idx) => (
                  <input
                    key={idx}
                    value={opt}
                    onChange={e => {
                      const next = [...pollOpts];
                      next[idx] = e.target.value;
                      setPollOpts(next);
                    }}
                    placeholder={`الخيار ${idx + 1}`}
                    className="w-full h-9 rounded-xl bg-[#1E1F26] px-3.5 text-xs text-white outline-none"
                  />
                ))}
                {pollOpts.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setPollOpts([...pollOpts, ''])}
                    className="text-xs text-[#A6A7B2] hover:text-white cursor-pointer"
                  >
                    + خيار إضافي
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Floating Borderless Icon Tools Lifting Cleanly Above Keyboard (ZERO Container Box, ZERO 4/4 or Char Counters!) */}
          <div
            style={{ bottom: 'calc(max(12px, env(safe-area-inset-bottom) + 8px) + var(--lm-kb-offset, 0px))' }}
            className="fixed inset-x-4 z-50 transition-[bottom] duration-150"
          >
            <div className="max-w-[780px] mx-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="إضافة صور"
                className="w-10 h-10 rounded-full text-[#D4D4D8] hover:text-white hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors"
              >
                <ImageIcon className="w-5 h-5" strokeWidth={1.9} />
              </button>
              <button
                type="button"
                onClick={() => setMusicPickerOpen(true)}
                title={selectedMusic ? selectedMusic.title : 'إضافة موسيقى'}
                className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  selectedMusic
                    ? 'text-[#25F4EE] bg-[#25F4EE]/12'
                    : 'text-[#D4D4D8] hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <Music className="w-5 h-5" strokeWidth={1.9} />
              </button>
              <button
                type="button"
                onClick={() => setShowPollBuilder(v => !v)}
                title="استطلاع"
                className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  showPollBuilder
                    ? 'text-[#FE2C55] bg-[#FE2C55]/15'
                    : 'text-[#D4D4D8] hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <BarChart2 className="w-5 h-5" strokeWidth={1.9} />
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Full-Screen Interactive Lightbox Image Viewer */}
      {lightbox && (
        <div
          onClick={() => {
            setLightbox(null);
            setLightboxZoomed(false);
          }}
          className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4"
        >
          <div onClick={e => e.stopPropagation()} className="flex items-center justify-between max-w-5xl w-full mx-auto">
            <div className="text-xs font-medium text-white/80">
              {lightbox.author}
              {lightbox.urls.length > 1 && (
                <span className="ms-2 font-mono-num text-white/50">
                  {lightbox.index + 1} / {lightbox.urls.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxZoomed(z => !z)}
                className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white flex items-center justify-center cursor-pointer"
              >
                {lightboxZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
              </button>
              <a
                href={lightbox.urls[lightbox.index]}
                download
                className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white flex items-center justify-center"
              >
                <Download className="w-4 h-4" />
              </a>
              <CloseOrbButton
                onClick={() => {
                  setLightbox(null);
                  setLightboxZoomed(false);
                }}
              />
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center relative overflow-hidden my-3">
            {lightbox.urls.length > 1 && lightbox.index > 0 && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setLightboxZoomed(false);
                  setLightbox(prev => (prev ? { ...prev, index: prev.index - 1 } : null));
                }}
                className="absolute start-3 z-20 w-10 h-10 rounded-full bg-black/70 border border-white/15 text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            <img
              src={lightbox.urls[lightbox.index]}
              alt=""
              onClick={e => {
                e.stopPropagation();
                setLightboxZoomed(z => !z);
              }}
              className={`max-h-[78vh] max-w-[92vw] rounded-2xl object-contain transition-transform duration-200 cursor-zoom-in ${
                lightboxZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100'
              }`}
            />

            {lightbox.urls.length > 1 && lightbox.index < lightbox.urls.length - 1 && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setLightboxZoomed(false);
                  setLightbox(prev => (prev ? { ...prev, index: prev.index + 1 } : null));
                }}
                className="absolute end-3 z-20 w-10 h-10 rounded-full bg-black/70 border border-white/15 text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>

          {lightbox.caption && (
            <div onClick={e => e.stopPropagation()} className="max-w-2xl mx-auto text-center text-xs text-white/80 line-clamp-2 pb-2">
              {lightbox.caption}
            </div>
          )}
        </div>
      )}

      {/* Story Viewer (Image & Video Stories + Interactive Reactions + Direct DM Reply!) */}
      {activeStory && (
        <div
          onClick={() => {
            setActiveStory(null);
            setStoryReplyText('');
            setStoryFeedback(null);
          }}
          className="fixed inset-0 z-[70] bg-black/94 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[420px] h-[86vh] rounded-[30px] overflow-hidden border border-white/[0.14] bg-black shadow-[0_32px_90px_rgba(0,0,0,0.9)]"
          >
            {isVideoMediaUrl(activeStory.mediaUrl) ? (
              <video src={activeStory.mediaUrl} autoPlay loop playsInline className="w-full h-full object-cover" />
            ) : (
              <img src={activeStory.mediaUrl} alt="" className="w-full h-full object-cover" />
            )}

            {/* Floating Story Reaction Burst Animation */}
            {storyBurstRx && (
              <motion.div
                key={`sburst_${storyBurstRx}_${Date.now()}`}
                initial={{ opacity: 0, scale: 0.4, y: 24 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.45, 1.2, 1.5], y: [24, -18, -45, -80] }}
                transition={{ duration: 0.65 }}
                className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
              >
                {resolveReaction(storyBurstRx).renderIcon(56)}
              </motion.div>
            )}

            {/* Top Header */}
            <div className="absolute inset-x-0 top-0 z-20 p-4 bg-gradient-to-b from-black/82 via-black/35 to-transparent flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const uid = activeStory.userId;
                  setActiveStory(null);
                  onOpenProfile?.(uid);
                }}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <UserAvatar initials={activeStory.avatarInitials} avatarUrl={activeStory.avatarUrl} size={34} />
                <div className="text-start">
                  <div className="text-xs font-semibold text-white group-hover:underline">{activeStory.displayName}</div>
                  <div className="text-[10px] text-white/65">{activeStory.createdAt}</div>
                </div>
              </button>
              <div className="flex items-center gap-2">
                {activeStory.userId === user.id && (
                  <div className="px-2.5 py-1 rounded-full bg-black/65 border border-white/15">
                    <QuickRemovePill onRemove={() => deleteStory(activeStory.id)} />
                  </div>
                )}
                <CloseOrbButton
                  onClick={() => {
                    setActiveStory(null);
                    setStoryReplyText('');
                    setStoryFeedback(null);
                  }}
                />
              </div>
            </div>

            {/* Bottom Interactive Stage: Caption + Sculpted Reaction Strip + Direct DM Reply Composer */}
            <div className="absolute inset-x-0 bottom-0 z-20 p-4 pt-12 bg-gradient-to-t from-black/95 via-black/75 to-transparent space-y-3">
              {activeStory.caption && (
                <div className="text-sm text-white leading-relaxed drop-shadow">
                  <RichMessageText
                    text={activeStory.caption}
                    onMentionClick={handle => {
                      setActiveStory(null);
                      onOpenProfileByUsername?.(handle);
                    }}
                    onHashtagClick={tag => {
                      setActiveStory(null);
                      onSelectHashtag?.(tag);
                    }}
                  />
                </div>
              )}

              {/* Sculpted Floating Story Reactions Strip (Like, Love, Fire, Haha, Wow, etc.) */}
              <div className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-full bg-black/55 backdrop-blur-xl border border-white/[0.12]">
                {REACTION_LIST.slice(0, 6).map(rx => {
                  const chosen = activeStory.myReaction === rx.id;
                  const count = activeStory.reactions?.[rx.id] || 0;
                  return (
                    <motion.button
                      key={rx.id}
                      type="button"
                      whileHover={{ scale: 1.18, y: -2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleStoryReact(activeStory.id, rx.id)}
                      title={rx.label}
                      className={`px-2 py-1 rounded-full flex items-center gap-1 cursor-pointer transition-colors ${
                        chosen ? 'bg-white/[0.18] ring-1 ring-white/35' : 'hover:bg-white/[0.08]'
                      }`}
                    >
                      {rx.renderIcon(22)}
                      {count > 0 && (
                        <span className="text-[10.5px] font-mono-num font-semibold text-white">{count}</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {storyFeedback && (
                <div className="px-3 py-1.5 rounded-full bg-[#10B981]/20 border border-[#34D399]/40 text-[11px] text-[#6EE7B7] flex items-center justify-between gap-2">
                  <span>{storyFeedback}</span>
                  {activeStory.userId !== user.id && onMessageUser && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetUid = activeStory.userId;
                        setActiveStory(null);
                        onMessageUser(targetUid);
                      }}
                      className="font-bold text-white underline cursor-pointer"
                    >
                      فتح المحادثة
                    </button>
                  )}
                </div>
              )}

              {/* Direct Reply to Story Author (Sends straight to real 1-on-1 DM!) */}
              {activeStory.userId !== user.id && (
                <form onSubmit={handleStoryReplySubmit} className="flex items-center gap-2">
                  <input
                    value={storyReplyText}
                    onChange={e => setStoryReplyText(e.target.value)}
                    placeholder={`رد على قصة ${activeStory.displayName.split(' ')[0]}...`}
                    className="flex-1 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/[0.18] focus:border-white/40 px-4 text-xs text-white placeholder:text-white/55 outline-none transition-colors"
                  />
                  {storyReplyText.trim() ? (
                    <button
                      type="submit"
                      disabled={sendingStoryReply}
                      title="إرسال الرد"
                      className="w-10 h-10 rounded-full bg-white text-black hover:opacity-90 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 transition-opacity"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    onMessageUser && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetUid = activeStory.userId;
                          setActiveStory(null);
                          onMessageUser(targetUid);
                        }}
                        title={`مراسلة ${activeStory.displayName}`}
                        className="w-10 h-10 rounded-full bg-white/[0.1] hover:bg-white/[0.2] border border-white/[0.18] text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2026 Story Studio Upload Modal */}
      {storyStudioOpen && (
        <StudioModalOverlay onClose={() => setStoryStudioOpen(false)}>
          <form onSubmit={publishStory}>
            <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
              <span className="text-sm font-bold text-white">إنشاء قصة جديدة</span>
              <CloseOrbButton onClick={() => setStoryStudioOpen(false)} />
            </div>

            <div className="p-4 space-y-3.5">
              {storyMediaUrl ? (
                <div className="relative aspect-[9/13] max-h-[50vh] mx-auto rounded-2xl overflow-hidden border border-white/[0.12] bg-black">
                  {isVideoMediaUrl(storyMediaUrl) ? (
                    <video src={storyMediaUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={storyMediaUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => storyFileRef.current?.click()}
                    className="absolute top-3 end-3 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[11px] font-medium text-white hover:bg-white hover:text-black transition-colors cursor-pointer"
                  >
                    تغيير
                  </button>
                  {storyCaption && (
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 to-transparent text-xs text-white">
                      {storyCaption}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingStory}
                  onClick={() => storyFileRef.current?.click()}
                  className="w-full aspect-[9/11] max-h-[42vh] rounded-2xl border border-dashed border-white/[0.18] hover:border-[#FB7185]/60 bg-[#0B0B0F] flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#F59E0B]/20 via-[#FB7185]/20 to-[#FF2D55]/20 border border-[#FB7185]/35 flex items-center justify-center text-[#FB7185] group-hover:scale-105 transition-transform">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-xs font-semibold text-white">
                      {uploadingStory ? 'جارٍ الفحص والرفع...' : 'اختر صورة أو فيديو قصير لقصتك'}
                    </div>
                    <div className="text-[11px] text-[#7A7A85]">JPG · PNG · WebP (10MB) · MP4 · WEBM (35MB)</div>
                  </div>
                </button>
              )}

              <input
                value={storyCaption}
                onChange={e => setStoryCaption(e.target.value)}
                placeholder="أضف تعليقًا أو #هاشتاج أو @منشن (اختياري)..."
                className="w-full h-11 rounded-2xl bg-[#0A0A0D] border border-white/[0.1] focus:border-[#FB7185]/50 px-3.5 text-xs text-white placeholder:text-[#63636C] outline-none transition-colors"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStoryStudioOpen(false)}
                  className="h-9 px-4 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs text-[#C4C4CC] hover:text-white cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <PublishActionButton
                  type="submit"
                  variant="rose"
                  loading={publishingStory}
                  disabled={!storyMediaUrl}
                  label="نشر القصة"
                  loadingLabel="جارٍ النشر..."
                />
              </div>
            </div>
          </form>
        </StudioModalOverlay>
      )}

      {/* 2026 Studio Audio & Music Library Modal (Pinned User Audio + 60s Voice Recorder + 10 Distinct Melodies) */}
      {musicPickerOpen && (
        <StudioModalOverlay
          zClass="z-[75]"
          onClose={() => {
            cancelLibVoiceRec();
            stopPreviewMusic();
            setMusicPickerOpen(false);
          }}
        >
          <div className="max-h-[85vh] flex flex-col">
            <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-2xl bg-[#10B981]/15 border border-[#34D399]/30 flex items-center justify-center text-[#34D399]">
                  <Music className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-sm font-bold text-white">{t(lang, 'audio_library')}</div>
                  <div className="text-[10.5px] text-[#8E8E93]">
                    {lang === 'en'
                      ? 'Record voice up to 1:00, upload audio, or pick studio melodies'
                      : 'سجّل صوتك حتى دقيقة أو ارفع مقطعًا أو اختر من ألحان الاستوديو'}
                  </div>
                </div>
              </div>
              <CloseOrbButton
                onClick={() => {
                  cancelLibVoiceRec();
                  stopPreviewMusic();
                  setMusicPickerOpen(false);
                }}
              />
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              {/* Studio Capture Strip: Sleek Non-Red Live Cyan Voice Recorder OR Fast Audio File Upload */}
              {libRecording ? (
                <div className="p-3.5 rounded-2xl bg-[#191C26] border border-[#25F4EE]/35 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#25F4EE] animate-pulse shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {user.displayName} · LM
                        </div>
                        <div className="text-[11px] font-mono-num text-[#25F4EE]">
                          {formatDurationMMSS(libRecordSec)} / 1:00
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={cancelLibVoiceRec}
                        className="px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[11px] text-[#D4D4D8] cursor-pointer"
                      >
                        {t(lang, 'cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={stopLibVoiceRec}
                        className="px-3.5 py-1.5 rounded-full bg-[#25F4EE] text-black text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span>{lang === 'en' ? 'Save Audio' : 'حفظ الصوت'}</span>
                      </button>
                    </div>
                  </div>
                  {/* Live Real-Time Cyan Voice Waveform */}
                  <div className="h-7 flex items-center justify-center gap-[3px] px-1">
                    {libRecBars.map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}%` }}
                        className="flex-1 max-w-[8px] rounded-full bg-[#25F4EE]/85 transition-[height] duration-75"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={uploadingCustomAudio}
                    onClick={startLibVoiceRec}
                    className="px-3 py-3 rounded-2xl border border-white/[0.12] hover:border-[#25F4EE]/55 bg-[#181A22] text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-45"
                  >
                    <Mic className="w-4 h-4 text-[#25F4EE] shrink-0" />
                    <span className="truncate">{t(lang, 'record_voice_1m')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={uploadingCustomAudio}
                    onClick={() => customAudioRef.current?.click()}
                    className="px-3 py-3 rounded-2xl border border-dashed border-white/[0.18] hover:border-[#34D399]/60 bg-[#181A22] text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-45"
                  >
                    <Upload className="w-4 h-4 text-[#34D399] shrink-0" />
                    <span className="truncate">
                      {uploadingCustomAudio ? (lang === 'en' ? 'Uploading...' : 'جارٍ الحفظ السريع...') : t(lang, 'upload_audio')}
                    </span>
                  </button>
                </div>
              )}

              {/* Mood Filter Pills */}
              {(() => {
                const userTracks = musicLibrary.filter(tr => tr.isUserTrack);
                const moods = Array.from(new Set(musicLibrary.filter(tr => !tr.isUserTrack).map(tr => tr.mood)));
                const filteredTracks =
                  musicMoodFilter === 'all'
                    ? musicLibrary
                    : musicMoodFilter === 'mine'
                      ? userTracks
                      : musicLibrary.filter(tr => !tr.isUserTrack && tr.mood === musicMoodFilter);

                return (
                  <>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      <button
                        type="button"
                        onClick={() => setMusicMoodFilter('all')}
                        className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 cursor-pointer transition-colors ${
                          musicMoodFilter === 'all'
                            ? 'bg-white text-black font-semibold'
                            : 'bg-white/[0.06] text-[#A1A1AA] hover:text-white'
                        }`}
                      >
                        {t(lang, 'all')} ({musicLibrary.length})
                      </button>
                      {userTracks.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setMusicMoodFilter('mine')}
                          className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 cursor-pointer transition-colors ${
                            musicMoodFilter === 'mine'
                              ? 'bg-[#34D399] text-black font-semibold'
                              : 'bg-[#10B981]/15 text-[#6EE7B7] border border-[#34D399]/30 hover:bg-[#10B981]/25'
                          }`}
                        >
                          {t(lang, 'my_uploads')} ({userTracks.length})
                        </button>
                      )}
                      {moods.map(mood => (
                        <button
                          key={mood}
                          type="button"
                          onClick={() => setMusicMoodFilter(mood)}
                          className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 cursor-pointer transition-colors ${
                            musicMoodFilter === mood
                              ? 'bg-white text-black font-semibold'
                              : 'bg-white/[0.06] text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          {mood}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      {filteredTracks.map(track => {
                        const isPreviewing = previewingMusicUrl === track.url;
                        const isChosen = selectedMusic?.url === track.url;
                        const accent = track.accent || (track.isUserTrack ? '#34D399' : '#FBBF24');
                        return (
                          <div
                            key={track.id}
                            className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 transition-colors ${
                              isChosen
                                ? 'bg-[#10B981]/14 border-[#34D399]/45'
                                : track.isUserTrack
                                  ? 'bg-[#111514] border-[#34D399]/22 hover:border-[#34D399]/45'
                                  : 'bg-[#0C0C10] border-white/[0.08] hover:border-white/[0.16]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => togglePreviewTrack(track.url)}
                              style={isPreviewing ? { backgroundColor: accent, color: '#0A0A0C' } : undefined}
                              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                                isPreviewing ? '' : 'bg-white/[0.08] text-white hover:bg-white/[0.16]'
                              }`}
                            >
                              {isPreviewing ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4 fill-current" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-white truncate">{track.title}</span>
                                {track.isUserTrack && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-[#34D399]/18 text-[#6EE7B7] text-[9.5px] font-semibold shrink-0">
                                    {track.kind === 'voice' ? (lang === 'en' ? 'Voice' : 'تسجيلك') : t(lang, 'my_uploads')}
                                  </span>
                                )}
                                {isPreviewing && (
                                  <span className="inline-flex items-end gap-[2px] h-3 shrink-0 ms-0.5">
                                    <span style={{ backgroundColor: accent }} className="w-[2px] h-2 rounded-full animate-pulse" />
                                    <span style={{ backgroundColor: accent }} className="w-[2px] h-3 rounded-full animate-pulse [animation-delay:140ms]" />
                                    <span style={{ backgroundColor: accent }} className="w-[2px] h-1.5 rounded-full animate-pulse [animation-delay:280ms]" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[10.5px] text-[#8E8E93] flex items-center gap-1.5 truncate mt-0.5">
                                <span>{track.artist}</span>
                                <span>·</span>
                                <span>{track.mood}</span>
                                <span>·</span>
                                <span className="font-mono-num text-[#C4C4CC]">{formatDurationMMSS(track.durationSec)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {track.isUserTrack && (
                                <button
                                  type="button"
                                  onClick={() => deleteUserAudioTrack(track.id)}
                                  title={t(lang, 'remove')}
                                  className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-[#FB7185]/20 text-[#8E8E93] hover:text-[#FB7185] flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMusic({
                                    url: track.url,
                                    title: track.isUserTrack ? track.title : `${track.title} — ${track.artist}`,
                                  });
                                  stopPreviewMusic();
                                  setMusicPickerOpen(false);
                                }}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                                  isChosen
                                    ? 'bg-[#34D399] text-black'
                                    : 'bg-white/[0.09] hover:bg-white hover:text-black text-white'
                                }`}
                              >
                                {isChosen ? (lang === 'en' ? 'Selected' : 'محدّد') : lang === 'en' ? 'Select' : 'اختيار'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </StudioModalOverlay>
      )}

      {/* FULL-PAGE REPOST & QUOTE COMPOSER PAGE ("شارك لحظة أو اكتب أفكارك" + Full Original Post & Real Stats Below!) */}
      {quotingPost && (
        <form
          onSubmit={submitQuotePost}
          onClick={e => e.stopPropagation()}
          className="fixed inset-0 z-[78] bg-[#121212] text-[#F1F1F2] flex flex-col overflow-hidden"
        >
          {/* Floating Borderless Top Header */}
          <header
            style={{ paddingTop: 'max(14px, calc(env(safe-area-inset-top) + 8px))' }}
            className="shrink-0 px-4 sm:px-6 pb-3 flex items-center justify-between max-w-[760px] w-full mx-auto"
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setQuotingPost(null)}
                aria-label={t(lang, 'back')}
                className="w-10 h-10 rounded-full text-white hover:bg-white/[0.08] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
              >
                {lang === 'en' ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
              </button>
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-white truncate">
                  {lang === 'en' ? 'Repost' : 'إعادة النشر'}
                </div>
                <div className="text-[11px] text-[#8E8E93] truncate">
                  {lang === 'en' ? 'Write your thoughts or publish directly' : 'اكتب أفكارك واقتباسك أو انشر مباشرة'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {quotingPost.repostedByMe && !quoteDraft.trim() && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleRepost(quotingPost.id);
                    setQuotingPost(null);
                  }}
                  className="h-9 px-3.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-[#FDA4AF] cursor-pointer transition-colors"
                >
                  {lang === 'en' ? 'Undo Repost' : 'إلغاء الإعادة'}
                </button>
              )}
              <button
                type="submit"
                disabled={publishingQuote}
                className="h-9 px-5 rounded-full bg-[#FE2C55] hover:bg-[#E5254B] text-white text-xs font-bold cursor-pointer disabled:opacity-40 transition-colors"
              >
                {publishingQuote
                  ? lang === 'en'
                    ? 'Publishing...'
                    : 'جارٍ النشر...'
                  : quoteDraft.trim()
                    ? lang === 'en'
                      ? 'Publish'
                      : 'نشر الاقتباس'
                    : lang === 'en'
                      ? 'Repost Now'
                      : 'نشر'}
              </button>
            </div>
          </header>

          {/* Open Spacious Composer + Full Original Post with Likes, Comments & Shares Below */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-3 pb-24 max-w-[760px] w-full mx-auto space-y-6">
            {/* User Quote / Moment Writing Area */}
            <div className="flex items-start gap-3">
              <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={42} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white mb-1">{user.displayName}</div>
                <textarea
                  autoFocus
                  rows={4}
                  value={quoteDraft}
                  onChange={e => setQuoteDraft(e.target.value)}
                  placeholder={
                    lang === 'en'
                      ? 'Share a moment or write your thoughts on this post... (optional)'
                      : 'شارك اللحظة أو اكتب أفكارك واقتباسك هنا... (اختياري)'
                  }
                  className="w-full min-h-[120px] bg-transparent resize-none text-[17px] leading-[1.75] text-[#F1F1F2] placeholder:text-[#6E707D] outline-none"
                />
              </div>
            </div>

            {/* Full Original Post Preview Below — Exact Layout + Likes, Comments & Reposts Counts! */}
            <div className="rounded-3xl bg-[#181920] border border-white/[0.09] p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar initials={quotingPost.avatarInitials} avatarUrl={quotingPost.avatarUrl} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-white truncate">
                    <span className="truncate">{quotingPost.displayName}</span>
                    {quotingPost.verified && <VerifiedIcon />}
                  </div>
                  <div className="text-[11.5px] text-[#8E8E93] font-mono-num truncate">
                    @{quotingPost.username} · {quotingPost.createdAt}
                  </div>
                </div>
              </div>

              {quotingPost.content && (
                <div className="text-[14.5px] text-[#E8E8EE] leading-[1.65] whitespace-pre-wrap break-words">
                  <RichMessageText text={quotingPost.content} maxChars={600} lang={lang} />
                </div>
              )}

              {quotingPost.musicUrl && quotingPost.mediaUrls.length === 0 && (
                <div className="p-2.5 rounded-2xl bg-[#121319]">
                  <SmartVoicePill
                    url={quotingPost.musicUrl}
                    title={quotingPost.musicTitle || (lang === 'en' ? 'Attached Audio' : 'مقطع صوتي')}
                    compact
                  />
                </div>
              )}

              {quotingPost.mediaUrls.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-white/[0.08]">
                  <MediaCollageGrid urls={quotingPost.mediaUrls} onSelect={() => {}} />
                </div>
              )}

              {/* Exact Original Post Metrics Bar (Likes + Comments + Reposts/Shares) */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center gap-6 text-xs text-[#A6A7B2] flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  {resolveReaction(quotingPost.myReaction || 'love').renderIcon(16)}
                  <span className="font-mono-num font-semibold text-white">{formatCount(quotingPost.score)}</span>
                  <span>{lang === 'en' ? 'Likes' : 'إعجاب'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-[#A6A7B2]" />
                  <span className="font-mono-num font-semibold text-white">{formatCount(quotingPost.commentsCount)}</span>
                  <span>{lang === 'en' ? 'Comments' : 'تعليق'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Repeat2 className="w-4 h-4 text-[#25F4EE]" />
                  <span className="font-mono-num font-semibold text-white">{formatCount(quotingPost.sharesCount)}</span>
                  <span>{lang === 'en' ? 'Reposts' : 'إعادة نشر'}</span>
                </span>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Smooth Scrollable Bottom Language Sheet for Comment Translation */}
      <TranslateSheetModal
        open={Boolean(translateTargetComment)}
        lang={lang}
        onClose={() => setTranslateTargetComment(null)}
        onSelectLanguage={code => {
          if (translateTargetComment) {
            translateCommentText(translateTargetComment.id, translateTargetComment.content, code);
          }
        }}
      />

      {/* Universal Discreet Content Reporting Sheet/Modal */}
      <ReportContentModal
        request={reportRequest}
        reporterId={user.id}
        lang={lang}
        onClose={() => setReportRequest(null)}
        onReported={res => {
          if (res.targetType === 'post') {
            setPosts(prev =>
              prev.map(p =>
                p.id === res.targetId
                  ? { ...p, reportsCount: res.reportsCount, isSensitive: res.isSensitive }
                  : p
              )
            );
          } else if (res.targetType === 'post_comment') {
            setCommentsByPost(prev => {
              const next = { ...prev };
              for (const pid of Object.keys(next)) {
                next[pid] = next[pid].map(c =>
                  c.id === res.targetId
                    ? { ...c, reportsCount: res.reportsCount, isSensitive: res.isSensitive }
                    : c
                );
              }
              return next;
            });
          }
        }}
      />
    </div>
  );
}
