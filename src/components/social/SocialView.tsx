import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Image as ImageIcon,
  Megaphone,
  Cpu,
  Send,
  Radio,
  ShieldAlert,
  Crown,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, uploadFile } from '../../lib/api';
import { SocialPost } from '../../types';
import { EditorialMediaCard, RankBadge, UserAvatar, VerifiedIcon, VipBadge } from '../shared/LmBrandMark';

interface CommentRow {
  id: string;
  display_name: string;
  username: string;
  avatar_color: string;
  avatar_initials: string;
  vip_tier: number;
  content: string;
  created_at: string;
}

export function SocialView() {
  const { user, allUsers, lang, toast, sendToAi, setActiveTab } = useApp();
  const isAr = lang === 'ar';

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isSponsored, setIsSponsored] = useState(false);
  const [sponsorBudget, setSponsorBudget] = useState(500);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentRow[]>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [followedIds, setFollowedIds] = useState<Record<string, boolean>>({ u_mariam: true, u_karim: true });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPosts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api<{ posts: SocialPost[] }>(`/api/posts?userId=${user.id}`);
      setPosts(data.posts);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  if (!user) return null;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file);
      setMediaUrl(uploaded.url);
      toast(isAr ? 'تم رفع الصورة محليًا بنجاح' : 'Image uploaded locally', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !content.trim()) return;
    setPosting(true);
    try {
      await api('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          content,
          mediaUrl,
          isSponsored,
          sponsorBudgetEgp: isSponsored ? sponsorBudget : 0,
          sponsorAudience: isSponsored ? 'مصر والخليج • اهتمامات التقنية والأعمال' : undefined,
        }),
      });
      setContent('');
      setMediaUrl(null);
      setIsSponsored(false);
      await loadPosts();
      toast(isAr ? 'تم نشر المنشور بنجاح' : 'Post published', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(postId: string) {
    if (!user) return;
    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? { ...p, likedByMe: !p.likedByMe, likesCount: p.likedByMe ? p.likesCount - 1 : p.likesCount + 1 }
          : p
      )
    );
    await api(`/api/posts/${postId}/like`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id }),
    });
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

  async function promotePost(postId: string) {
    await api(`/api/posts/${postId}/promote`, {
      method: 'POST',
      body: JSON.stringify({ budgetEgp: 750, audience: 'جمهور مخصص — السوق المصري' }),
    });
    await loadPosts();
    toast(isAr ? 'تم ترويج المنشور كحملة ممولة واضحة للمستخدمين' : 'Post promoted as sponsored campaign', 'success');
  }

  const showPlatformAd = !user.adRemoval.videos && user.vipTier === 0;

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-5">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* MAIN FEED COLUMN */}
        <div className="lg:col-span-8 space-y-4">
          {/* Composer */}
          <form onSubmit={handlePublish} className="lm-card rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <UserAvatar initials={user.avatarInitials} color={user.avatarColor} size={40} vipTier={user.vipTier} />
              <div className="flex-1 min-w-0 space-y-2.5">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  placeholder={isAr ? 'شارك فكرة، خبر، أو محتوى جديد مع مجتمع LM...' : 'Share an update, idea, or story with LM...'}
                  className="w-full bg-transparent text-sm text-[var(--lm-text)] placeholder:text-[var(--lm-text-muted)] resize-none outline-none leading-relaxed"
                />
                {mediaUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-[var(--lm-border)] max-h-60">
                    <img src={mediaUrl} alt="Upload" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setMediaUrl(null)}
                      className="absolute top-2 end-2 w-7 h-7 rounded-full bg-black/75 text-white flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {isSponsored && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-amber-300 font-medium flex items-center gap-1.5">
                      <Megaphone className="w-3.5 h-3.5" />
                      {isAr ? 'حملة ترويج ممولة (تظهر بعلامة "محتوى ممول" واضحة)' : 'Paid Promotion (Clearly labeled Sponsored)'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--lm-text-muted)]">{isAr ? 'الميزانية:' : 'Budget:'}</span>
                      <select
                        value={sponsorBudget}
                        onChange={(e) => setSponsorBudget(Number(e.target.value))}
                        className="lm-input rounded-lg px-2 py-1 text-xs font-mono-num"
                      >
                        <option value={250}>250 EGP</option>
                        <option value={500}>500 EGP</option>
                        <option value={1500}>1,500 EGP</option>
                        <option value={5000}>5,000 EGP</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--lm-border)] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="lm-btn-ghost px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {uploading ? (isAr ? 'جاري الرفع...' : 'Uploading...') : (isAr ? 'صورة' : 'Image')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSponsored(v => !v)}
                  className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    isSponsored
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'lm-btn-ghost'
                  }`}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  {isAr ? 'ترويج ممول' : 'Promote'}
                </button>
              </div>
              <button
                type="submit"
                disabled={posting || !content.trim()}
                className="lm-btn-primary px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                <Send className="w-3.5 h-3.5" />
                {isAr ? 'نشر الآن' : 'Publish'}
              </button>
            </div>
          </form>

          {/* Platform Traditional Ad (Disappears when user removes ads or activates VIP 5+) */}
          {showPlatformAd && (
            <div className="rounded-2xl p-4 border border-[var(--lm-border-strong)] bg-[var(--lm-surface-2)] flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono-num uppercase px-2 py-0.5 rounded bg-[var(--lm-surface)] border border-[var(--lm-border)] text-[var(--lm-text-muted)]">
                    {isAr ? 'إعلان منصة تقليدي' : 'Platform Ad'}
                  </span>
                  <span className="text-xs font-semibold">
                    {isAr ? 'تصفّح LM بدون إعلانات المنصة التقليدية' : 'Browse LM without traditional platform ads'}
                  </span>
                </div>
                <p className="text-xs text-[var(--lm-text-secondary)]">
                  {isAr
                    ? 'يمكنك إزالة إعلانات المنصة بالباقات المنفصلة أو عضوية VIP 5 (مع بقاء المحتوى الممول من المستخدمين بوضوح).'
                    : 'Remove platform ads via modular add-ons or VIP 5 (user-promoted posts remain clearly tagged).'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('vip')}
                className="lm-btn-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
              >
                {isAr ? 'إدارة الإعلانات وVIP' : 'Manage Ads & VIP'}
              </button>
            </div>
          )}

          {/* Posts List */}
          {posts.map((post) => (
            <article key={post.id} className="lm-card rounded-2xl p-4 sm:p-5 space-y-3.5">
              {/* Post Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar initials={post.avatarInitials} color={post.avatarColor} size={40} vipTier={post.vipTier} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold truncate">{post.displayName}</span>
                      {post.verified && <VerifiedIcon />}
                      <VipBadge tier={post.vipTier} compact />
                      <RankBadge rankId={post.rankId} lang={lang} />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--lm-text-muted)] mt-0.5">
                      <span dir="ltr" className="font-mono-num inline-block">@{post.username}</span>
                      {post.isSponsored && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/12 border border-amber-500/30 text-amber-400 font-medium text-[10px]">
                          <Megaphone className="w-2.5 h-2.5" />
                          {isAr ? 'محتوى ممول' : 'Sponsored'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Explicit Share to LM AI */}
                <button
                  onClick={() =>
                    sendToAi({
                      title: `${isAr ? 'منشور' : 'Post'} @${post.username}`,
                      content: post.content,
                      source: 'post_summary',
                    })
                  }
                  title={isAr ? 'تلخيص المنشور عبر LM AI بإذنك' : 'Summarize with LM AI'}
                  className="lm-btn-ghost px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5 text-[var(--lm-accent)]" />
                  <span className="hidden sm:inline">{isAr ? 'تلخيص AI' : 'AI Summary'}</span>
                </button>
              </div>

              {/* Post Body */}
              <p className="text-sm leading-relaxed whitespace-pre-line text-[var(--lm-text)]">
                {post.content}
              </p>

              {/* Post Media */}
              {post.mediaUrl ? (
                <div className="rounded-xl overflow-hidden border border-[var(--lm-border)] max-h-[380px]">
                  <img src={post.mediaUrl} alt="Post attachment" className="w-full h-full object-cover" />
                </div>
              ) : post.mediaStyle ? (
                <EditorialMediaCard styleKey={post.mediaStyle} caption={post.mediaCaption} />
              ) : null}

              {post.isSponsored && post.sponsorAudience && (
                <div className="text-[11px] text-[var(--lm-text-muted)] flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--lm-surface-2)] border border-[var(--lm-border)]">
                  <span>{isAr ? `الجمهور المستهدف: ${post.sponsorAudience}` : `Target: ${post.sponsorAudience}`}</span>
                  <span className="font-mono-num">{post.sponsorBudgetEgp.toLocaleString('en-US')} EGP</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2.5 border-t border-[var(--lm-border)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono-num flex items-center gap-1.5 transition-colors cursor-pointer ${
                      post.likedByMe
                        ? 'bg-red-500/12 text-red-400 border border-red-500/30'
                        : 'text-[var(--lm-text-secondary)] hover:bg-[var(--lm-surface-hover)] border border-transparent'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${post.likedByMe ? 'fill-current' : ''}`} />
                    {post.likesCount.toLocaleString('en-US')}
                  </button>

                  <button
                    onClick={() => toggleComments(post.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono-num text-[var(--lm-text-secondary)] hover:bg-[var(--lm-surface-hover)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {post.commentsCount}
                  </button>

                  <button
                    onClick={() => toast(isAr ? 'تم نسخ رابط المنشور' : 'Post link copied', 'info')}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono-num text-[var(--lm-text-secondary)] hover:bg-[var(--lm-surface-hover)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {post.sharesCount}
                  </button>
                </div>

                {!post.isSponsored && post.userId === user.id && (
                  <button
                    onClick={() => promotePost(post.id)}
                    className="text-[11px] font-medium text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Megaphone className="w-3 h-3" />
                    {isAr ? 'ترويج المنشور' : 'Boost Post'}
                  </button>
                )}
              </div>

              {/* Comments Drawer */}
              {openCommentsPostId === post.id && (
                <div className="pt-3 border-t border-[var(--lm-border)] space-y-3">
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {(commentsMap[post.id] || []).length === 0 ? (
                      <div className="text-xs text-[var(--lm-text-muted)] text-center py-2">
                        {isAr ? 'كن أول من يعلق على هذا المنشور.' : 'Be the first to comment.'}
                      </div>
                    ) : (
                      (commentsMap[post.id] || []).map((c) => (
                        <div key={c.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--lm-surface-2)]">
                          <UserAvatar initials={c.avatar_initials} color={c.avatar_color} size={28} vipTier={c.vip_tier as 0 | 1 | 2 | 3 | 4 | 5} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold">{c.display_name}</span>
                              <VipBadge tier={c.vip_tier as 0 | 1 | 2 | 3 | 4 | 5} compact />
                            </div>
                            <p className="text-xs text-[var(--lm-text-secondary)] mt-0.5">{c.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                      placeholder={isAr ? 'أضف تعليقًا...' : 'Write a comment...'}
                      className="lm-input flex-1 rounded-xl px-3 py-2 text-xs"
                    />
                    <button
                      onClick={() => submitComment(post.id)}
                      className="lm-btn-primary px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      {isAr ? 'إرسال' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>

        {/* RIGHT DISCOVERY SIDEBAR */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Active Profile Card */}
          <div className="lm-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <UserAvatar initials={user.avatarInitials} color={user.avatarColor} size={46} vipTier={user.vipTier} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold truncate">{isAr ? user.displayName : user.displayNameEn}</span>
                  {user.verified && <VerifiedIcon />}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <VipBadge tier={user.vipTier} compact />
                  <RankBadge rankId={user.rankId} lang={lang} />
                </div>
              </div>
            </div>
            <p className="text-xs text-[var(--lm-text-secondary)] leading-relaxed">{user.bio}</p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--lm-border)] text-center">
              <div className="p-2 rounded-xl bg-[var(--lm-surface-2)]">
                <div className="text-sm font-bold font-mono-num">{user.followersCount.toLocaleString('en-US')}</div>
                <div className="text-[10px] text-[var(--lm-text-muted)]">{isAr ? 'متابع' : 'Followers'}</div>
              </div>
              <div className="p-2 rounded-xl bg-[var(--lm-surface-2)]">
                <div className="text-sm font-bold font-mono-num">{user.followingCount.toLocaleString('en-US')}</div>
                <div className="text-[10px] text-[var(--lm-text-muted)]">{isAr ? 'يتابع' : 'Following'}</div>
              </div>
            </div>
          </div>

          {/* Live Broadcast Quick-Enter */}
          <div className="lm-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-red-500" />
                {isAr ? 'بث مباشر الآن' : 'Live Now'}
              </span>
              <span className="text-[10px] font-mono-num px-2 py-0.5 rounded bg-red-500/15 text-red-400">LIVE</span>
            </div>
            <p className="text-xs text-[var(--lm-text-secondary)] leading-relaxed">
              {isAr
                ? 'ليلة القاهرة التقنية — جرّب نظام أولوية التعليقات المميزة (VIP 1 / 2 / 3) والهدايا الافتراضية الآن.'
                : 'Cairo Tech Night — Experience live VIP 1/2/3 highlighted comment queue & virtual gifts.'}
            </p>
            <button
              onClick={() => setActiveTab('live')}
              className="lm-btn-primary w-full py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              {isAr ? 'دخول البث المباشر' : 'Enter Live Room'}
            </button>
          </div>

          {/* Suggested Creators */}
          <div className="lm-card rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--lm-text-secondary)]">
              {isAr ? 'صناع محتوى وحسابات مقترحة' : 'Suggested Creators'}
            </h3>
            <div className="space-y-2.5">
              {allUsers
                .filter(u => u.id !== user.id)
                .map((u) => {
                  const following = Boolean(followedIds[u.id]);
                  return (
                    <div key={u.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar initials={u.avatarInitials} color={u.avatarColor} size={32} vipTier={u.vipTier} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate flex items-center gap-1">
                            {isAr ? u.displayName : u.displayNameEn}
                            <VipBadge tier={u.vipTier} compact />
                          </div>
                          <div dir="ltr" className="text-[10px] text-[var(--lm-text-muted)] font-mono-num inline-block">@{u.username}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setFollowedIds(prev => ({ ...prev, [u.id]: !prev[u.id] }));
                          toast(
                            following
                              ? (isAr ? `تم إلغاء متابعة ${u.displayName}` : `Unfollowed ${u.displayNameEn}`)
                              : (isAr ? `أصبحت تتابع ${u.displayName}` : `Following ${u.displayNameEn}`),
                            'info'
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 cursor-pointer ${
                          following ? 'lm-btn-ghost' : 'lm-btn-primary'
                        }`}
                      >
                        {following ? (isAr ? 'متابَع' : 'Following') : (isAr ? 'متابعة' : 'Follow')}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Privacy Guarantee Footer */}
          <div className="lm-card-subtle rounded-2xl p-3.5 flex items-start gap-2.5 text-[11px] text-[var(--lm-text-muted)]">
            <ShieldAlert className="w-4 h-4 text-[var(--lm-accent)] shrink-0 mt-0.5" />
            <span>
              {isAr
                ? 'LM AI لا يتدخل في تصفحك إلا عند طلبك المباشر مثل زر "تلخيص AI".'
                : 'LM AI only acts on explicit actions like "AI Summary".'}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
