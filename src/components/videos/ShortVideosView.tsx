import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Play,
  Volume2,
  VolumeX,
  Plus,
  Check,
  Music2,
  Sparkles,
  Upload,
  X,
  ChevronUp,
  ChevronDown,
  Send,
  Megaphone,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, uploadFile } from '../../lib/api';
import { ShortVideoItem } from '../../types';
import { UserAvatar, VerifiedIcon, VipBadge } from '../shared/LmBrandMark';

interface VideoCommentRow {
  id: string;
  display_name: string;
  username: string;
  avatar_color: string;
  avatar_initials: string;
  avatar_url: string | null;
  vip_tier: number;
  content: string;
  likes_count: number;
  created_at: string;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Individual Full-Screen Loops / TikTok Slide */
function ReelSlide({
  item,
  isActive,
  muted,
  onToggleMute,
  onLike,
  onSave,
  onOpenComments,
  onShare,
  onSummarize,
  isAr,
}: {
  item: ShortVideoItem;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onSave: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  onSummarize: () => void;
  isAr: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [burstHearts, setBurstHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.currentTime = 0;
      el.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      el.pause();
      setPaused(false);
    }
  }, [isActive]);

  function handleSingleTap() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  }

  function handleDoubleTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setBurstHearts(prev => [...prev, { id, x, y }]);
    setTimeout(() => setBurstHearts(prev => prev.filter(h => h.id !== id)), 1000);
    if (!item.likedByMe) onLike();
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black relative overflow-hidden select-none">
      {/* Subtle Ambient Blurred Backdrop on Wide Desktop Screens (Just like TikTok Web!) */}
      {item.posterUrl && (
        <img
          src={item.posterUrl}
          alt=""
          className="hidden md:block absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-110 pointer-events-none"
        />
      )}

      {/* Centered 9:16 Immersive Reel Frame (100% height, edge-to-edge on mobile, crisp vertical theater on desktop) */}
      <div
        onClick={handleSingleTap}
        onDoubleClick={handleDoubleTap}
        className="relative h-full w-full md:w-auto md:aspect-[9/16] max-w-full bg-black md:rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
      >
        <video
          ref={videoRef}
          src={item.videoUrl || '/uploads/seed/reel1.mp4'}
          poster={item.posterUrl || undefined}
          loop
          muted={muted}
          playsInline
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) setProgress((el.currentTime / el.duration) * 100);
          }}
          className="w-full h-full object-cover"
        />

        {/* Smooth Bottom Gradient Overlay (Exact Loops style) */}
        <div
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 45%, transparent 100%)',
          }}
          className="absolute inset-x-0 bottom-0 h-[44%] pointer-events-none"
        />

        {/* Center Pause Indicator */}
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-10 h-10 text-white/90 fill-white/90 ms-1" />
            </div>
          </div>
        )}

        {/* Double-Click Heart Bursts */}
        {burstHearts.map(h => (
          <div
            key={h.id}
            style={{ left: h.x - 36, top: h.y - 36 }}
            className="absolute pointer-events-none animate-float-heart z-30"
          >
            <Heart className="w-20 h-20 text-[#FE2C55] fill-[#FE2C55] drop-shadow-2xl" />
          </div>
        ))}

        {/* Top-End Mute Pill */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          className="absolute top-16 end-3.5 z-20 w-9 h-9 rounded-full bg-black/45 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/65 cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* ============================================================
            TIKTOK / LOOPS FLOATING ACTION RAIL (Side Stack)
           ============================================================ */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute end-3 bottom-6 z-20 flex flex-col items-center gap-5"
        >
          {/* Creator Avatar + Red Follow Plus Badge */}
          <div className="relative mb-1">
            <div className="rounded-full p-0.5 bg-white shadow-lg">
              <UserAvatar
                initials={item.avatarInitials}
                color={item.avatarColor}
                avatarUrl={item.avatarUrl}
                size={46}
              />
            </div>
            <button
              onClick={() => setFollowed(f => !f)}
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer ${
                followed ? 'bg-emerald-500' : 'bg-[#FE2C55]'
              }`}
            >
              {followed ? <Check className="w-3 h-3 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 stroke-[3]" />}
            </button>
          </div>

          {/* Heart */}
          <button onClick={onLike} className="flex flex-col items-center gap-1 cursor-pointer group">
            <Heart
              className={`w-8 h-8 transition-transform group-active:scale-125 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${
                item.likedByMe ? 'text-[#FE2C55] fill-[#FE2C55]' : 'text-white fill-white/95'
              }`}
            />
            <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] font-mono-num">
              {formatCompact(item.likesCount)}
            </span>
          </button>

          {/* Comments */}
          <button onClick={onOpenComments} className="flex flex-col items-center gap-1 cursor-pointer group">
            <MessageCircle className="w-8 h-8 text-white fill-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] group-active:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] font-mono-num">
              {formatCompact(item.commentsCount)}
            </span>
          </button>

          {/* Bookmark */}
          <button onClick={onSave} className="flex flex-col items-center gap-1 cursor-pointer group">
            <Bookmark
              className={`w-8 h-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-transform group-active:scale-110 ${
                item.savedByMe ? 'text-[#FACE15] fill-[#FACE15]' : 'text-white fill-white/95'
              }`}
            />
            <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] font-mono-num">
              {formatCompact(item.savesCount)}
            </span>
          </button>

          {/* Share / Promote */}
          <button onClick={onShare} className="flex flex-col items-center gap-1 cursor-pointer group">
            <Share2 className="w-7 h-7 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
            <span className="text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] font-mono-num">
              {formatCompact(item.sharesCount || 420)}
            </span>
          </button>

          {/* Spinning Vinyl Record Disc */}
          <button
            onClick={onSummarize}
            title={isAr ? 'تلخيص الفيديو عبر LM AI' : 'AI Summary'}
            className={`w-11 h-11 rounded-full bg-gradient-to-tr from-zinc-900 via-zinc-700 to-zinc-900 p-2 border border-white/20 shadow-xl flex items-center justify-center cursor-pointer ${
              !paused && isActive ? 'animate-vinyl' : ''
            }`}
          >
            <UserAvatar initials={item.avatarInitials} color={item.avatarColor} avatarUrl={item.avatarUrl} size={24} />
          </button>
        </div>

        {/* ============================================================
            BOTTOM CAPTION, CREATOR HANDLE & AUDIO TRACK OVERLAY
           ============================================================ */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute start-4 end-18 bottom-5 z-20 text-white space-y-2"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span dir="ltr" className="text-base font-bold drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
              @{item.username}
            </span>
            {item.verified && <VerifiedIcon />}
            <VipBadge tier={item.vipTier} compact />
            {item.isSponsored && (
              <span className="px-2 py-0.5 rounded bg-white/20 backdrop-blur-md text-[10px] font-semibold">
                {isAr ? 'ممول' : 'Sponsored'}
              </span>
            )}
          </div>

          <p className="text-[13.5px] leading-snug text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] line-clamp-2">
            {item.title} — {item.description}
          </p>

          <div className="text-xs font-semibold text-white/90">{item.tags}</div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 text-xs text-white/85 truncate">
              <Music2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.audioTitle}</span>
            </div>
            <button
              onClick={onSummarize}
              className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" /> {isAr ? 'ملخص AI' : 'AI'}
            </button>
          </div>
        </div>

        {/* Bottom Scrubber Hairline (TikTok / Loops Progress Bar) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            const el = videoRef.current;
            if (!el || !el.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            el.currentTime = ratio * el.duration;
          }}
          className="absolute bottom-0 inset-x-0 h-1.5 bg-white/20 z-30 cursor-pointer group"
        >
          <div style={{ width: `${progress}%` }} className="h-full bg-[#FE2C55] transition-all duration-100" />
        </div>
      </div>
    </div>
  );
}

export function ShortVideosView() {
  const { user, lang, toast, sendToAi } = useApp();
  const isAr = lang === 'ar';

  const [videos, setVideos] = useState<ShortVideoItem[]>([]);
  const [feedTab, setFeedTab] = useState<'forYou' | 'following'>('forYou');
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true); // Browsers allow instant autoplay when muted initially; 1 tap unmutes!
  const swiperRef = useRef<SwiperType | null>(null);

  // TikTok Slide-over Comments Drawer
  const [commentsVideo, setCommentsVideo] = useState<ShortVideoItem | null>(null);
  const [comments, setComments] = useState<VideoCommentRow[]>([]);
  const [commentText, setCommentText] = useState('');

  // Upload Modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadVideos = useCallback(async () => {
    if (!user) return;
    const data = await api<{ videos: ShortVideoItem[] }>(`/api/videos?userId=${user.id}`);
    setVideos(data.videos);
  }, [user]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  if (!user) return null;

  const displayed = feedTab === 'forYou' ? videos : videos.filter((_, i) => i % 2 === 0);

  async function toggleLike(v: ShortVideoItem) {
    if (!user) return;
    setVideos(prev =>
      prev.map(x =>
        x.id === v.id
          ? { ...x, likedByMe: !x.likedByMe, likesCount: x.likedByMe ? x.likesCount - 1 : x.likesCount + 1 }
          : x
      )
    );
    await api(`/api/videos/${v.id}/like`, { method: 'POST', body: JSON.stringify({ userId: user.id }) });
  }

  async function toggleSave(v: ShortVideoItem) {
    if (!user) return;
    setVideos(prev =>
      prev.map(x =>
        x.id === v.id
          ? { ...x, savedByMe: !x.savedByMe, savesCount: x.savedByMe ? x.savesCount - 1 : x.savesCount + 1 }
          : x
      )
    );
    await api(`/api/videos/${v.id}/save`, { method: 'POST', body: JSON.stringify({ userId: user.id }) });
  }

  async function openComments(v: ShortVideoItem) {
    setCommentsVideo(v);
    const data = await api<{ comments: VideoCommentRow[] }>(`/api/videos/${v.id}/comments`);
    setComments(data.comments);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !commentsVideo || !commentText.trim()) return;
    await api(`/api/videos/${commentsVideo.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, content: commentText }),
    });
    setCommentText('');
    const data = await api<{ comments: VideoCommentRow[] }>(`/api/videos/${commentsVideo.id}/comments`);
    setComments(data.comments);
    setVideos(prev => prev.map(x => (x.id === commentsVideo.id ? { ...x, commentsCount: x.commentsCount + 1 } : x)));
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file);
      setUploadedUrl(up.url);
      toast(isAr ? 'تم تجهيز الفيديو للنشر' : 'Video uploaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function publishVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;
    await api('/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        title: newTitle,
        description: newDesc,
        videoUrl: uploadedUrl,
      }),
    });
    setUploadOpen(false);
    setNewTitle('');
    setNewDesc('');
    setUploadedUrl(null);
    await loadVideos();
    swiperRef.current?.slideTo(0);
    toast(isAr ? 'تم نشر الريل بنجاح' : 'Short published', 'success');
  }

  return (
    <div className="h-full w-full bg-black relative flex overflow-hidden">
      {/* MAIN TIKTOK / LOOPS FULL-SCREEN VERTICAL SWIPER */}
      <div className="flex-1 h-full relative">
        {/* FLOATING TRANSPARENT TOP BAR OVER VIDEO (Exact Loops style!) */}
        <div className="absolute top-4 inset-x-4 z-30 flex items-center justify-between pointer-events-none">
          <div className="w-24" />
          <div className="flex items-center gap-6 pointer-events-auto">
            <button
              onClick={() => { setFeedTab('following'); setActiveIndex(0); swiperRef.current?.slideTo(0); }}
              className={`pb-1.5 text-base font-bold transition-all cursor-pointer drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${
                feedTab === 'following'
                  ? 'text-white border-b-2 border-white'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              {isAr ? 'أتابعه' : 'Following'}
            </button>
            <button
              onClick={() => { setFeedTab('forYou'); setActiveIndex(0); swiperRef.current?.slideTo(0); }}
              className={`pb-1.5 text-base font-bold transition-all cursor-pointer drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${
                feedTab === 'forYou'
                  ? 'text-white border-b-2 border-white'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              {isAr ? 'لك' : 'For You'}
            </button>
          </div>

          <button
            onClick={() => setUploadOpen(true)}
            className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-[#FE2C55] hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isAr ? 'رفع' : 'Upload'}</span>
          </button>
        </div>

        {/* Desktop Floating Up/Down Navigation Chevrons (TikTok Web Right Edge) */}
        <div className="hidden lg:flex flex-col gap-3 absolute end-6 top-1/2 -translate-y-1/2 z-30">
          <button
            onClick={() => swiperRef.current?.slidePrev()}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white flex items-center justify-center cursor-pointer"
          >
            <ChevronUp className="w-6 h-6" />
          </button>
          <button
            onClick={() => swiperRef.current?.slideNext()}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white flex items-center justify-center cursor-pointer"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>

        {/* Hardware-Accelerated Vertical Swiper */}
        {displayed.length > 0 && (
          <Swiper
            direction="vertical"
            slidesPerView={1}
            mousewheel={{ forceToAxis: true, sensitivity: 1 }}
            keyboard={{ enabled: true }}
            modules={[Mousewheel, Keyboard]}
            onSwiper={(sw) => { swiperRef.current = sw; }}
            onSlideChange={(sw) => setActiveIndex(sw.activeIndex)}
            className="w-full h-full"
          >
            {displayed.map((v, idx) => (
              <SwiperSlide key={v.id} className="w-full h-full">
                <ReelSlide
                  item={v}
                  isActive={idx === activeIndex}
                  muted={muted}
                  onToggleMute={() => setMuted(m => !m)}
                  onLike={() => toggleLike(v)}
                  onSave={() => toggleSave(v)}
                  onOpenComments={() => openComments(v)}
                  onShare={() => {
                    api(`/api/videos/${v.id}/promote`, { method: 'POST', body: JSON.stringify({ budgetEgp: 1000 }) }).then(loadVideos);
                    toast(isAr ? 'تم نسخ الرابط / ترويج الفيديو' : 'Shared / Promoted', 'info');
                  }}
                  onSummarize={() =>
                    sendToAi({
                      title: `${v.title} (@${v.username})`,
                      content: `${v.title}\n${v.description}\n${v.tags}`,
                      source: 'video_summary',
                    })
                  }
                  isAr={isAr}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        )}
      </div>

      {/* TIKTOK COMMENTS SLIDE-OVER DRAWER */}
      {commentsVideo && (
        <aside className="fixed inset-x-0 bottom-0 h-[68vh] md:static md:h-full md:w-[380px] bg-[#18181B] text-white border-t md:border-t-0 md:border-s border-white/10 rounded-t-3xl md:rounded-none z-40 flex flex-col">
          <div className="h-13 px-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <span className="text-sm font-bold">
              {commentsVideo.commentsCount.toLocaleString('en-US')} {isAr ? 'تعليق' : 'Comments'}
            </span>
            <button onClick={() => setCommentsVideo(null)} className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3">
                <UserAvatar
                  initials={c.avatar_initials}
                  color={c.avatar_color}
                  avatarUrl={c.avatar_url}
                  size={34}
                  vipTier={c.vip_tier as 0 | 1 | 2 | 3 | 4 | 5}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white/80">{c.display_name}</span>
                    <VipBadge tier={c.vip_tier as 0 | 1 | 2 | 3 | 4 | 5} compact />
                  </div>
                  <p className="text-xs text-white mt-0.5 leading-relaxed">{c.content}</p>
                </div>
                <div className="flex flex-col items-center text-white/45 text-[10px]">
                  <Heart className="w-3.5 h-3.5" />
                  <span>{c.likes_count}</span>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={submitComment} className="p-3 border-t border-white/10 flex items-center gap-2 shrink-0">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={isAr ? 'أضف تعليقًا...' : 'Add comment...'}
              className="flex-1 rounded-full bg-white/10 px-4 py-2 text-xs text-white placeholder:text-white/45 outline-none"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="w-9 h-9 rounded-full bg-[#FE2C55] text-white flex items-center justify-center cursor-pointer disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </aside>
      )}

      {/* UPLOAD SHORT MODAL */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setUploadOpen(false)}>
          <form onSubmit={publishVideo} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-[#18181B] text-white border border-white/12 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{isAr ? 'نشر فيديو قصير جديد' : 'Upload Short'}</h3>
              <button type="button" onClick={() => setUploadOpen(false)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={isAr ? 'عنوان جذاب للفيديو...' : 'Catchy title...'}
              className="w-full rounded-xl bg-white/10 px-3.5 py-2.5 text-xs outline-none"
              required
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              placeholder={isAr ? 'الوصف والهاشتاجات...' : 'Caption & #hashtags...'}
              className="w-full rounded-xl bg-white/10 px-3.5 py-2.5 text-xs outline-none resize-none"
            />
            <label className="block p-4 rounded-2xl border border-dashed border-white/25 text-center text-xs cursor-pointer hover:bg-white/5">
              <input type="file" accept="video/mp4,video/webm" onChange={handleUploadFile} className="hidden" />
              {uploading
                ? (isAr ? 'جاري رفع ملف الفيديو...' : 'Uploading...')
                : uploadedUrl
                ? (isAr ? '✓ تم اختيار الفيديو بنجاح' : '✓ Video attached')
                : (isAr ? 'اضغط لاختيار ملف فيديو MP4 / WebM من جهازك' : 'Choose MP4 / WebM file')}
            </label>
            <button type="submit" disabled={uploading} className="w-full py-2.5 rounded-full bg-[#FE2C55] text-white text-xs font-bold cursor-pointer">
              {isAr ? 'نشر الآن' : 'Post Now'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
