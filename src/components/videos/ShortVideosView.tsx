import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Heart,
  Bookmark,
  Share2,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  Upload,
  Megaphone,
  Cpu,
  Eye,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, uploadFile } from '../../lib/api';
import { ShortVideoItem } from '../../types';
import { RankBadge, UserAvatar, VerifiedIcon, VipBadge } from '../shared/LmBrandMark';

/** Smooth 60fps procedural cinema canvas for seeded short videos (zero broken external video URLs!) */
function ProceduralReelCanvas({ preset, playing }: { preset: string; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let t = 0;

    const palettes: Record<string, { bg1: string; bg2: string; accent: string; accent2: string }> = {
      'cairo-skyline': { bg1: '#0A0F1D', bg2: '#182442', accent: '#2F6BFF', accent2: '#D4AF37' },
      'broadcast-pulse': { bg1: '#071713', bg2: '#0F2E26', accent: '#10B981', accent2: '#34D399' },
      'market-wave': { bg1: '#14110A', bg2: '#262010', accent: '#D4AF37', accent2: '#F59E0B' },
      'nile-gold': { bg1: '#100E16', bg2: '#1E1A2B', accent: '#E2C16B', accent2: '#60A5FA' },
    };
    const p = palettes[preset] || palettes['cairo-skyline'];

    const render = () => {
      if (playing) t += 0.014;
      const w = canvas.width;
      const h = canvas.height;

      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, p.bg1);
      grad.addColorStop(1, p.bg2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle architectural grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Soft ambient kinetic light spheres
      const x1 = w * (0.5 + 0.28 * Math.sin(t * 0.9));
      const y1 = h * (0.35 + 0.14 * Math.cos(t * 0.7));
      const g1 = ctx.createRadialGradient(x1, y1, 10, x1, y1, 210);
      g1.addColorStop(0, `${p.accent}55`);
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const x2 = w * (0.45 + 0.3 * Math.cos(t * 0.6));
      const y2 = h * (0.65 + 0.12 * Math.sin(t * 0.8));
      const g2 = ctx.createRadialGradient(x2, y2, 10, x2, y2, 180);
      g2.addColorStop(0, `${p.accent2}38`);
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Smooth audio/data waveform bars in center
      ctx.save();
      const bars = 28;
      const barW = 5;
      const gap = 6;
      const totalW = bars * (barW + gap);
      const startX = (w - totalW) / 2;
      const midY = h * 0.44;
      for (let i = 0; i < bars; i++) {
        const amp = 18 + Math.abs(Math.sin(t * 2.4 + i * 0.38)) * 58 + Math.cos(t * 1.3 - i * 0.2) * 14;
        ctx.fillStyle = i % 3 === 0 ? `${p.accent2}CC` : `${p.accent}AA`;
        ctx.beginPath();
        ctx.roundRect(startX + i * (barW + gap), midY - amp / 2, barW, Math.max(8, amp), 3);
        ctx.fill();
      }
      ctx.restore();

      rafId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(rafId);
  }, [preset, playing]);

  return <canvas ref={canvasRef} width={360} height={640} className="w-full h-full object-cover block" />;
}

export function ShortVideosView() {
  const { user, lang, toast, sendToAi, setActiveTab } = useApp();
  const isAr = lang === 'ar';

  const [videos, setVideos] = useState<ShortVideoItem[]>([]);
  const [feedMode, setFeedMode] = useState<'for_you' | 'following'>('for_you');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTags, setNewTags] = useState('#LM #مصر');
  const [newPreset, setNewPreset] = useState('cairo-skyline');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [newSponsored, setNewSponsored] = useState(false);

  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const loadVideos = useCallback(async () => {
    if (!user) return;
    const data = await api<{ videos: ShortVideoItem[] }>(`/api/videos?userId=${user.id}`);
    setVideos(data.videos);
  }, [user]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const activeList = feedMode === 'for_you' ? videos : videos.filter((_, idx) => idx % 2 === 0);
  const current = activeList[index] || activeList[0] || null;

  const goNext = useCallback(() => {
    if (activeList.length === 0) return;
    setIndex(i => (i + 1) % activeList.length);
    setPlaying(true);
  }, [activeList.length]);

  const goPrev = useCallback(() => {
    if (activeList.length === 0) return;
    setIndex(i => (i - 1 + activeList.length) % activeList.length);
    setPlaying(true);
  }, [activeList.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (uploadOpen) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, uploadOpen]);

  if (!user) return null;

  async function toggleLike(v: ShortVideoItem) {
    if (!user) return;
    setVideos(prev =>
      prev.map(item =>
        item.id === v.id
          ? { ...item, likedByMe: !item.likedByMe, likesCount: item.likedByMe ? item.likesCount - 1 : item.likesCount + 1 }
          : item
      )
    );
    await api(`/api/videos/${v.id}/like`, { method: 'POST', body: JSON.stringify({ userId: user.id }) });
  }

  async function toggleSave(v: ShortVideoItem) {
    if (!user) return;
    setVideos(prev =>
      prev.map(item =>
        item.id === v.id
          ? { ...item, savedByMe: !item.savedByMe, savesCount: item.savedByMe ? item.savesCount - 1 : item.savesCount + 1 }
          : item
      )
    );
    await api(`/api/videos/${v.id}/save`, { method: 'POST', body: JSON.stringify({ userId: user.id }) });
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const up = await uploadFile(file);
      setUploadedVideoUrl(up.url);
      toast(isAr ? 'تم رفع ملف الفيديو محليًا بنجاح' : 'Video uploaded locally', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingFile(false);
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
        tags: newTags,
        videoUrl: uploadedVideoUrl,
        scenePreset: newPreset,
        isSponsored: newSponsored,
        sponsorBudgetEgp: newSponsored ? 800 : 0,
      }),
    });
    setUploadOpen(false);
    setNewTitle('');
    setNewDesc('');
    setUploadedVideoUrl(null);
    setNewSponsored(false);
    await loadVideos();
    setIndex(0);
    toast(isAr ? 'تم نشر الفيديو القصير بنجاح' : 'Short video published', 'success');
  }

  async function promoteVideo(v: ShortVideoItem) {
    await api(`/api/videos/${v.id}/promote`, { method: 'POST', body: JSON.stringify({ budgetEgp: 1000 }) });
    await loadVideos();
    toast(isAr ? 'تم إطلاق حملة ترويج مدفوعة للفيديو (واضحة كمحتوى ممول)' : 'Video promotion launched', 'success');
  }

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-4 flex flex-col">
      {/* Top Control Strip */}
      <div className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
        <div className="inline-flex p-1 rounded-xl bg-[var(--lm-surface)] border border-[var(--lm-border)]">
          <button
            onClick={() => { setFeedMode('for_you'); setIndex(0); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              feedMode === 'for_you' ? 'bg-[var(--lm-accent)] text-[var(--lm-accent-text)]' : 'text-[var(--lm-text-secondary)]'
            }`}
          >
            {isAr ? 'مخصص لك (For You)' : 'For You'}
          </button>
          <button
            onClick={() => { setFeedMode('following'); setIndex(0); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              feedMode === 'following' ? 'bg-[var(--lm-accent)] text-[var(--lm-accent-text)]' : 'text-[var(--lm-text-secondary)]'
            }`}
          >
            {isAr ? 'المتابَعون' : 'Following'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!user.adRemoval.videos && (
            <button
              onClick={() => setActiveTab('vip')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] bg-[var(--lm-surface)] border border-[var(--lm-border)] text-[var(--lm-text-secondary)] hover:border-[var(--lm-border-strong)] cursor-pointer"
            >
              {isAr ? 'إزالة إعلانات الفيديوهات (100 ج.م)' : 'Remove Video Ads (100 EGP)'}
            </button>
          )}
          <button
            onClick={() => setUploadOpen(true)}
            className="lm-btn-primary px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {isAr ? 'رفع فيديو قصير' : 'Upload Short'}
          </button>
        </div>
      </div>

      {/* Main Theater Split (No Overlapping Elements!) */}
      {current && (
        <div className="max-w-5xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center min-h-0">
          {/* Vertical 9:16 Stage */}
          <div className="lg:col-span-6 flex items-center justify-center gap-4">
            {/* Prev/Next Vertical Controls */}
            <div className="flex flex-col gap-2">
              <button
                onClick={goPrev}
                title={isAr ? 'الفيديو السابق' : 'Previous'}
                className="w-10 h-10 rounded-full lm-card hover:bg-[var(--lm-surface-hover)] flex items-center justify-center cursor-pointer"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <div className="text-center text-[11px] font-mono-num text-[var(--lm-text-muted)]">
                {index + 1}/{activeList.length}
              </div>
              <button
                onClick={goNext}
                title={isAr ? 'الفيديو التالي' : 'Next'}
                className="w-10 h-10 rounded-full lm-card hover:bg-[var(--lm-surface-hover)] flex items-center justify-center cursor-pointer"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Clean Phone-Ratio Frame */}
            <div className="relative w-[300px] sm:w-[330px] aspect-[9/16] max-h-[72vh] rounded-3xl overflow-hidden border border-[var(--lm-border-strong)] bg-black shadow-2xl shrink-0">
              {current.videoUrl ? (
                <video
                  ref={videoElRef}
                  src={current.videoUrl}
                  autoPlay
                  loop
                  muted={muted}
                  playsInline
                  onClick={() => {
                    const el = videoElRef.current;
                    if (!el) return;
                    if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); }
                  }}
                  className="w-full h-full object-cover cursor-pointer"
                />
              ) : (
                <div onClick={() => setPlaying(p => !p)} className="w-full h-full cursor-pointer">
                  <ProceduralReelCanvas preset={current.scenePreset} playing={playing} />
                </div>
              )}

              {/* Top clean overlay badges */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <span className="px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-[10px] font-mono-num text-white flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {current.viewsCount.toLocaleString('en-US')}
                </span>
                {current.isSponsored && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/85 text-black text-[10px] font-bold flex items-center gap-1">
                    <Megaphone className="w-3 h-3" /> {isAr ? 'محتوى ممول' : 'Sponsored'}
                  </span>
                )}
              </div>

              {/* Bottom Minimal Playback Controls */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    if (videoElRef.current) {
                      if (playing) videoElRef.current.pause(); else videoElRef.current.play();
                    }
                    setPlaying(p => !p);
                  }}
                  className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center cursor-pointer"
                >
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <div className="flex-1 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md text-[11px] text-white/90 truncate">
                  {current.title}
                </div>
                {current.videoUrl && (
                  <button
                    onClick={() => setMuted(m => !m)}
                    className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center cursor-pointer"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dedicated Metadata & Interaction Panel (Clean, spacious, zero crowding!) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="lm-card rounded-2xl p-5 space-y-4">
              {/* Creator Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar initials={current.avatarInitials} color={current.avatarColor} size={42} vipTier={current.vipTier} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold truncate">{current.displayName}</span>
                      {current.verified && <VerifiedIcon />}
                      <VipBadge tier={current.vipTier} compact />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span dir="ltr" className="text-xs text-[var(--lm-text-muted)] font-mono-num inline-block">@{current.username}</span>
                      <RankBadge rankId={current.rankId} lang={lang} />
                    </div>
                  </div>
                </div>
                {user.prioritySupport && (
                  <span className="text-[10px] font-mono-num px-2 py-1 rounded-lg bg-[#D4AF37]/15 text-[#E8C85E] border border-[#D4AF37]/30 shrink-0">
                    {isAr ? 'أولوية معالجة HD' : 'Priority HD'}
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h2 className="text-base font-bold leading-snug">{current.title}</h2>
                <p className="text-xs text-[var(--lm-text-secondary)] leading-relaxed">{current.description}</p>
                <div className="text-xs text-[var(--lm-accent)] font-medium">{current.tags}</div>
              </div>

              {/* Engagement Bar */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--lm-border)]">
                <button
                  onClick={() => toggleLike(current)}
                  className={`py-2.5 rounded-xl border text-xs font-mono-num font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    current.likedByMe
                      ? 'bg-red-500/15 border-red-500/35 text-red-400'
                      : 'bg-[var(--lm-surface-2)] border-[var(--lm-border)] text-[var(--lm-text)] hover:bg-[var(--lm-surface-hover)]'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${current.likedByMe ? 'fill-current' : ''}`} />
                  {current.likesCount.toLocaleString('en-US')}
                </button>
                <button
                  onClick={() => toggleSave(current)}
                  className={`py-2.5 rounded-xl border text-xs font-mono-num font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    current.savedByMe
                      ? 'bg-[var(--lm-accent-soft)] border-[var(--lm-accent)]/40 text-[var(--lm-accent)]'
                      : 'bg-[var(--lm-surface-2)] border-[var(--lm-border)] text-[var(--lm-text)] hover:bg-[var(--lm-surface-hover)]'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${current.savedByMe ? 'fill-current' : ''}`} />
                  {current.savesCount.toLocaleString('en-US')}
                </button>
                <button
                  onClick={() => toast(isAr ? 'تم نسخ رابط الفيديو القصير' : 'Short link copied', 'info')}
                  className="py-2.5 rounded-xl border bg-[var(--lm-surface-2)] border-[var(--lm-border)] hover:bg-[var(--lm-surface-hover)] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  {isAr ? 'مشاركة' : 'Share'}
                </button>
              </div>

              {/* Action Buttons: AI Summary + Promote */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() =>
                    sendToAi({
                      title: `${isAr ? 'فيديو قصير' : 'Short Video'}: ${current.title}`,
                      content: `${current.title}\n${current.description}\n${current.tags}`,
                      source: 'video_summary',
                    })
                  }
                  className="lm-btn-ghost py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5 text-[var(--lm-accent)]" />
                  {isAr ? 'تلخيص عبر LM AI' : 'Summarize w/ AI'}
                </button>
                <button
                  onClick={() => promoteVideo(current)}
                  className="lm-btn-ghost py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                  {isAr ? 'ترويج الفيديو' : 'Promote Video'}
                </button>
              </div>
            </div>

            {/* Platform Ad Notice when not removed */}
            {!user.adRemoval.videos && (
              <div className="lm-card-subtle rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-semibold">{isAr ? 'مساحة إعلان قسم الفيديوهات' : 'Video Section Platform Ad'}</div>
                  <div className="text-[var(--lm-text-muted)] mt-0.5">
                    {isAr ? 'يمكنك إزالة إعلانات الفيديوهات مقابل 100 ج.م/شهريًا أو عبر VIP 5.' : 'Remove video ads for 100 EGP/mo or VIP 5.'}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('vip')}
                  className="lm-btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                >
                  {isAr ? 'إزالة' : 'Remove'}
                </button>
              </div>
            )}

            {/* Quick Playlist Thumbnails */}
            <div className="lm-card rounded-2xl p-4 space-y-2.5">
              <div className="text-xs font-semibold text-[var(--lm-text-secondary)]">
                {isAr ? 'قائمة الفيديوهات المقترحة (استخدم أسهم الكيبورد ↑ ↓)' : 'Up Next (Use ↑ ↓ keys)'}
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {activeList.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => { setIndex(i); setPlaying(true); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-start transition-colors cursor-pointer ${
                      i === index
                        ? 'bg-[var(--lm-accent-soft)] border border-[var(--lm-accent)]/35 font-semibold'
                        : 'bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] border border-transparent'
                    }`}
                  >
                    <span className="truncate">{v.title}</span>
                    <span className="text-[10px] font-mono-num text-[var(--lm-text-muted)] shrink-0">@{v.username}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD SHORT VIDEO MODAL */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setUploadOpen(false)}>
          <form
            onSubmit={publishVideo}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md lm-card rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{isAr ? 'رفع ونشر فيديو قصير جديد' : 'Upload New Short Video'}</h3>
              <button type="button" onClick={() => setUploadOpen(false)} className="text-[var(--lm-text-muted)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-[var(--lm-text-secondary)] mb-1">{isAr ? 'عنوان الفيديو' : 'Title'}</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={isAr ? 'مثال: جولة سريعة في القاهرة' : 'Video title'}
                className="lm-input w-full rounded-xl px-3 py-2 text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--lm-text-secondary)] mb-1">{isAr ? 'الوصف' : 'Description'}</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                className="lm-input w-full rounded-xl px-3 py-2 text-xs resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--lm-text-secondary)] mb-1">
                {isAr ? 'ملف فيديو محلي (MP4 / WebM — اختياري)' : 'Local Video File (MP4 / WebM — Optional)'}
              </label>
              <input type="file" accept="video/mp4,video/webm" onChange={handleVideoUpload} className="lm-input w-full rounded-xl px-3 py-2 text-xs" />
              {uploadingFile && <div className="text-[11px] text-[var(--lm-accent)] mt-1">{isAr ? 'جاري الرفع...' : 'Uploading...'}</div>}
              {!uploadedVideoUrl && (
                <div className="mt-2">
                  <label className="block text-[11px] text-[var(--lm-text-muted)] mb-1">
                    {isAr ? 'أو اختر مشهدًا مرئيًا جاهزًا للتجربة:' : 'Or choose a studio preset:'}
                  </label>
                  <select value={newPreset} onChange={(e) => setNewPreset(e.target.value)} className="lm-input w-full rounded-xl px-3 py-1.5 text-xs">
                    <option value="cairo-skyline">Cairo Skyline Pulse</option>
                    <option value="broadcast-pulse">Emerald Studio Wave</option>
                    <option value="market-wave">Royal Gold Markets</option>
                    <option value="nile-gold">Nile Night Cinema</option>
                  </select>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={newSponsored} onChange={(e) => setNewSponsored(e.target.checked)} />
              <span>{isAr ? 'نشر كفيديو ممول (حملة ترويج واضحة)' : 'Publish as Sponsored Video Campaign'}</span>
            </label>

            <button type="submit" disabled={uploadingFile} className="lm-btn-primary w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer">
              {isAr ? 'نشر الفيديو الآن' : 'Publish Short Video'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
