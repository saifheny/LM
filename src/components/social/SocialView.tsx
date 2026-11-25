import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageCircle,
  Repeat2,
  Sparkles,
  Image as ImageIcon,
  BarChart2,
  X,
  CornerDownLeft,
} from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

import { Lang, PostCommentItem, PostPoll, SocialPost, StoryItem, UserProfile } from '../../types';
import { UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ChromeArrowButton } from '../shared/HardwareUI';
import { apiGet, apiPost, apiUploadFile } from '../../lib/api';

interface SocialViewProps {
  user: UserProfile;
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
}

const TOPICS = ['الكل', 'تقنية', 'مصر', 'أسواق', 'صوتيات'];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function SocialView({ user, lang, lastWsEvent }: SocialViewProps) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [feedSort, setFeedSort] = useState<'for_you' | 'top' | 'discussions'>('for_you');
  const [selectedTopic, setSelectedTopic] = useState('الكل');

  // Composer state
  const [draft, setDraft] = useState('');
  const [draftTopic, setDraftTopic] = useState('تقنية');
  const [uploadedMedia, setUploadedMedia] = useState<string | null>(null);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Thread comments & inline AI analysis state
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostCommentItem[]>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyParentByPost, setReplyParentByPost] = useState<Record<string, { id: string; name: string } | null>>({});
  const [aiInsights, setAiInsights] = useState<Record<string, { loading: boolean; text: string }>>({});

  const loadFeed = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      apiGet<{ ok: boolean; posts: SocialPost[] }>(`/api/posts?userId=${user.id}`),
      apiGet<{ ok: boolean; stories: StoryItem[] }>('/api/stories'),
    ]);
    setPosts(pRes.posts);
    setStories(sRes.stories);
  }, [user.id]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (lastWsEvent?.event === 'social:new_post') {
      loadFeed();
    }
  }, [lastWsEvent, loadFeed]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const up = await apiUploadFile(f);
    setUploadedMedia(up.url);
    e.target.value = '';
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() && !uploadedMedia) return;
    setPublishing(true);
    try {
      const validPoll =
        showPollBuilder && pollQuestion.trim() && pollOpts.filter(o => o.trim()).length >= 2
          ? { question: pollQuestion.trim(), options: pollOpts.filter(o => o.trim()) }
          : null;

      await apiPost('/api/posts', {
        userId: user.id,
        content: draft.trim() || pollQuestion.trim(),
        topic: draftTopic,
        mediaUrl: uploadedMedia,
        poll: validPoll,
      });
      setDraft('');
      setUploadedMedia(null);
      setShowPollBuilder(false);
      setPollQuestion('');
      setPollOpts(['', '']);
      await loadFeed();
    } finally {
      setPublishing(false);
    }
  }

  async function handleVote(postId: string, direction: 1 | -1) {
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const nextVote: -1 | 0 | 1 = p.myVote === direction ? 0 : direction;
        const delta = nextVote - p.myVote;
        return { ...p, myVote: nextVote, score: p.score + delta };
      })
    );
    const res = await apiPost<{ ok: boolean; score: number; myVote: -1 | 0 | 1 }>(`/api/posts/${postId}/vote`, {
      userId: user.id,
      direction,
    });
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, score: res.score, myVote: res.myVote } : p)));
  }

  async function handlePollVote(postId: string, optionId: string) {
    const res = await apiPost<{ ok: boolean; poll: PostPoll }>(`/api/posts/${postId}/poll-vote`, {
      userId: user.id,
      optionId,
    });
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, poll: res.poll } : p)));
  }

  async function handleRepost(postId: string) {
    const res = await apiPost<{ ok: boolean; sharesCount: number }>(`/api/posts/${postId}/repost`, {});
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, sharesCount: res.sharesCount } : p)));
  }

  async function toggleThread(postId: string) {
    const nextOpen = !openThreads[postId];
    setOpenThreads(prev => ({ ...prev, [postId]: nextOpen }));
    if (nextOpen && !commentsByPost[postId]) {
      const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`);
      setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
    }
  }

  async function submitComment(postId: string, e: React.FormEvent) {
    e.preventDefault();
    const text = (replyDrafts[postId] || '').trim();
    if (!text) return;
    const parent = replyParentByPost[postId];
    await apiPost(`/api/posts/${postId}/comments`, {
      userId: user.id,
      content: text,
      parentId: parent?.id || null,
    });
    setReplyDrafts(prev => ({ ...prev, [postId]: '' }));
    setReplyParentByPost(prev => ({ ...prev, [postId]: null }));
    const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`);
    setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p)));
  }

  async function analyzePostWithAi(post: SocialPost) {
    if (aiInsights[post.id]?.text) {
      setAiInsights(prev => {
        const copy = { ...prev };
        delete copy[post.id];
        return copy;
      });
      return;
    }
    setAiInsights(prev => ({ ...prev, [post.id]: { loading: true, text: '' } }));
    try {
      const res = await apiPost<{ ok: boolean; reply: string }>('/api/ai/chat', {
        userId: user.id,
        prompt: 'قدّم قراءة تحليلية مقتضبة وذكية من سطرين لهذا المنشور وسياقه.',
        source: 'social',
        explicitUserConsent: true,
        sharedContext: post.content,
      });
      setAiInsights(prev => ({ ...prev, [post.id]: { loading: false, text: res.reply } }));
    } catch {
      setAiInsights(prev => ({ ...prev, [post.id]: { loading: false, text: 'تعذر الاتصال بالمساعد حاليًا.' } }));
    }
  }

  const filteredPosts = posts
    .filter(p => (selectedTopic === 'الكل' ? true : p.topic === selectedTopic))
    .sort((a, b) => {
      if (feedSort === 'top') return b.score - a.score;
      if (feedSort === 'discussions') return b.commentsCount - a.commentsCount;
      return 0;
    });

  return (
    <div className="min-h-full w-full bg-black text-[#F5F5F7]">
      {/* Pure Containerless X + Reddit Stream Column */}
      <div className="max-w-[620px] mx-auto min-h-screen border-x border-white/[0.08]">
        {/* Sticky Pure-Black Translucent Header */}
        <header className="sticky top-0 z-20 bg-black/85 backdrop-blur-md border-b border-white/[0.08]">
          <div className="grid grid-cols-3 text-xs font-medium">
            {[
              { id: 'for_you' as const, ar: 'لك', en: 'For You' },
              { id: 'top' as const, ar: 'الأعلى تصويتًا', en: 'Top Voted' },
              { id: 'discussions' as const, ar: 'نقاشات', en: 'Threads' },
            ].map(t => {
              const active = feedSort === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFeedSort(t.id)}
                  className={`py-3.5 relative transition-colors cursor-pointer ${
                    active ? 'text-white font-semibold' : 'text-[#71717A] hover:text-[#D4D4D8]'
                  }`}
                >
                  <span>{lang === 'ar' ? t.ar : t.en}</span>
                  {active && <span className="absolute bottom-0 inset-x-10 h-[2px] rounded-full bg-white" />}
                </button>
              );
            })}
          </div>

          {/* Minimal Subreddit-style Topic Filter Strip */}
          <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {TOPICS.map(topic => {
              const active = selectedTopic === topic;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  className={`px-3 py-1 rounded-full text-[11.5px] shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#F5F5F7] text-black font-semibold'
                      : 'bg-[#09090B] border border-white/[0.08] text-[#8E8E93] hover:text-white'
                  }`}
                >
                  {topic === 'الكل' ? topic : `r/${topic}`}
                </button>
              );
            })}
          </div>
        </header>

        {/* Minimal Stories Strip (Zero Card Box) */}
        {stories.length > 0 && (
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-4 overflow-x-auto no-scrollbar">
            {stories.map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => setActiveStory(st)}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div className="p-[2px] rounded-full border border-white/30 group-hover:border-white transition-colors">
                  <UserAvatar initials={st.avatarInitials} avatarUrl={st.avatarUrl} size={48} />
                </div>
                <span className="text-[11px] text-[#A1A1AA] max-w-[64px] truncate">{st.displayName.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Inline X-Style Composer Directly on #000000 */}
        <form onSubmit={submitPost} className="px-4 py-3.5 border-b border-white/[0.08] flex gap-3">
          <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={38} />
          <div className="flex-1 min-w-0">
            <textarea
              rows={2}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={lang === 'ar' ? 'ماذا يحدث؟ اطرح فكرة أو نقاشًا...' : "What's happening?"}
              className="w-full bg-transparent resize-none text-[15px] text-[#F5F5F7] placeholder:text-[#52525B] outline-none leading-relaxed"
            />

            {uploadedMedia && (
              <div className="relative mt-2 rounded-2xl overflow-hidden border border-white/[0.09]">
                <img src={uploadedMedia} alt="upload" className="w-full max-h-[280px] object-cover" />
                <button
                  type="button"
                  onClick={() => setUploadedMedia(null)}
                  className="absolute top-2 end-2 w-7 h-7 rounded-full bg-black/80 border border-white/15 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Inline Poll Builder */}
            {showPollBuilder && (
              <div className="mt-2.5 pt-2.5 border-t border-white/[0.08] space-y-2">
                <input
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  placeholder="سؤال الاستطلاع..."
                  className="w-full h-9 rounded-lg bg-[#09090B] border border-white/[0.09] px-3 text-xs text-white placeholder:text-[#52525B] outline-none"
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
                    className="w-full h-8 rounded-lg bg-[#09090B] border border-white/[0.08] px-3 text-xs text-white placeholder:text-[#52525B] outline-none"
                  />
                ))}
                {pollOpts.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setPollOpts([...pollOpts, ''])}
                    className="text-[11px] text-[#8E8E93] hover:text-white cursor-pointer"
                  >
                    + إضافة خيار آخر
                  </button>
                )}
              </div>
            )}

            <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  title="إرفاق صورة"
                  className="w-8 h-8 rounded-full hover:bg-white/[0.06] text-[#8E8E93] hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPollBuilder(v => !v)}
                  title="استطلاع رأي"
                  className={`w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center cursor-pointer ${
                    showPollBuilder ? 'text-white bg-white/[0.08]' : 'text-[#8E8E93] hover:text-white'
                  }`}
                >
                  <BarChart2 className="w-4 h-4" strokeWidth={1.8} />
                </button>
                <select
                  value={draftTopic}
                  onChange={e => setDraftTopic(e.target.value)}
                  className="bg-[#09090B] border border-white/[0.08] rounded-full px-2.5 py-1 text-[11px] text-[#A1A1AA] outline-none cursor-pointer"
                >
                  {TOPICS.filter(t => t !== 'الكل').map(t => (
                    <option key={t} value={t} className="bg-black">
                      r/{t}
                    </option>
                  ))}
                </select>
              </div>

              <ChromeArrowButton type="submit" disabled={publishing || (!draft.trim() && !uploadedMedia)} size={36} />
            </div>
          </div>
        </form>

        {/* Pure Hairline Stream (Zero Card Boxes!) */}
        <div className="divide-y divide-white/[0.08]">
          {filteredPosts.map(post => {
            const isThreadOpen = Boolean(openThreads[post.id]);
            const postComments = commentsByPost[post.id] || [];
            const rootComments = postComments.filter(c => !c.parentId);
            const getReplies = (parentId: string) => postComments.filter(c => c.parentId === parentId);
            const insight = aiInsights[post.id];
            const totalPollVotes = post.poll
              ? post.poll.options.reduce((acc, o) => acc + o.votes, 0)
              : 0;

            return (
              <article key={post.id} className="px-4 py-4 hover:bg-white/[0.015] transition-colors">
                <div className="flex gap-3">
                  {/* Left Avatar + X Thread Line */}
                  <div className="flex flex-col items-center">
                    <UserAvatar initials={post.avatarInitials} avatarUrl={post.avatarUrl} size={40} />
                    {isThreadOpen && <div className="w-[1.5px] flex-1 bg-white/[0.12] mt-2" />}
                  </div>

                  {/* Post Content Column */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="text-[14px] font-semibold text-[#F5F5F7] truncate">{post.displayName}</span>
                        {post.verified && <VerifiedIcon />}
                        <span className="text-xs text-[#71717A] font-mono-num">@{post.username}</span>
                        <span className="text-[#52525B]">·</span>
                        <span className="text-xs text-[#71717A]">{post.createdAt}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full border border-white/[0.08] text-[10.5px] text-[#8E8E93] shrink-0">
                        r/{post.topic}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[15px] text-[#F5F5F7] leading-[1.6] whitespace-pre-wrap">
                      {post.content}
                    </p>

                    {/* Media Carousel */}
                    {post.mediaUrls.length > 0 && (
                      <div className="mt-3 rounded-2xl overflow-hidden border border-white/[0.08] bg-[#050507]">
                        {post.mediaUrls.length === 1 ? (
                          <img
                            src={post.mediaUrls[0]}
                            alt=""
                            className="w-full max-h-[420px] object-cover block"
                          />
                        ) : (
                          <Swiper modules={[Pagination]} pagination={{ clickable: true }} spaceBetween={0} slidesPerView={1}>
                            {post.mediaUrls.map((url, idx) => (
                              <SwiperSlide key={idx}>
                                <img src={url} alt="" className="w-full h-[340px] object-cover block" />
                              </SwiperSlide>
                            ))}
                          </Swiper>
                        )}
                      </div>
                    )}

                    {/* Interactive Live Poll */}
                    {post.poll && (
                      <div className="mt-3 pt-2 space-y-2">
                        <div className="text-[13px] font-medium text-[#E4E4E7]">{post.poll.question}</div>
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
                        <div className="text-[11px] text-[#71717A] font-mono-num">
                          {formatCount(totalPollVotes)} {lang === 'ar' ? 'صوت' : 'votes'}
                        </div>
                      </div>
                    )}

                    {/* Inline Grok-Style LM AI Analysis */}
                    {insight && (
                      <div className="mt-3 ps-3 border-s-2 border-white/25 py-1 text-xs text-[#D4D4D8] leading-relaxed">
                        <div className="text-[10.5px] font-mono-num text-[#8E8E93] mb-0.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>LM AI</span>
                        </div>
                        {insight.loading ? (
                          <span className="text-[#71717A]">جارٍ التحليل...</span>
                        ) : (
                          <span>{insight.text}</span>
                        )}
                      </div>
                    )}

                    {/* Hybrid Action Row: Reddit Upvote/Downvote + X Thread + Repost + Grok AI */}
                    <div className="mt-3 flex items-center justify-between text-[#71717A] max-w-[460px]">
                      {/* Reddit Vote Pill */}
                      <div className="inline-flex items-center rounded-full bg-[#09090B] border border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => handleVote(post.id, 1)}
                          className={`px-2 py-1 rounded-s-full flex items-center cursor-pointer transition-colors ${
                            post.myVote === 1 ? 'text-white bg-white/[0.1]' : 'hover:text-white'
                          }`}
                        >
                          <ArrowBigUp className={`w-4 h-4 ${post.myVote === 1 ? 'fill-current' : ''}`} />
                        </button>
                        <span className={`px-1.5 text-xs font-mono-num ${post.myVote !== 0 ? 'text-white font-semibold' : 'text-[#A1A1AA]'}`}>
                          {formatCount(post.score)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleVote(post.id, -1)}
                          className={`px-2 py-1 rounded-e-full flex items-center cursor-pointer transition-colors ${
                            post.myVote === -1 ? 'text-[#EF4444] bg-white/[0.06]' : 'hover:text-white'
                          }`}
                        >
                          <ArrowBigDown className={`w-4 h-4 ${post.myVote === -1 ? 'fill-current' : ''}`} />
                        </button>
                      </div>

                      {/* X Replies Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleThread(post.id)}
                        className={`flex items-center gap-1.5 text-xs hover:text-white transition-colors cursor-pointer ${
                          isThreadOpen ? 'text-white' : ''
                        }`}
                      >
                        <MessageCircle className="w-4 h-4" strokeWidth={1.7} />
                        <span className="font-mono-num">{formatCount(post.commentsCount)}</span>
                      </button>

                      {/* Repost */}
                      <button
                        type="button"
                        onClick={() => handleRepost(post.id)}
                        className="flex items-center gap-1.5 text-xs hover:text-white transition-colors cursor-pointer"
                      >
                        <Repeat2 className="w-4 h-4" strokeWidth={1.7} />
                        <span className="font-mono-num">{formatCount(post.sharesCount)}</span>
                      </button>

                      {/* Grok-Style Inline AI Context */}
                      <button
                        type="button"
                        onClick={() => analyzePostWithAi(post)}
                        className={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${
                          insight ? 'text-white font-medium' : 'hover:text-white'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" strokeWidth={1.7} />
                        <span>LM AI</span>
                      </button>
                    </div>

                    {/* Nested X + Reddit Discussion Thread */}
                    {isThreadOpen && (
                      <div className="mt-3.5 pt-3 border-t border-white/[0.08] space-y-3">
                        {rootComments.map(c => {
                          const replies = getReplies(c.id);
                          return (
                            <div key={c.id} className="space-y-2">
                              <div className="flex gap-2.5">
                                <UserAvatar initials={c.avatarInitials} avatarUrl={c.avatarUrl} size={28} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="font-semibold text-[#F5F5F7]">{c.displayName}</span>
                                    {c.verified && <VerifiedIcon />}
                                    <span className="text-[#71717A]">· {c.createdAt}</span>
                                  </div>
                                  <p className="text-[13.5px] text-[#E4E4E7] mt-0.5 leading-relaxed">{c.content}</p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReplyParentByPost(prev => ({
                                        ...prev,
                                        [post.id]: { id: c.id, name: c.displayName },
                                      }))
                                    }
                                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#71717A] hover:text-white cursor-pointer"
                                  >
                                    <CornerDownLeft className="w-3 h-3" />
                                    <span>رد</span>
                                  </button>
                                </div>
                              </div>

                              {/* Nested Replies with Vertical Reddit/X Branch Line */}
                              {replies.length > 0 && (
                                <div className="ms-3.5 ps-3.5 border-s border-white/[0.12] space-y-2.5">
                                  {replies.map(rep => (
                                    <div key={rep.id} className="flex gap-2">
                                      <UserAvatar initials={rep.avatarInitials} avatarUrl={rep.avatarUrl} size={24} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 text-[11.5px]">
                                          <span className="font-semibold text-[#F5F5F7]">{rep.displayName}</span>
                                          <span className="text-[#71717A]">· {rep.createdAt}</span>
                                        </div>
                                        <p className="text-[13px] text-[#D4D4D8] mt-0.5 leading-relaxed">{rep.content}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Thread Reply Composer */}
                        <form onSubmit={e => submitComment(post.id, e)} className="pt-1">
                          {replyParentByPost[post.id] && (
                            <div className="mb-1.5 flex items-center justify-between text-[11px] text-[#8E8E93] px-2">
                              <span>الرد على {replyParentByPost[post.id]?.name}</span>
                              <button
                                type="button"
                                onClick={() => setReplyParentByPost(prev => ({ ...prev, [post.id]: null }))}
                                className="hover:text-white cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-2 rounded-full bg-[#070708] border border-white/[0.1] ps-3.5 pe-1 py-1">
                            <input
                              value={replyDrafts[post.id] || ''}
                              onChange={e => setReplyDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                              placeholder="أضف ردًا في النقاش..."
                              className="flex-1 bg-transparent text-xs text-white placeholder:text-[#52525B] outline-none"
                            />
                            <ChromeArrowButton type="submit" size={30} />
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Full-Screen Edge-to-Edge Story Viewer */}
      {activeStory && (
        <div
          onClick={() => setActiveStory(null)}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[400px] h-[82vh] rounded-3xl overflow-hidden border border-white/[0.12] bg-black"
          >
            <img src={activeStory.mediaUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserAvatar initials={activeStory.avatarInitials} avatarUrl={activeStory.avatarUrl} size={34} />
                <span className="text-xs font-semibold text-white">{activeStory.displayName}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveStory(null)}
                className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {activeStory.caption && (
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/90 to-transparent text-sm text-white">
                {activeStory.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
