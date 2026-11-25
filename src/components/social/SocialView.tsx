import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Mic,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

import { Lang, PostCommentItem, PostPoll, SocialPost, StoryItem, UserProfile } from '../../types';
import { UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ChromeArrowButton } from '../shared/HardwareUI';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { apiGet, apiPost, apiUploadFile } from '../../lib/api';

interface SocialViewProps {
  user: UserProfile;
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function SocialView({ user, lang, lastWsEvent }: SocialViewProps) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);

  // Full-Screen Interactive Lightbox State (Single-Tap on Photo!)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number; caption: string; author: string } | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);

  // Single-Tap vs Double-Tap timer map per post
  const tapTimersRef = useRef<Record<string, number>>({});
  const lastTapMsRef = useRef<Record<string, number>>({});

  // Composer state (clean Instagram/X inline on #000000)
  const [draft, setDraft] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState<string | null>(null);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Comments + Voice Replies + @LM AI inside Comments
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostCommentItem[]>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyParentByPost, setReplyParentByPost] = useState<Record<string, { id: string; name: string } | null>>({});
  const [replyAiModeByPost, setReplyAiModeByPost] = useState<Record<string, boolean>>({});
  const [recordingPostId, setRecordingPostId] = useState<string | null>(null);
  const [submittingCommentPost, setSubmittingCommentPost] = useState<string | null>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightbox(null);
        setLightboxZoomed(false);
        setActiveStory(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  async function handleVote(postId: string, direction: 1 | -1, forceUpvote = false) {
    const target = posts.find(p => p.id === postId);
    if (forceUpvote && target?.myVote === 1) return; // already upvoted on double-tap

    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const nextVote: -1 | 0 | 1 = p.myVote === direction && !forceUpvote ? 0 : direction;
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

  /**
   * Smart Single-Tap vs Double-Tap handler on Post Photos:
   * - Double-Tap (< 260ms): instantly upvotes/likes the post!
   * - Single-Tap: opens the full-screen Lightbox viewer with zoom & carousel controls!
   */
  function handleMediaTap(post: SocialPost, mediaIndex: number) {
    const now = Date.now();
    const prev = lastTapMsRef.current[post.id] || 0;
    lastTapMsRef.current[post.id] = now;

    if (now - prev < 260) {
      window.clearTimeout(tapTimersRef.current[post.id]);
      lastTapMsRef.current[post.id] = 0;
      handleVote(post.id, 1, true);
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
    const res = await apiPost<{ ok: boolean; sharesCount: number }>(`/api/posts/${postId}/repost`, {});
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, sharesCount: res.sharesCount } : p)));
  }

  async function toggleThread(postId: string) {
    const nextOpen = !openThreads[postId];
    setOpenThreads(prev => ({ ...prev, [postId]: nextOpen }));
    if (nextOpen) {
      const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`);
      setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
    }
  }

  async function submitComment(postId: string, e: React.FormEvent) {
    e.preventDefault();
    const text = (replyDrafts[postId] || '').trim();
    if (!text) return;
    const parent = replyParentByPost[postId];
    const invokeAi = Boolean(replyAiModeByPost[postId]) || /@(lm\s*ai|ai)/i.test(text);

    setSubmittingCommentPost(postId);
    try {
      await apiPost(`/api/posts/${postId}/comments`, {
        userId: user.id,
        content: text,
        parentId: parent?.id || null,
        invokeAi,
      });
      setReplyDrafts(prev => ({ ...prev, [postId]: '' }));
      setReplyParentByPost(prev => ({ ...prev, [postId]: null }));
      setReplyAiModeByPost(prev => ({ ...prev, [postId]: false }));

      const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`);
      setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
      setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: res.comments.length } : p)));
    } finally {
      setSubmittingCommentPost(null);
    }
  }

  async function submitVoiceComment(postId: string, file: File, durationSec: number) {
    setRecordingPostId(null);
    const parent = replyParentByPost[postId];
    const up = await apiUploadFile(file);
    await apiPost(`/api/posts/${postId}/comments`, {
      userId: user.id,
      content: '',
      parentId: parent?.id || null,
      audioUrl: up.url,
      audioDurationSec: durationSec,
      transcript: 'رسالة صوتية مسجلة في التعليقات.',
    });
    setReplyParentByPost(prev => ({ ...prev, [postId]: null }));
    const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`);
    setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: res.comments.length } : p)));
  }

  return (
    <div className="min-h-full w-full bg-black text-[#F5F5F7]">
      {/* Pure Instagram-Inspired Stream on #000000 (Zero Categories, Zero Top Filter Tabs, Zero Cards) */}
      <div className="max-w-[600px] mx-auto min-h-screen border-x border-white/[0.08]">
        {/* Stories Row */}
        {stories.length > 0 && (
          <div className="px-4 py-4 border-b border-white/[0.08] flex items-center gap-4 overflow-x-auto no-scrollbar">
            {stories.map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => setActiveStory(st)}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div className="p-[2px] rounded-full border border-white/35 group-hover:border-white transition-colors">
                  <UserAvatar initials={st.avatarInitials} avatarUrl={st.avatarUrl} size={52} />
                </div>
                <span className="text-[11px] text-[#A1A1AA] max-w-[64px] truncate">{st.displayName.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Minimal Inline Post Composer */}
        <form onSubmit={submitPost} className="px-4 py-3.5 border-b border-white/[0.08] flex gap-3">
          <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={38} />
          <div className="flex-1 min-w-0">
            <textarea
              rows={2}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={lang === 'ar' ? 'شارك لحظة أو فكرة...' : 'Share something...'}
              className="w-full bg-transparent resize-none text-[15px] text-[#F5F5F7] placeholder:text-[#52525B] outline-none leading-relaxed"
            />

            {uploadedMedia && (
              <div className="relative mt-2 rounded-2xl overflow-hidden border border-white/[0.09]">
                <img src={uploadedMedia} alt="" className="w-full max-h-[280px] object-cover" />
                <button
                  type="button"
                  onClick={() => setUploadedMedia(null)}
                  className="absolute top-2 end-2 w-7 h-7 rounded-full bg-black/80 border border-white/15 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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
                    + خيار إضافي
                  </button>
                )}
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-1">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-8 h-8 rounded-full hover:bg-white/[0.06] text-[#8E8E93] hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPollBuilder(v => !v)}
                  className={`w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center cursor-pointer ${
                    showPollBuilder ? 'text-white bg-white/[0.08]' : 'text-[#8E8E93] hover:text-white'
                  }`}
                >
                  <BarChart2 className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>

              <ChromeArrowButton type="submit" disabled={publishing || (!draft.trim() && !uploadedMedia)} size={36} />
            </div>
          </div>
        </form>

        {/* Continuous Clean Feed */}
        <div className="divide-y divide-white/[0.08]">
          {posts.map(post => {
            const isThreadOpen = Boolean(openThreads[post.id]);
            const postComments = commentsByPost[post.id] || [];
            const rootComments = postComments.filter(c => !c.parentId);
            const getReplies = (parentId: string) => postComments.filter(c => c.parentId === parentId);
            const totalPollVotes = post.poll ? post.poll.options.reduce((acc, o) => acc + o.votes, 0) : 0;
            const aiMode = Boolean(replyAiModeByPost[post.id]);

            return (
              <article key={post.id} className="px-4 py-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <UserAvatar initials={post.avatarInitials} avatarUrl={post.avatarUrl} size={40} />
                    {isThreadOpen && <div className="w-[1.5px] flex-1 bg-white/[0.12] mt-2" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Author Row */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="text-[14px] font-semibold text-[#F5F5F7] truncate">{post.displayName}</span>
                      {post.verified && <VerifiedIcon />}
                      <span className="text-xs text-[#71717A] font-mono-num">@{post.username}</span>
                      <span className="text-[#52525B]">·</span>
                      <span className="text-xs text-[#71717A]">{post.createdAt}</span>
                    </div>

                    {/* Text Body (Double-Click to Upvote!) */}
                    {post.content && (
                      <p
                        onDoubleClick={() => handleVote(post.id, 1, true)}
                        className="mt-1.5 text-[15px] text-[#F5F5F7] leading-[1.6] whitespace-pre-wrap select-text"
                      >
                        {post.content}
                      </p>
                    )}

                    {/* Media: Single-Tap opens Lightbox Viewer | Double-Tap triggers Upvote! */}
                    {post.mediaUrls.length > 0 && (
                      <div className="mt-3 rounded-2xl overflow-hidden border border-white/[0.08] bg-[#050507]">
                        {post.mediaUrls.length === 1 ? (
                          <img
                            src={post.mediaUrls[0]}
                            alt=""
                            onClick={() => handleMediaTap(post, 0)}
                            className="w-full max-h-[460px] object-cover block cursor-pointer"
                          />
                        ) : (
                          <Swiper modules={[Pagination]} pagination={{ clickable: true }} spaceBetween={0} slidesPerView={1}>
                            {post.mediaUrls.map((url, idx) => (
                              <SwiperSlide key={idx}>
                                <img
                                  src={url}
                                  alt=""
                                  onClick={() => handleMediaTap(post, idx)}
                                  className="w-full h-[380px] object-cover block cursor-pointer"
                                />
                              </SwiperSlide>
                            ))}
                          </Swiper>
                        )}
                      </div>
                    )}

                    {/* Poll */}
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
                        <div className="text-[11px] text-[#71717A] font-mono-num">{formatCount(totalPollVotes)} صوت</div>
                      </div>
                    )}

                    {/* Clean Action Bar */}
                    <div className="mt-3 flex items-center gap-6 text-[#71717A]">
                      {/* Upvote / Downvote */}
                      <div className="inline-flex items-center rounded-full bg-[#09090B] border border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => handleVote(post.id, 1)}
                          className={`px-2 py-1 rounded-s-full flex items-center cursor-pointer transition-colors ${
                            post.myVote === 1 ? 'text-white bg-white/[0.12]' : 'hover:text-white'
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

                      {/* Comments Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleThread(post.id)}
                        className={`flex items-center gap-1.5 text-xs hover:text-white transition-colors cursor-pointer ${
                          isThreadOpen ? 'text-white' : ''
                        }`}
                      >
                        <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                        <span className="font-mono-num">{formatCount(post.commentsCount)}</span>
                      </button>

                      {/* Repost */}
                      <button
                        type="button"
                        onClick={() => handleRepost(post.id)}
                        className="flex items-center gap-1.5 text-xs hover:text-white transition-colors cursor-pointer"
                      >
                        <Repeat2 className="w-4 h-4" strokeWidth={1.75} />
                        <span className="font-mono-num">{formatCount(post.sharesCount)}</span>
                      </button>
                    </div>

                    {/* Threaded Comments with Voice Replies + In-Thread @LM AI! */}
                    {isThreadOpen && (
                      <div className="mt-3.5 pt-3 border-t border-white/[0.08] space-y-3.5">
                        {rootComments.map(c => {
                          const replies = getReplies(c.id);
                          return (
                            <div key={c.id} className="space-y-2.5">
                              <div className="flex gap-2.5">
                                <UserAvatar initials={c.avatarInitials} avatarUrl={c.avatarUrl} size={28} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="font-semibold text-[#F5F5F7]">{c.displayName}</span>
                                    {c.verified && <VerifiedIcon />}
                                    <span className="text-[#71717A]">· {c.createdAt}</span>
                                  </div>

                                  {c.audioUrl ? (
                                    <div className="mt-1.5 p-2.5 rounded-2xl bg-[#0D0D10] border border-white/[0.08] max-w-[300px]">
                                      <SmartVoicePill url={c.audioUrl} transcript={c.transcript} compact />
                                    </div>
                                  ) : (
                                    <div className="text-[13.5px] text-[#E4E4E7] mt-0.5 leading-relaxed">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.content}</ReactMarkdown>
                                    </div>
                                  )}

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

                              {/* Nested Replies (Including @LM AI responses!) */}
                              {replies.length > 0 && (
                                <div className="ms-3.5 ps-3.5 border-s border-white/[0.12] space-y-2.5">
                                  {replies.map(rep => (
                                    <div key={rep.id} className="flex gap-2">
                                      <UserAvatar initials={rep.avatarInitials} avatarUrl={rep.avatarUrl} size={24} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 text-[11.5px]">
                                          <span className="font-semibold text-[#F5F5F7] flex items-center gap-1">
                                            {rep.isAi && <Sparkles className="w-3 h-3" />}
                                            {rep.displayName}
                                          </span>
                                          <span className="text-[#71717A]">· {rep.createdAt}</span>
                                        </div>
                                        {rep.audioUrl ? (
                                          <div className="mt-1 p-2 rounded-2xl bg-[#0D0D10] border border-white/[0.08] max-w-[280px]">
                                            <SmartVoicePill url={rep.audioUrl} transcript={rep.transcript} compact />
                                          </div>
                                        ) : (
                                          <div className="text-[13px] text-[#D4D4D8] mt-0.5 leading-relaxed">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{rep.content}</ReactMarkdown>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Comment Composer: Text + @LM AI Summon + Voice Reply */}
                        <div className="pt-1">
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

                          {recordingPostId === post.id ? (
                            <LiveVoiceRecorder
                              onCancel={() => setRecordingPostId(null)}
                              onSend={(file, sec) => submitVoiceComment(post.id, file, sec)}
                            />
                          ) : (
                            <form
                              onSubmit={e => submitComment(post.id, e)}
                              className="flex items-center gap-1.5 rounded-full bg-[#070709] border border-white/[0.1] ps-3.5 pe-1 py-1"
                            >
                              <input
                                value={replyDrafts[post.id] || ''}
                                onChange={e => setReplyDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder={aiMode ? '@LM AI اسأله عن المنشور أو أي شيء...' : 'أضف تعليقًا أو اكتب @LM AI...'}
                                className="flex-1 bg-transparent text-xs text-white placeholder:text-[#52525B] outline-none min-w-0"
                              />
                              <button
                                type="button"
                                onClick={() => setReplyAiModeByPost(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                                title="استدعاء LM AI في التعليقات"
                                className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                                  aiMode ? 'bg-white text-black' : 'text-[#71717A] hover:text-white'
                                }`}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRecordingPostId(post.id)}
                                title="رد صوتي"
                                className="w-7 h-7 rounded-full text-[#71717A] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                              >
                                <Mic className="w-3.5 h-3.5" />
                              </button>
                              <ChromeArrowButton
                                type="submit"
                                disabled={submittingCommentPost === post.id || !(replyDrafts[post.id] || '').trim()}
                                size={30}
                              />
                            </form>
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
      </div>

      {/* Full-Screen Interactive Lightbox Image Viewer (Single-Tap on Photo) */}
      {lightbox && (
        <div
          onClick={() => {
            setLightbox(null);
            setLightboxZoomed(false);
          }}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4"
        >
          {/* Top Floating Lightbox Controls */}
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
              <button
                type="button"
                onClick={() => {
                  setLightbox(null);
                  setLightboxZoomed(false);
                }}
                className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center Zoomable Photo + Carousel Arrows */}
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

      {/* Story Viewer */}
      {activeStory && (
        <div onClick={() => setActiveStory(null)} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
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
