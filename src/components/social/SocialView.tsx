import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Image as ImageIcon,
  Megaphone,
  Sparkles,
  Plus,
  X,
  MapPin,
  MoreHorizontal,
  Radio,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, uploadFile } from '../../lib/api';
import { SocialPost, StoryItem } from '../../types';
import { RankBadge, UserAvatar, VerifiedIcon, VipBadge } from '../shared/LmBrandMark';

interface CommentRow {
  id: string;
  display_name: string;
  username: string;
  avatar_color: string;
  avatar_initials: string;
  avatar_url: string | null;
  vip_tier: number;
  content: string;
}

export function SocialView() {
  const { user, allUsers, lang, toast, sendToAi, setActiveTab } = useApp();
  const isAr = lang === 'ar';

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [burstPostId, setBurstPostId] = useState<string | null>(null);

  // Composer Modal / Bar
  const [composerOpen, setComposerOpen] = useState(false);
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isSponsored, setIsSponsored] = useState(false);
  const [sponsorBudget, setSponsorBudget] = useState(500);
  const [uploading, setUploading] = useState(false);

  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentRow[]>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [followedIds, setFollowedIds] = useState<Record<string, boolean>>({ u_mariam: true, u_karim: true });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAll = useCallback(async () => {
    if (!user) return;
    const [pData, sData] = await Promise.all([
      api<{ posts: SocialPost[] }>(`/api/posts?userId=${user.id}`),
      api<{ stories: StoryItem[] }>('/api/stories'),
    ]);
    setPosts(pData.posts);
    setStories(sData.stories);
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-advance full-screen Story after 5s
  useEffect(() => {
    if (activeStoryIndex === null) return;
    const id = setTimeout(() => {
      if (activeStoryIndex + 1 < stories.length) {
        setActiveStoryIndex(activeStoryIndex + 1);
      } else {
        setActiveStoryIndex(null);
      }
    }, 5000);
    return () => clearTimeout(id);
  }, [activeStoryIndex, stories.length]);

  if (!user) return null;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file);
      setMediaUrl(up.url);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !content.trim()) return;
    await api('/api/posts', {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        content,
        mediaUrl,
        isSponsored,
        sponsorBudgetEgp: isSponsored ? sponsorBudget : 0,
        sponsorAudience: isSponsored ? 'مصر والخليج' : undefined,
      }),
    });
    setContent('');
    setMediaUrl(null);
    setIsSponsored(false);
    setComposerOpen(false);
    await loadAll();
    toast(isAr ? 'تم نشر المنشور' : 'Posted', 'success');
  }

  async function handleLike(postId: string, forceLike = false) {
    if (!user) return;
    const target = posts.find(p => p.id === postId);
    if (!target) return;
    if (forceLike && target.likedByMe) return;

    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? { ...p, likedByMe: !p.likedByMe, likesCount: p.likedByMe ? p.likesCount - 1 : p.likesCount + 1 }
          : p
      )
    );
    await api(`/api/posts/${postId}/like`, { method: 'POST', body: JSON.stringify({ userId: user.id }) });
  }

  async function toggleComments(postId: string) {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null);
      return;
    }
    setOpenCommentsPostId(postId);
    const data = await api<{ comments: CommentRow[] }>(`/api/posts/${postId}/comments`);
    setCommentsMap(prev => ({ ...prev, [postId]: data.comments }));
  }

  async function submitComment(postId: string) {
    if (!user || !commentDraft.trim()) return;
    await api(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, content: commentDraft }),
    });
    setCommentDraft('');
    const data = await api<{ comments: CommentRow[] }>(`/api/posts/${postId}/comments`);
    setCommentsMap(prev => ({ ...prev, [postId]: data.comments }));
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p)));
  }

  const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

  return (
    <div className="h-full overflow-y-auto bg-[var(--lm-bg)]">
      <div className="max-w-[980px] mx-auto px-3 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ============================================================
            INSTAGRAM / PIXELFED CENTER PHOTO FEED (7 cols)
           ============================================================ */}
        <div className="lg:col-span-7 space-y-5 max-w-[540px] mx-auto w-full">
          {/* INSTAGRAM STORIES TRAY */}
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
            {/* Create Post / Story Trigger */}
            <button
              onClick={() => setComposerOpen(true)}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <div className="relative">
                <UserAvatar
                  initials={user.avatarInitials}
                  color={user.avatarColor}
                  avatarUrl={user.avatarUrl}
                  size={62}
                />
                <span className="absolute bottom-0 end-0 w-5 h-5 rounded-full bg-[#3390EC] text-white border-2 border-[var(--lm-bg)] flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              </div>
              <span className="text-[11px] text-[var(--lm-text-secondary)]">{isAr ? 'نشر جديد' : 'Create'}</span>
            </button>

            {/* Active Creator Stories with Gradient Ring */}
            {stories.map((st, idx) => (
              <button
                key={st.id}
                onClick={() => setActiveStoryIndex(idx)}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div className="story-ring rounded-full transition-transform group-hover:scale-105">
                  <div className="p-0.5 rounded-full bg-[var(--lm-bg)]">
                    <UserAvatar
                      initials={st.avatarInitials}
                      color={st.avatarColor}
                      avatarUrl={st.avatarUrl}
                      size={58}
                    />
                  </div>
                </div>
                <span className="text-[11px] font-medium truncate max-w-[68px]">{st.displayName.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Quick Inline Share Pill */}
          <button
            onClick={() => setComposerOpen(true)}
            className="w-full rounded-2xl bg-[var(--lm-surface)] border border-[var(--lm-border)] px-4 py-3 flex items-center justify-between text-xs text-[var(--lm-text-muted)] hover:border-[var(--lm-border-strong)] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <UserAvatar initials={user.avatarInitials} color={user.avatarColor} avatarUrl={user.avatarUrl} size={32} />
              <span>{isAr ? 'شارك صورة أو لحظة جديدة...' : 'Share a photo or moment...'}</span>
            </div>
            <ImageIcon className="w-4 h-4 text-[#8774E1]" />
          </button>

          {/* INSTAGRAM-STYLE PHOTO CARDS */}
          {posts.map((post) => (
            <article key={post.id} className="rounded-3xl bg-[var(--lm-surface)] border border-[var(--lm-border)] overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="story-ring rounded-full p-[1.5px]">
                    <div className="p-[1.5px] rounded-full bg-[var(--lm-surface)]">
                      <UserAvatar
                        initials={post.avatarInitials}
                        color={post.avatarColor}
                        avatarUrl={post.avatarUrl}
                        size={36}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13.5px] font-bold truncate">{post.displayName}</span>
                      {post.verified && <VerifiedIcon />}
                      <VipBadge tier={post.vipTier} compact />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--lm-text-muted)]">
                      {post.isSponsored ? (
                        <span className="text-amber-400 font-medium">{isAr ? 'ممول • Sponsored' : 'Sponsored'}</span>
                      ) : (
                        <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {post.location}</span>
                      )}
                    </div>
                  </div>
                </div>
                <MoreHorizontal className="w-4 h-4 text-[var(--lm-text-muted)]" />
              </div>

              {/* Edge-to-Edge High-Resolution Photo / Swiper Carousel */}
              {post.mediaUrls && post.mediaUrls.length > 0 && (
                <div
                  onDoubleClick={() => {
                    setBurstPostId(post.id);
                    setTimeout(() => setBurstPostId(null), 900);
                    handleLike(post.id, true);
                  }}
                  className="relative bg-black select-none cursor-pointer"
                >
                  {post.mediaUrls.length > 1 ? (
                    <Swiper modules={[Pagination]} pagination={{ clickable: true }} className="w-full aspect-[4/4]">
                      {post.mediaUrls.map((url, idx) => (
                        <SwiperSlide key={idx}>
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </SwiperSlide>
                      ))}
                    </Swiper>
                  ) : (
                    <img src={post.mediaUrls[0]} alt="" className="w-full aspect-[4/4] object-cover" />
                  )}

                  {burstPostId === post.id && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      <Heart className="w-24 h-24 text-[#FE2C55] fill-[#FE2C55] animate-ping" />
                    </div>
                  )}
                </div>
              )}

              {/* Instagram Action Icons Row */}
              <div className="px-4 pt-3 pb-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleLike(post.id)} className="cursor-pointer transition-transform active:scale-125">
                      <Heart className={`w-6 h-6 ${post.likedByMe ? 'text-[#FE2C55] fill-[#FE2C55]' : ''}`} />
                    </button>
                    <button onClick={() => toggleComments(post.id)} className="cursor-pointer">
                      <MessageCircle className="w-6 h-6" />
                    </button>
                    <button onClick={() => toast(isAr ? 'تم نسخ الرابط' : 'Link copied', 'info')} className="cursor-pointer">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        sendToAi({
                          title: `@${post.username}`,
                          content: post.content,
                          source: 'post_summary',
                        })
                      }
                      title={isAr ? 'تلخيص عبر LM AI' : 'AI Summary'}
                      className="px-2.5 py-1 rounded-full bg-[var(--lm-surface-2)] text-[11px] font-medium flex items-center gap-1 cursor-pointer hover:bg-[var(--lm-surface-hover)]"
                    >
                      <Sparkles className="w-3 h-3 text-[#8774E1]" />
                      <span>AI</span>
                    </button>
                    <button
                      onClick={() => setSavedIds(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                      className="cursor-pointer"
                    >
                      <Bookmark className={`w-6 h-6 ${savedIds[post.id] ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Likes Count */}
                <div className="text-[13px] font-bold font-mono-num">
                  {post.likesCount.toLocaleString('en-US')} {isAr ? 'تسجيل إعجاب' : 'likes'}
                </div>

                {/* Caption */}
                <div className="text-[13.5px] leading-relaxed">
                  <span dir="ltr" className="font-bold me-2">@{post.username}</span>
                  <span className="whitespace-pre-line">{post.content}</span>
                </div>

                {/* View Comments Trigger */}
                <button
                  onClick={() => toggleComments(post.id)}
                  className="text-xs text-[var(--lm-text-muted)] hover:text-[var(--lm-text-secondary)] cursor-pointer"
                >
                  {isAr ? `عرض كل التعليقات (${post.commentsCount})` : `View all ${post.commentsCount} comments`}
                </button>

                {openCommentsPostId === post.id && (
                  <div className="pt-2 space-y-2.5 border-t border-[var(--lm-border)]">
                    {(commentsMap[post.id] || []).map((c) => (
                      <div key={c.id} className="flex items-start gap-2.5 text-xs">
                        <UserAvatar initials={c.avatar_initials} color={c.avatar_color} avatarUrl={c.avatar_url} size={26} />
                        <div>
                          <span className="font-bold me-1.5">{c.display_name}</span>
                          <span className="text-[var(--lm-text-secondary)]">{c.content}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                        placeholder={isAr ? 'إضافة تعليق...' : 'Add a comment...'}
                        className="flex-1 bg-transparent text-xs outline-none border-b border-[var(--lm-border)] py-1.5"
                      />
                      <button
                        onClick={() => submitComment(post.id)}
                        className="text-xs font-bold text-[#3390EC] cursor-pointer"
                      >
                        {isAr ? 'نشر' : 'Post'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* ============================================================
            INSTAGRAM RIGHT CREATOR & LIVE COLUMN (5 cols on desktop)
           ============================================================ */}
        <aside className="hidden lg:block lg:col-span-5 space-y-5 sticky top-5">
          {/* User Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserAvatar initials={user.avatarInitials} color={user.avatarColor} avatarUrl={user.avatarUrl} size={48} vipTier={user.vipTier} />
              <div>
                <div className="text-sm font-bold flex items-center gap-1.5">
                  <span>{isAr ? user.displayName : user.displayNameEn}</span>
                  <VipBadge tier={user.vipTier} compact />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span dir="ltr" className="text-xs text-[var(--lm-text-muted)]">@{user.username}</span>
                  <RankBadge rankId={user.rankId} lang={lang} />
                </div>
              </div>
            </div>
            <button onClick={() => setActiveTab('vip')} className="text-xs font-bold text-[#8774E1] cursor-pointer">
              VIP
            </button>
          </div>

          {/* Live Room Highlight Banner */}
          <div
            onClick={() => setActiveTab('live')}
            className="relative rounded-3xl overflow-hidden cursor-pointer group border border-white/10"
          >
            <img src="/uploads/seed/post_studio.jpg" alt="" className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-4 flex flex-col justify-between">
              <span className="self-start px-2.5 py-0.5 rounded-full bg-[#FE2C55] text-white text-[10px] font-bold flex items-center gap-1">
                <Radio className="w-3 h-3" /> LIVE • 3.8K
              </span>
              <div className="text-white">
                <div className="text-xs font-bold">{isAr ? 'ليلة القاهرة التقنية — مريم الشريف' : 'Cairo Tech Live'}</div>
                <div className="text-[11px] text-white/75">{isAr ? 'انضم لتجربة تعليقات VIP المميزة والهدايا' : 'Join Live'}</div>
              </div>
            </div>
          </div>

          {/* Suggested Creators */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[var(--lm-text-muted)]">
              {isAr ? 'مقترحون لك' : 'Suggested for you'}
            </div>
            {allUsers
              .filter(u => u.id !== user.id)
              .map((u) => {
                const following = Boolean(followedIds[u.id]);
                return (
                  <div key={u.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar initials={u.avatarInitials} color={u.avatarColor} avatarUrl={u.avatarUrl} size={36} vipTier={u.vipTier} />
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1">
                          {isAr ? u.displayName : u.displayNameEn}
                          {u.verified && <VerifiedIcon />}
                        </div>
                        <div dir="ltr" className="text-[11px] text-[var(--lm-text-muted)]">@{u.username}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setFollowedIds(p => ({ ...p, [u.id]: !p[u.id] }))}
                      className={`text-xs font-bold cursor-pointer ${
                        following ? 'text-[var(--lm-text-muted)]' : 'text-[#3390EC]'
                      }`}
                    >
                      {following ? (isAr ? 'متابَع' : 'Following') : (isAr ? 'متابعة' : 'Follow')}
                    </button>
                  </div>
                );
              })}
          </div>
        </aside>
      </div>

      {/* FULL-SCREEN INSTAGRAM STORY VIEWER */}
      {activeStory && activeStoryIndex !== null && (
        <div
          onClick={() => setActiveStoryIndex(null)}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (activeStoryIndex + 1 < stories.length) setActiveStoryIndex(activeStoryIndex + 1);
              else setActiveStoryIndex(null);
            }}
            className="relative w-full h-full sm:w-[390px] sm:h-[86vh] sm:rounded-3xl overflow-hidden bg-black cursor-pointer"
          >
            <img src={activeStory.mediaUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/75" />

            {/* Segmented Story Progress Bars */}
            <div className="absolute top-3 inset-x-3 flex gap-1.5">
              {stories.map((s, idx) => (
                <div key={s.id} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                  <div className={`h-full bg-white ${idx <= activeStoryIndex ? 'w-full' : 'w-0'}`} />
                </div>
              ))}
            </div>

            <div className="absolute top-7 inset-x-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <UserAvatar initials={activeStory.avatarInitials} color={activeStory.avatarColor} avatarUrl={activeStory.avatarUrl} size={34} />
                <span className="text-xs font-bold">{activeStory.displayName}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setActiveStoryIndex(null); }} className="p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="absolute bottom-6 inset-x-5 text-white">
              <p className="text-sm font-medium drop-shadow-md">{activeStory.caption}</p>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POST MODAL */}
      {composerOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setComposerOpen(false)}>
          <form onSubmit={handlePublish} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-[#1C1D24] text-white border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{isAr ? 'إنشاء منشور جديد' : 'New Post'}</h3>
              <button type="button" onClick={() => setComposerOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder={isAr ? 'اكتب تعليقًا للمنشور...' : 'Write a caption...'}
              className="w-full rounded-2xl bg-white/5 p-3 text-xs outline-none resize-none"
              required
            />
            {mediaUrl && <img src={mediaUrl} alt="" className="max-h-48 w-full object-cover rounded-2xl" />}
            <div className="flex items-center justify-between gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-xl bg-white/10 text-xs flex items-center gap-1.5 cursor-pointer">
                <ImageIcon className="w-4 h-4" />
                {uploading ? '...' : (isAr ? 'إضافة صورة' : 'Add Photo')}
              </button>
              <button
                type="button"
                onClick={() => setIsSponsored(v => !v)}
                className={`px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer ${
                  isSponsored ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10'
                }`}
              >
                <Megaphone className="w-4 h-4" />
                {isAr ? `ترويج (${sponsorBudget} ج.م)` : 'Promote'}
              </button>
            </div>
            <button type="submit" className="w-full py-2.5 rounded-full bg-[#8774E1] text-white text-xs font-bold cursor-pointer">
              {isAr ? 'مشاركة الآن' : 'Share'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
