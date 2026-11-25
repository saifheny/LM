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
  Pause,
  RotateCcw,
  RotateCw,
} from 'lucide-react';

import { Lang, ShortVideoItem, UserProfile, VideoCommentItem } from '../../types';
import { UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ObsidianComposerPill, ChromeArrowButton } from '../shared/HardwareUI';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { TapBurstItem, TapBurstOverlay, createTapBurst } from '../shared/TapComboBurst';
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
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function ShortVideosView({ user, lang }: ShortVideosViewProps) {
  const [videos, setVideos] = useState<ShortVideoItem[]>([]);
  const [feedTab, setFeedTab] = useState<'following' | 'friends' | 'for_you'>('for_you');
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(15);
  const [seekBadge, setSeekBadge] = useState<'back' | 'forward' | null>(null);

  // Rapid multi-tap burst engine (TikTok multi-design bursts)
  const [bursts, setBursts] = useState<TapBurstItem[]>([]);
  const comboRef = useRef({ count: 0, lastMs: 0 });
  const singleTapTimerRef = useRef<number | null>(null);

  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  // Comments Drawer
  const [drawerVideo, setDrawerVideo] = useState<ShortVideoItem | null>(null);
  const [comments, setComments] = useState<VideoCommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);

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
  }, [loadVideos]);

  const orderedVideos = React.useMemo(() => {
    if (feedTab === 'following') return [...videos].reverse();
    if (feedTab === 'friends') return videos.slice(1).concat(videos.slice(0, 1));
    return videos;
  }, [videos, feedTab]);

  useEffect(() => {
    setPaused(false);
    setCurrentTime(0);
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

  function getActiveVideoEl() {
    return videoRefs.current[activeIndex] || null;
  }

  function togglePlayPause() {
    const el = getActiveVideoEl();
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  }

  function seekBy(deltaSec: number) {
    const el = getActiveVideoEl();
    if (!el) return;
    const dur = el.duration || duration || 15;
    el.currentTime = Math.max(0, Math.min(dur, el.currentTime + deltaSec));
    setCurrentTime(el.currentTime);
    setSeekBadge(deltaSec < 0 ? 'back' : 'forward');
    setTimeout(() => setSeekBadge(null), 550);
  }

  function scrubTo(val: number) {
    const el = getActiveVideoEl();
    if (!el) return;
    el.currentTime = val;
    setCurrentTime(val);
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

  /**
   * TikTok-Accurate Stage Tap Handler:
   * - Single tap -> Play / Pause cleanly
   * - Rapid multi-taps (< 320ms) -> Multi-design TikTok Burst + Like Combo!
   */
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
      transcript: 'رسالة صوتية مسجلة في التعليقات.',
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
      {/* Centered TikTok Reels Column */}
      <div className="relative w-full h-full max-w-[500px] mx-auto bg-black overflow-hidden">
        {/* Exact TikTok Centered Top Navigation Tabs: متابعون | أصدقاء | لك */}
        <div className="absolute top-4 inset-x-4 z-30 flex items-center justify-between pointer-events-none">
          <button
            type="button"
            onClick={() => setMuted(m => !m)}
            className="pointer-events-auto w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/[0.12] text-white flex items-center justify-center cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Dead-Center Tabs */}
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

        {/* Full-Screen Vertical Swiper */}
        <Swiper
          direction="vertical"
          modules={[Mousewheel, Keyboard]}
          mousewheel
          keyboard={{ enabled: true }}
          slidesPerView={1}
          onSlideChange={(sw: SwiperClass) => setActiveIndex(sw.activeIndex)}
          className="w-full h-full"
        >
          {orderedVideos.map((v, idx) => (
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
                    if (idx === activeIndex) {
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

                {/* TikTok Rapid-Tap Multi-Design Bursts */}
                {idx === activeIndex && <TapBurstOverlay items={bursts} />}

                {/* Centered TikTok Playback & Seek Controls (-5s | Play/Pause | +5s) */}
                {idx === activeIndex && paused && (
                  <div
                    onClick={e => e.stopPropagation()}
                    className="absolute inset-0 z-20 flex items-center justify-center gap-6 bg-black/25"
                  >
                    <button
                      type="button"
                      onClick={() => seekBy(-5)}
                      title="-5 ثوانٍ"
                      className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-transform"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span className="text-[9px] font-mono-num">5s</span>
                    </button>

                    <button
                      type="button"
                      onClick={togglePlayPause}
                      className="w-16 h-16 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                    >
                      <Play className="w-7 h-7 fill-current ms-0.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => seekBy(5)}
                      title="+5 ثوانٍ"
                      className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-transform"
                    >
                      <RotateCw className="w-4 h-4" />
                      <span className="text-[9px] font-mono-num">5s</span>
                    </button>
                  </div>
                )}

                {/* Quick Seek Indicator */}
                {idx === activeIndex && seekBadge && (
                  <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-4 py-1.5 rounded-full bg-black/75 border border-white/15 text-xs font-mono-num text-white">
                    {seekBadge === 'back' ? '« 5s-' : '+5s »'}
                  </div>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                {/* Bottom Metadata */}
                <div onClick={e => e.stopPropagation()} className="absolute bottom-24 md:bottom-12 start-4 end-16 z-20 text-start space-y-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <span>@{v.username}</span>
                    {v.verified && <VerifiedIcon />}
                  </div>
                  <p className="text-[13.5px] text-white/95 leading-snug">{v.title}</p>
                  {v.tags && <p className="text-xs text-white/65">{v.tags}</p>}
                  <div className="flex items-center gap-2 text-xs text-white/80 pt-0.5">
                    <Music2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{v.audioTitle}</span>
                  </div>
                </div>

                {/* Right TikTok Action Rail (Static Crisp Audio Badge — Zero Wobbling/Spinning!) */}
                <div onClick={e => e.stopPropagation()} className="absolute bottom-24 md:bottom-12 end-3 z-20 flex flex-col items-center gap-4">
                  <UserAvatar initials={v.avatarInitials} avatarUrl={v.avatarUrl} size={42} />

                  <button
                    type="button"
                    onClick={() => toggleLike(v)}
                    className="flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <Heart
                      className={`w-7 h-7 ${v.likedByMe ? 'text-[#FF2D55] fill-current' : 'text-white'}`}
                      strokeWidth={1.9}
                    />
                    <span className="text-[11px] font-mono-num text-white">{compactNum(v.likesCount)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openComments(v)}
                    className="flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <MessageCircle className="w-7 h-7 text-white" strokeWidth={1.9} />
                    <span className="text-[11px] font-mono-num text-white">{compactNum(v.commentsCount)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleSave(v)}
                    className="flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <Bookmark
                      className={`w-6 h-6 ${v.savedByMe ? 'text-[#FACC15] fill-current' : 'text-white'}`}
                      strokeWidth={1.9}
                    />
                    <span className="text-[11px] font-mono-num text-white">{compactNum(v.savesCount)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(window.location.href)}
                    className="flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <Share2 className="w-6 h-6 text-white" strokeWidth={1.9} />
                  </button>

                  {/* Clean Static Audio Thumbnail (No erratic motion!) */}
                  <div className="w-9 h-9 rounded-xl bg-[#141417] border border-white/20 flex items-center justify-center">
                    <Music2 className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* TikTok Bottom Scrubber Bar + Time + Quick Skip/Pause Controls */}
                {idx === activeIndex && (
                  <div
                    onClick={e => e.stopPropagation()}
                    className="absolute bottom-16 md:bottom-2 inset-x-4 z-30 flex items-center gap-2.5"
                  >
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      className="text-white/85 hover:text-white cursor-pointer shrink-0"
                    >
                      {paused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => seekBy(-5)}
                      className="text-white/70 hover:text-white cursor-pointer shrink-0"
                      title="-5s"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, duration)}
                      step={0.1}
                      value={Math.min(currentTime, duration)}
                      onChange={e => scrubTo(Number(e.target.value))}
                      className="flex-1 h-1 accent-white bg-white/25 rounded-full cursor-pointer"
                    />

                    <button
                      type="button"
                      onClick={() => seekBy(5)}
                      className="text-white/70 hover:text-white cursor-pointer shrink-0"
                      title="+5s"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-[10.5px] font-mono-num text-white/75 shrink-0">
                      {fmtSec(currentTime)} / {fmtSec(duration)}
                    </span>
                  </div>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Comments & Voice-Replies Drawer */}
      {drawerVideo && (
        <div onClick={() => setDrawerVideo(null)} className="fixed inset-0 z-50 bg-black/65 flex items-end justify-center">
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[520px] h-[68vh] rounded-t-3xl bg-[#050507] border-t border-x border-white/[0.12] flex flex-col overflow-hidden"
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
                          <span className="font-semibold text-[#F5F5F7]">{c.displayName}</span>
                          <span className="text-[#71717A]">{c.createdAt}</span>
                        </div>
                        {c.audioUrl ? (
                          <div className="mt-1.5 p-2.5 rounded-2xl bg-[#0D0D10] border border-white/[0.08]">
                            <SmartVoicePill url={c.audioUrl} transcript={c.transcript} compact />
                          </div>
                        ) : (
                          <p className="text-[13.5px] text-[#E4E4E7] mt-0.5 leading-relaxed">{c.content}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setReplyTo({ id: c.id, name: c.displayName })}
                          className="mt-1.5 text-[11px] text-[#71717A] hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          <CornerDownLeft className="w-3 h-3" />
                          <span>رد</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCommentLike(c.id)}
                        className="flex flex-col items-center gap-0.5 text-[#71717A] hover:text-white cursor-pointer"
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
                                <span className="font-semibold text-[#F5F5F7]">{rep.displayName}</span>
                                <span className="text-[#71717A]">{rep.createdAt}</span>
                              </div>
                              {rep.audioUrl ? (
                                <div className="mt-1 p-2 rounded-xl bg-[#0D0D10] border border-white/[0.08]">
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

            <div className="p-3 bg-black">
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
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#71717A] hover:text-white cursor-pointer shrink-0"
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
            className="w-full max-w-[400px] rounded-2xl bg-[#070709] border border-white/[0.12] p-5 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <span className="text-sm font-semibold text-white">نشر ريلز</span>
              <button type="button" onClick={() => setUploadOpen(false)} className="text-[#71717A] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="العنوان..."
              className="w-full h-11 rounded-xl bg-black border border-white/[0.1] px-3.5 text-xs text-white outline-none"
            />
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="الوسوم..."
              className="w-full h-11 rounded-xl bg-black border border-white/[0.1] px-3.5 text-xs text-white outline-none"
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
