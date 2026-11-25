import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, Keyboard } from 'swiper/modules';
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
  X,
  Mic,
  CornerDownLeft,
  Play,
  Link2,
  Download,
  Repeat2,
  Flag,
  EyeOff,
  Check,
  Send,
} from 'lucide-react';

import { ConversationItem, Lang, ShortVideoItem, UserProfile, VideoCommentItem } from '../../types';
import { UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ObsidianComposerPill, ChromeArrowButton } from '../shared/HardwareUI';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { TapBurstItem, TapBurstOverlay, createTapBurst } from '../shared/TapComboBurst';
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

const SHARE_PLATFORMS = [
  { id: 'copy', label: 'نسخ الرابط', bg: '#27272F', glyph: '🔗' },
  { id: 'whatsapp', label: 'واتساب', bg: '#16A34A', glyph: '💬' },
  { id: 'telegram', label: 'تيليجرام', bg: '#0284C7', glyph: '✈️' },
  { id: 'instagram', label: 'إنستجرام', bg: '#DB2777', glyph: '📷' },
  { id: 'x', label: 'X', bg: '#18181B', glyph: '𝕏' },
  { id: 'facebook', label: 'فيسبوك', bg: '#2563EB', glyph: 'f' },
  { id: 'sms', label: 'رسائل', bg: '#059669', glyph: '✉️' },
];

export function ShortVideosView({ user, lang }: ShortVideosViewProps) {
  const { setBottomDockHidden } = useLayout();
  const [videos, setVideos] = useState<ShortVideoItem[]>([]);
  const [feedTab, setFeedTab] = useState<'following' | 'friends' | 'for_you'>('for_you');
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});

  // Rapid multi-tap burst engine
  const [bursts, setBursts] = useState<TapBurstItem[]>([]);
  const comboRef = useRef({ count: 0, lastMs: 0 });
  const singleTapTimerRef = useRef<number | null>(null);
  const prevSlideIdxRef = useRef(0);

  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  // Comments Drawer
  const [drawerVideo, setDrawerVideo] = useState<ShortVideoItem | null>(null);
  const [comments, setComments] = useState<VideoCommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);

  // Authentic TikTok Bottom Share Sheet
  const [shareVideo, setShareVideo] = useState<ShortVideoItem | null>(null);
  const [contacts, setContacts] = useState<ConversationItem[]>([]);
  const [sentToIds, setSentToIds] = useState<Record<string, boolean>>({});
  const [shareToast, setShareToast] = useState('');

  // Upload Reel Modal
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
    setProgressPct(0);
    Object.entries(videoRefs.current).forEach(([idxStr, el]) => {
      if (!el) return;
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

  function handleStagePointer(e: React.MouseEvent<HTMLDivElement>, v: ShortVideoItem) {
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

  async function sendReelToContact(conv: ConversationItem) {
    if (!shareVideo) return;
    setSentToIds(prev => ({ ...prev, [conv.id]: true }));
    await apiPost(`/api/conversations/${conv.id}/messages`, {
      senderId: user.id,
      content: `شارك فيديو: ${shareVideo.title.slice(0, 70)}`,
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
    if (!drawerVideo || !commentDraft.trim()) return;
    await apiPost(`/api/videos/${drawerVideo.id}/comments`, {
      userId: user.id,
      content: commentDraft.trim(),
      parentId: replyTo?.id || null,
    });
    setCommentDraft('');
    setReplyTo(null);
    const res = await apiGet<{ ok: boolean; comments: VideoCommentItem[] }>(`/api/videos/${drawerVideo.id}/comments?userId=${user.id}`);
    setComments(res.comments);
    setVideos(prev => prev.map(v => (v.id === drawerVideo.id ? { ...v, commentsCount: v.commentsCount + 1 } : v)));
  }

  async function submitVoiceComment(file: File, durationSec: number) {
    if (!drawerVideo) return;
    setRecordingVoice(false);
    const up = await apiUploadFile(file);
    await apiPost(`/api/videos/${drawerVideo.id}/comments`, {
      userId: user.id,
      content: '',
      parentId: replyTo?.id || null,
      audioUrl: up.url,
      audioDurationSec: durationSec,
      transcript: 'رسالة صوتية.',
    });
    setReplyTo(null);
    const res = await apiGet<{ ok: boolean; comments: VideoCommentItem[] }>(`/api/videos/${drawerVideo.id}/comments?userId=${user.id}`);
    setComments(res.comments);
    setVideos(prev => prev.map(v => (v.id === drawerVideo.id ? { ...v, commentsCount: v.commentsCount + 1 } : v)));
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

  async function publishReel(e: React.FormEvent) {
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

  return (
    <div className="w-full h-full bg-black relative overflow-hidden flex items-center justify-center">
      <div className="relative w-full h-full max-w-[500px] mx-auto bg-black overflow-hidden">
        {/* Centered Top TikTok Tabs: متابعون | أصدقاء | لك */}
        <div className="absolute top-4 inset-x-4 z-30 flex items-center justify-between pointer-events-none">
          <button
            type="button"
            onClick={() => setMuted(m => !m)}
            className="pointer-events-auto w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/[0.12] text-white flex items-center justify-center cursor-pointer"
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

        {/* Full-Screen Vertical Swiper (Scroll down shrinks & hides bottom dock, scroll up brings it back!) */}
        <Swiper
          direction="vertical"
          modules={[Mousewheel, Keyboard]}
          mousewheel
          keyboard={{ enabled: true }}
          slidesPerView={1}
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
                <div onClick={e => handleStagePointer(e, v)} className="w-full h-full relative cursor-pointer">
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
                      if (idx === activeIndex && e.currentTarget.duration) {
                        setProgressPct((e.currentTarget.currentTime / e.currentTarget.duration) * 100);
                      }
                    }}
                    className="w-full h-full object-cover"
                  />

                  {idx === activeIndex && <TapBurstOverlay items={bursts} />}

                  {/* EXACT TIKTOK TRANSLUCENT CENTERED PAUSE ICON (Zero seek buttons, zero dark circle box!) */}
                  {idx === activeIndex && paused && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                      <Play className="w-16 h-16 text-white/60 fill-white/60 drop-shadow-[0_4px_20px_rgba(0,0,0,0.45)]" />
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                  {/* Bottom Metadata with Expandable "المزيد / أقل" for Long Titles */}
                  <div
                    onClick={e => e.stopPropagation()}
                    className="absolute bottom-20 md:bottom-8 start-4 end-16 z-20 text-start space-y-1"
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
                            className="text-white/70 hover:text-white font-semibold cursor-pointer"
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
                              className="ms-1.5 text-white/70 hover:text-white font-semibold cursor-pointer"
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
                  <div onClick={e => e.stopPropagation()} className="absolute bottom-20 md:bottom-8 end-3 z-20 flex flex-col items-center gap-4">
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

                  {/* Razor-Thin 2px Hairline Playback Progress Indicator */}
                  {idx === activeIndex && (
                    <div className="pointer-events-none absolute bottom-0 inset-x-0 h-[2px] bg-white/15 z-20">
                      <div style={{ width: `${progressPct}%` }} className="h-full bg-white/80 transition-[width] duration-150" />
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
      </div>

      {/* FULL TIKTOK BOTTOM SHARE SHEET */}
      {shareVideo && (
        <div onClick={() => setShareVideo(null)} className="fixed inset-0 z-50 bg-black/65 flex items-end justify-center">
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[500px] rounded-t-[26px] bg-[#131318]/97 backdrop-blur-2xl border-t border-white/[0.12] pb-6 pt-3 px-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="w-7" />
              <span className="text-xs font-semibold text-white">مشاركة إلى</span>
              <button
                type="button"
                onClick={() => setShareVideo(null)}
                className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#8E8E93] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
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
                      onClick={() => sendReelToContact(c)}
                      className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer group"
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

            {/* Row 2: External Platforms */}
            <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar pt-1 border-t border-white/[0.07]">
              {SHARE_PLATFORMS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    showToast(p.id === 'copy' ? 'تم نسخ الرابط' : `تم تجهيز المشاركة عبر ${p.label}`);
                    setShareVideo(null);
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-14 cursor-pointer"
                >
                  <div
                    style={{ backgroundColor: p.bg }}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white text-base font-bold"
                  >
                    {p.glyph}
                  </div>
                  <span className="text-[10.5px] text-[#A1A1AA] truncate w-full text-center">{p.label}</span>
                </button>
              ))}
            </div>

            {/* Row 3: Video Quick Actions */}
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
                    a.download = `lm-reel-${shareVideo.id}.mp4`;
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

      {/* Comments & Voice-Replies Sheet */}
      {drawerVideo && (
        <div onClick={() => setDrawerVideo(null)} className="fixed inset-0 z-50 bg-black/65 flex items-end justify-center">
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[520px] h-[68vh] rounded-t-[26px] bg-[#121216] border-t border-x border-white/[0.12] flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <span className="text-xs font-semibold text-white">{comments.length} تعليق</span>
              <button
                type="button"
                onClick={() => setDrawerVideo(null)}
                className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#8E8E93] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {rootComments.map(c => {
                const sub = repliesOf(c.id);
                return (
                  <div key={c.id} className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <UserAvatar initials={c.avatarInitials} avatarUrl={c.avatarUrl} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-[#F2F2F5]">{c.displayName}</span>
                          <span className="text-[#7A7A85]">{c.createdAt}</span>
                        </div>
                        {c.audioUrl ? (
                          <div className="mt-1.5 p-2.5 rounded-2xl bg-[#1A1A20] border border-white/[0.08]">
                            <SmartVoicePill url={c.audioUrl} transcript={c.transcript} compact />
                          </div>
                        ) : (
                          <p className="text-[13.5px] text-[#E4E4E7] mt-0.5 leading-relaxed">{c.content}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setReplyTo({ id: c.id, name: c.displayName })}
                          className="mt-1.5 text-[11px] text-[#7A7A85] hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          <CornerDownLeft className="w-3 h-3" />
                          <span>رد</span>
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
                              <div className="flex items-center gap-1.5 text-[11.5px]">
                                <span className="font-semibold text-[#F2F2F5]">{rep.displayName}</span>
                                <span className="text-[#7A7A85]">{rep.createdAt}</span>
                              </div>
                              {rep.audioUrl ? (
                                <div className="mt-1 p-2 rounded-xl bg-[#1A1A20] border border-white/[0.08]">
                                  <SmartVoicePill url={rep.audioUrl} transcript={rep.transcript} compact />
                                </div>
                              ) : (
                                <p className="text-[13px] text-[#D4D4D8] mt-0.5">{rep.content}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-[#0E0E12]">
              {replyTo && (
                <div className="mb-1.5 px-3 flex items-center justify-between text-[11px] text-[#8E8E93]">
                  <span>الرد على {replyTo.name}</span>
                  <button type="button" onClick={() => setReplyTo(null)} className="hover:text-white cursor-pointer">
                    إلغاء
                  </button>
                </div>
              )}

              {recordingVoice ? (
                <LiveVoiceRecorder onCancel={() => setRecordingVoice(false)} onSend={submitVoiceComment} />
              ) : (
                <ObsidianComposerPill
                  value={commentDraft}
                  onChange={setCommentDraft}
                  onSubmit={submitTextComment}
                  placeholder={lang === 'ar' ? 'أضف تعليقًا...' : 'Add comment...'}
                  extraEnd={
                    <button
                      type="button"
                      onClick={() => setRecordingVoice(true)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#7A7A85] hover:text-white cursor-pointer shrink-0"
                    >
                      <Mic className="w-[18px] h-[18px]" strokeWidth={1.8} />
                    </button>
                  }
                  disabled={!commentDraft.trim()}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Reel Modal */}
      {uploadOpen && (
        <div onClick={() => setUploadOpen(false)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={publishReel}
            className="w-full max-w-[400px] rounded-2xl bg-[#131318] border border-white/[0.12] p-5 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <span className="text-sm font-semibold text-white">نشر ريلز</span>
              <button type="button" onClick={() => setUploadOpen(false)} className="text-[#7A7A85] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
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
