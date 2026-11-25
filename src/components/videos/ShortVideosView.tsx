import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Mic,
  CornerDownLeft,
  FastForward,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, uploadFile } from '../../lib/api';
import { ShortVideoItem, VideoCommentItem } from '../../types';
import { UserAvatar, VerifiedIcon, VipBadge } from '../shared/LmBrandMark';
import { LiveVoiceRecorder, SmartVoicePill } from '../shared/VoiceStudio2026';

const REEL_REACTIONS = ['❤️', '🔥', '😂', '🤯', '👏'];
const COMMENT_QUICK_EMOJIS = ['🔥', '😍', '😂', '👏', '💯', '❤️'];

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

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
  const [fast2x, setFast2x] = useState(false);
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number; emoji: string }>>([]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.currentTime = 0;
      el.playbackRate = 1;
      setFast2x(false);
      el.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      el.pause();
      setPaused(false);
    }
  }, [isActive]);

  function togglePlay() {
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

  function spawnBurst(x: number, y: number, emoji = '❤️') {
    const id = Date.now() + Math.random();
    setBursts(prev => [...prev, { id, x, y, emoji }]);
    setTimeout(() => setBursts(prev => prev.filter(h => h.id !== id)), 1200);
  }

  function handleDoubleTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    spawnBurst(e.clientX - rect.left, e.clientY - rect.top, selectedEmoji || '❤️');
    if (!item.likedByMe) onLike();
  }

  function toggleSpeed2x(e: React.MouseEvent) {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    const next = !fast2x;
    el.playbackRate = next ? 2.0 : 1.0;
    setFast2x(next);
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black relative overflow-hidden select-none">
      {item.posterUrl && (
        <img
          src={item.posterUrl}
          alt=""
          className="hidden md:block absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-110 pointer-events-none"
        />
      )}

      <div
        onClick={togglePlay}
        onDoubleClick={handleDoubleTap}
        className="relative h-full w-full md:w-auto md:aspect-[9/16] max-w-full bg-black overflow-hidden shadow-2xl cursor-pointer"
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

        <div
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.38) 42%, transparent 100%)',
          }}
          className="absolute inset-x-0 bottom-0 h-[48%] pointer-events-none"
        />

        {paused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 flex items-center justify-center">
              <Play className="w-9 h-9 text-white fill-white ms-1" />
            </div>
          </div>
        )}

        {fast2x && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 text-xs font-mono-num font-bold text-white flex items-center gap-1.5 z-20">
            <FastForward className="w-3.5 h-3.5 text-[#38BDF8]" /> 2.0x
          </div>
        )}

        {/* Double-Tap Emoji Bursts */}
        {bursts.map(b => (
          <div
            key={b.id}
            style={{ left: b.x - 32, top: b.y - 32 }}
            className="absolute pointer-events-none animate-float-heart z-30 text-6xl drop-shadow-2xl"
          >
            {b.emoji}
          </div>
        ))}

        {/* Top-End Controls: Sound + 2x Speed */}
        <div className="absolute top-16 end-3.5 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center hover:bg-black/60 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={toggleSpeed2x}
            className={`w-10 h-10 rounded-full backdrop-blur-xl border text-[11px] font-mono-num font-bold flex items-center justify-center cursor-pointer ${
              fast2x ? 'bg-[#38BDF8] text-black border-white' : 'bg-black/40 text-white border-white/15'
            }`}
          >
            {fast2x ? '2x' : '1x'}
          </button>
        </div>

        {/* ============================================================
            2026 TIKTOK FLOATING GLASS ACTION STACK (Safe above Bottom Dock!)
           ============================================================ */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute end-3 bottom-24 z-20 flex flex-col items-center gap-4"
        >
          {/* Creator Avatar + Follow */}
          <div className="relative mb-1">
            <div className="rounded-full p-0.5 bg-gradient-to-tr from-[#FF2D55] to-[#FF9500] shadow-xl">
              <UserAvatar initials={item.avatarInitials} color={item.avatarColor} avatarUrl={item.avatarUrl} size={46} />
            </div>
            <button
              onClick={() => setFollowed(f => !f)}
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer ${
                followed ? 'bg-emerald-500' : 'bg-[#FF2D55]'
              }`}
            >
              {followed ? <Check className="w-3 h-3 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 stroke-[3]" />}
            </button>
          </div>

          {/* Heart + Radial Multi-Reaction Popover on Hover */}
          <div
            onMouseEnter={() => setReactionTrayOpen(true)}
            onMouseLeave={() => setReactionTrayOpen(false)}
            className="relative flex flex-col items-center"
          >
            <AnimatePresence>
              {reactionTrayOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 10 }}
                  className="absolute end-12 top-0 px-2.5 py-1.5 rounded-full bg-black/75 backdrop-blur-2xl border border-white/20 flex items-center gap-2 shadow-2xl"
                >
                  {REEL_REACTIONS.map((emo) => (
                    <button
                      key={emo}
                      onClick={() => {
                        setSelectedEmoji(emo);
                        setReactionTrayOpen(false);
                        spawnBurst(150, 260, emo);
                        if (!item.likedByMe) onLike();
                      }}
                      className="text-xl hover:scale-135 transition-transform cursor-pointer"
                    >
                      {emo}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 1.35 }}
              onClick={onLike}
              className="flex flex-col items-center gap-1 cursor-pointer"
            >
              {selectedEmoji && item.likedByMe ? (
                <span className="text-3xl leading-none drop-shadow-lg">{selectedEmoji}</span>
              ) : (
                <Heart
                  className={`w-8 h-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] ${
                    item.likedByMe ? 'text-[#FF2D55] fill-[#FF2D55]' : 'text-white fill-white/90'
                  }`}
                />
              )}
              <span className="text-xs font-bold text-white font-mono-num drop-shadow">
                {formatCompact(item.likesCount)}
              </span>
            </motion.button>
          </div>

          {/* Threaded & Voice Comments Trigger */}
          <motion.button
            whileTap={{ scale: 1.2 }}
            onClick={onOpenComments}
            className="flex flex-col items-center gap-1 cursor-pointer"
          >
            <MessageCircle className="w-8 h-8 text-white fill-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]" />
            <span className="text-xs font-bold text-white font-mono-num drop-shadow">
              {formatCompact(item.commentsCount)}
            </span>
          </motion.button>

          {/* Save */}
          <motion.button
            whileTap={{ scale: 1.2 }}
            onClick={onSave}
            className="flex flex-col items-center gap-1 cursor-pointer"
          >
            <Bookmark
              className={`w-8 h-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] ${
                item.savedByMe ? 'text-[#F5C451] fill-[#F5C451]' : 'text-white fill-white/90'
              }`}
            />
            <span className="text-xs font-bold text-white font-mono-num drop-shadow">
              {formatCompact(item.savesCount)}
            </span>
          </motion.button>

          {/* Share */}
          <motion.button whileTap={{ scale: 1.15 }} onClick={onShare} className="flex flex-col items-center gap-1 cursor-pointer">
            <Share2 className="w-7 h-7 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]" />
            <span className="text-xs font-bold text-white font-mono-num drop-shadow">
              {formatCompact(item.sharesCount || 840)}
            </span>
          </motion.button>

          {/* Spinning Audio Disc */}
          <button
            onClick={onSummarize}
            className={`w-11 h-11 rounded-full bg-gradient-to-tr from-zinc-900 via-zinc-700 to-zinc-900 p-2 border border-white/25 shadow-xl flex items-center justify-center cursor-pointer ${
              !paused && isActive ? 'animate-vinyl' : ''
            }`}
          >
            <UserAvatar initials={item.avatarInitials} color={item.avatarColor} avatarUrl={item.avatarUrl} size={24} />
          </button>
        </div>

        {/* ============================================================
            BOTTOM CREATOR & AUDIO OVERLAY (Cleanly above Floating Dock!)
           ============================================================ */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute start-4 end-18 bottom-24 z-20 text-white space-y-1.5"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span dir="ltr" className="text-[16px] font-extrabold drop-shadow">@{item.username}</span>
            {item.verified && <VerifiedIcon />}
            <VipBadge tier={item.vipTier} compact />
            {item.isSponsored && (
              <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-semibold">
                {isAr ? 'ممول' : 'Sponsored'}
              </span>
            )}
          </div>

          <p className="text-[13.5px] leading-snug text-white/95 drop-shadow line-clamp-2">
            {item.title} {item.description}
          </p>

          <div className="text-xs font-semibold text-white/85">{item.tags}</div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 text-xs text-white/80 truncate">
              <Music2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.audioTitle}</span>
            </div>
            <button
              onClick={onSummarize}
              className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/15 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-[#38BDF8]" /> AI
            </button>
          </div>
        </div>

        {/* Scrubber Progress Line */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            const el = videoRef.current;
            if (!el || !el.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            el.currentTime = ratio * el.duration;
          }}
          className="absolute bottom-[76px] inset-x-3 h-1 rounded-full bg-white/20 z-30 cursor-pointer overflow-hidden"
        >
          <div style={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-[#FF2D55] to-[#FF9500]" />
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
  const [muted, setMuted] = useState(true);
  const swiperRef = useRef<SwiperType | null>(null);

  // TikTok 2026 Threaded + Voice Comments Drawer
  const [commentsVideo, setCommentsVideo] = useState<ShortVideoItem | null>(null);
  const [comments, setComments] = useState<VideoCommentItem[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<VideoCommentItem | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({ vc_1: true });

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

  const loadComments = useCallback(async (videoId: string) => {
    if (!user) return;
    const data = await api<{ comments: VideoCommentItem[] }>(`/api/videos/${videoId}/comments?userId=${user.id}`);
    setComments(data.comments);
  }, [user]);

  if (!user) return null;

  const displayed = feedTab === 'forYou' ? videos : videos.filter((_, i) => i % 2 === 0);
  const topLevelComments = comments.filter(c => !c.parentId);
  const repliesByParent = (parentId: string) => comments.filter(c => c.parentId === parentId);

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
    setReplyingTo(null);
    setVoiceMode(false);
    await loadComments(v.id);
  }

  async function submitTextComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !commentsVideo || !commentText.trim()) return;
    await api(`/api/videos/${commentsVideo.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        content: commentText,
        parentId: replyingTo?.id || null,
      }),
    });
    if (replyingTo) setExpandedThreads(prev => ({ ...prev, [replyingTo.id]: true }));
    setCommentText('');
    setReplyingTo(null);
    await loadComments(commentsVideo.id);
    setVideos(prev => prev.map(x => (x.id === commentsVideo.id ? { ...x, commentsCount: x.commentsCount + 1 } : x)));
  }

  async function submitVoiceComment(audioFile: File, durationSec: number) {
    if (!user || !commentsVideo) return;
    try {
      const up = await uploadFile(audioFile);
      await api(`/api/videos/${commentsVideo.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          parentId: replyingTo?.id || null,
          audioUrl: up.url,
          audioDurationSec: durationSec,
          transcript: replyingTo
            ? `رد صوتي على @${replyingTo.username}`
            : 'تعليق صوتي تفاعلي',
        }),
      });
      if (replyingTo) setExpandedThreads(prev => ({ ...prev, [replyingTo.id]: true }));
      setVoiceMode(false);
      setReplyingTo(null);
      await loadComments(commentsVideo.id);
      setVideos(prev => prev.map(x => (x.id === commentsVideo.id ? { ...x, commentsCount: x.commentsCount + 1 } : x)));
      toast(isAr ? 'تم نشر الرد الصوتي 🎙️' : 'Voice reply posted 🎙️', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error');
    }
  }

  async function toggleCommentLike(commentId: string) {
    if (!user || !commentsVideo) return;
    await api(`/api/video-comments/${commentId}/like`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id }),
    });
    await loadComments(commentsVideo.id);
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file);
      setUploadedUrl(up.url);
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
      body: JSON.stringify({ userId: user.id, title: newTitle, description: newDesc, videoUrl: uploadedUrl }),
    });
    setUploadOpen(false);
    setNewTitle('');
    setNewDesc('');
    setUploadedUrl(null);
    await loadVideos();
    swiperRef.current?.slideTo(0);
    toast(isAr ? 'تم نشر الريل ✨' : 'Reel posted ✨', 'success');
  }

  return (
    <div className="h-full w-full bg-black relative flex overflow-hidden">
      <div className="flex-1 h-full relative">
        {/* FLOATING GLASS TOP CAPSULE */}
        <div className="absolute top-4 inset-x-4 z-30 flex items-center justify-between pointer-events-none">
          <div className="w-20" />
          <div className="pointer-events-auto px-2 py-1 rounded-full bg-black/35 backdrop-blur-xl border border-white/15 flex items-center gap-1">
            <button
              onClick={() => { setFeedTab('following'); setActiveIndex(0); swiperRef.current?.slideTo(0); }}
              className={`px-4 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                feedTab === 'following' ? 'bg-white text-black' : 'text-white/75 hover:text-white'
              }`}
            >
              {isAr ? 'أتابعه' : 'Following'}
            </button>
            <button
              onClick={() => { setFeedTab('forYou'); setActiveIndex(0); swiperRef.current?.slideTo(0); }}
              className={`px-4 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                feedTab === 'forYou' ? 'bg-white text-black' : 'text-white/75 hover:text-white'
              }`}
            >
              {isAr ? 'لك' : 'For You'}
            </button>
          </div>

          <button
            onClick={() => setUploadOpen(true)}
            className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FF2D55] to-[#FF6B8B] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isAr ? 'نشر' : 'Post'}</span>
          </button>
        </div>

        {/* Desktop Floating Navigation */}
        <div className="hidden lg:flex flex-col gap-2.5 absolute end-6 top-1/2 -translate-y-1/2 z-30">
          <button
            onClick={() => swiperRef.current?.slidePrev()}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center cursor-pointer"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            onClick={() => swiperRef.current?.slideNext()}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center cursor-pointer"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

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
                  onShare={() => toast(isAr ? 'تم نسخ الرابط ✨' : 'Link copied ✨', 'info')}
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

      {/* ============================================================
          2026 TIKTOK THREADED & VOICE COMMENTS DRAWER
         ============================================================ */}
      <AnimatePresence>
        {commentsVideo && (
          <motion.aside
            initial={{ x: isAr ? -400 : 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isAr ? -400 : 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="fixed inset-x-0 bottom-0 h-[74vh] md:static md:h-full md:w-[400px] bg-[#10121A]/95 backdrop-blur-2xl text-white border-t md:border-t-0 md:border-s border-white/12 rounded-t-3xl md:rounded-none z-50 flex flex-col pb-20 md:pb-22"
          >
            {/* Header */}
            <div className="h-13 px-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <span className="text-sm font-bold">
                {commentsVideo.commentsCount.toLocaleString('en-US')} {isAr ? 'تعليق ورد صوتي' : 'Comments'}
              </span>
              <button onClick={() => setCommentsVideo(null)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Threaded Comments & Voice Replies List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {topLevelComments.map((c) => {
                const replies = repliesByParent(c.id);
                const expanded = Boolean(expandedThreads[c.id]);
                return (
                  <div key={c.id} className="space-y-2.5">
                    {/* Parent Comment */}
                    <div className="flex items-start gap-3">
                      <UserAvatar initials={c.avatarInitials} color={c.avatarColor} avatarUrl={c.avatarUrl} size={34} vipTier={c.vipTier} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white/85">{c.displayName}</span>
                          <VipBadge tier={c.vipTier} compact />
                          <span className="text-[10px] text-white/40">{c.createdAt}</span>
                        </div>

                        {c.audioUrl ? (
                          <div className="p-2.5 rounded-2xl bg-white/[0.07] border border-white/10 inline-block max-w-full">
                            <SmartVoicePill url={c.audioUrl} transcript={c.transcript} compact />
                          </div>
                        ) : (
                          <p className="text-[13px] text-white/95 leading-relaxed">{c.content}</p>
                        )}

                        {/* Reply & Voice Reply Action Row */}
                        <div className="flex items-center gap-4 pt-0.5 text-[11px] text-white/50 font-semibold">
                          <button
                            onClick={() => { setReplyingTo(c); setVoiceMode(false); }}
                            className="hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <CornerDownLeft className="w-3 h-3" />
                            {isAr ? 'رد' : 'Reply'}
                          </button>
                          <button
                            onClick={() => { setReplyingTo(c); setVoiceMode(true); }}
                            className="hover:text-[#38BDF8] flex items-center gap-1 cursor-pointer"
                          >
                            <Mic className="w-3 h-3 text-[#38BDF8]" />
                            {isAr ? 'رد بصوت' : 'Voice Reply'}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleCommentLike(c.id)}
                        className="flex flex-col items-center gap-0.5 text-white/55 hover:text-[#FF2D55] cursor-pointer"
                      >
                        <Heart className={`w-4 h-4 ${c.likedByMe ? 'text-[#FF2D55] fill-[#FF2D55]' : ''}`} />
                        <span className="text-[10px] font-mono-num">{c.likesCount}</span>
                      </button>
                    </div>

                    {/* Nested Replies */}
                    {replies.length > 0 && (
                      <div className="ps-11 space-y-2.5">
                        {!expanded ? (
                          <button
                            onClick={() => setExpandedThreads(p => ({ ...p, [c.id]: true }))}
                            className="text-[11px] font-semibold text-[#38BDF8] cursor-pointer"
                          >
                            {isAr ? `عرض ${replies.length} ردود ▾` : `View ${replies.length} replies ▾`}
                          </button>
                        ) : (
                          <>
                            {replies.map((r) => (
                              <div key={r.id} className="flex items-start gap-2.5">
                                <UserAvatar initials={r.avatarInitials} color={r.avatarColor} avatarUrl={r.avatarUrl} size={26} vipTier={r.vipTier} />
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11.5px] font-bold text-white/85">{r.displayName}</span>
                                    <span className="text-[10px] text-white/40">{r.createdAt}</span>
                                  </div>
                                  {r.audioUrl ? (
                                    <div className="p-2 rounded-2xl bg-[#7C5CFF]/18 border border-[#7C5CFF]/35 inline-block max-w-full">
                                      <SmartVoicePill url={r.audioUrl} transcript={r.transcript} compact />
                                    </div>
                                  ) : (
                                    <p className="text-xs text-white/90 leading-relaxed">{r.content}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => toggleCommentLike(r.id)}
                                  className="flex flex-col items-center text-white/50 cursor-pointer"
                                >
                                  <Heart className={`w-3.5 h-3.5 ${r.likedByMe ? 'text-[#FF2D55] fill-[#FF2D55]' : ''}`} />
                                  <span className="text-[9px] font-mono-num">{r.likesCount}</span>
                                </button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Quick Emojis + Text / Live Voice Reply Composer */}
            <div className="p-3 border-t border-white/10 space-y-2 shrink-0 bg-[#0D0F17]">
              {replyingTo && (
                <div className="px-3 py-1.5 rounded-xl bg-white/[0.07] flex items-center justify-between text-xs">
                  <span className="text-white/80">
                    {isAr ? `الرد على @${replyingTo.username}` : `Replying to @${replyingTo.username}`}
                  </span>
                  <button onClick={() => setReplyingTo(null)} className="text-white/50 hover:text-white cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Quick Emoji Bar */}
              {!voiceMode && (
                <div className="flex items-center justify-around py-0.5">
                  {COMMENT_QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setCommentText(prev => prev + em)}
                      className="text-lg hover:scale-125 transition-transform cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {voiceMode ? (
                <LiveVoiceRecorder
                  placeholderLabel={replyingTo ? `رد صوتي على @${replyingTo.username}...` : 'تعليق صوتي...'}
                  onCancel={() => setVoiceMode(false)}
                  onSend={submitVoiceComment}
                />
              ) : (
                <form onSubmit={submitTextComment} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceMode(true)}
                    title={isAr ? 'تسجيل تعليق أو رد صوتي' : 'Record Voice Comment'}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#7C5CFF] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={replyingTo ? (isAr ? `اكتب ردًا لـ ${replyingTo.displayName}...` : 'Write a reply...') : (isAr ? 'أضف تعليقًا أو سجل بصوتك...' : 'Add comment...')}
                    className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-xs text-white placeholder:text-white/45 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim()}
                    className="w-10 h-10 rounded-full bg-[#FF2D55] text-white flex items-center justify-center cursor-pointer disabled:opacity-35 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* UPLOAD MODAL */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setUploadOpen(false)}>
          <form onSubmit={publishVideo} onClick={(e) => e.stopPropagation()} className="w-full max-w-md liquid-glass rounded-3xl p-6 space-y-4 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{isAr ? 'نشر ريلز جديد' : 'New Reel'}</h3>
              <button type="button" onClick={() => setUploadOpen(false)} className="cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={isAr ? 'العنوان...' : 'Title...'}
              className="w-full rounded-2xl bg-white/10 px-4 py-3 text-xs outline-none"
              required
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              placeholder={isAr ? 'الوصف والهاشتاجات...' : 'Caption & #tags...'}
              className="w-full rounded-2xl bg-white/10 px-4 py-3 text-xs outline-none resize-none"
            />
            <label className="block p-5 rounded-2xl border border-dashed border-white/25 text-center text-xs cursor-pointer hover:bg-white/5">
              <input type="file" accept="video/mp4,video/webm" onChange={handleUploadFile} className="hidden" />
              {uploading ? '...' : uploadedUrl ? '✓ جاهز للنشر' : (isAr ? 'اختر فيديو MP4 / WebM' : 'Select MP4 / WebM')}
            </label>
            <button type="submit" disabled={uploading} className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF2D55] to-[#FF6B8B] text-white text-xs font-bold cursor-pointer">
              {isAr ? 'نشر الآن' : 'Publish'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
