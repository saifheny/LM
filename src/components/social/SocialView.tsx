import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowBigUp,
  ArrowBigDown,
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
} from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

import { Lang, PostCommentItem, PostPoll, SocialPost, StoryItem, UserProfile } from '../../types';
import { UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ChromeArrowButton, ObsidianComposerPill } from '../shared/HardwareUI';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { NavAiIcon } from '../shared/Icons2026Pro';
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

  // Comments + In-Composer Voice Replies + AI Summon
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostCommentItem[]>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyParentByPost, setReplyParentByPost] = useState<Record<string, { id: string; name: string } | null>>({});
  const [replyAiModeByPost, setReplyAiModeByPost] = useState<Record<string, boolean>>({});
  const [recordingPostId, setRecordingPostId] = useState<string | null>(null);
  const [submittingCommentPost, setSubmittingCommentPost] = useState<string | null>(null);
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const [doubleTapPostId, setDoubleTapPostId] = useState<string | null>(null);

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
    if (lastWsEvent?.event === 'social:new_post') loadFeed();
  }, [lastWsEvent, loadFeed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightbox(null);
        setLightboxZoomed(false);
        setActiveStory(null);
        setComposerExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = Math.max(0, 4 - uploadedMediaUrls.length);
    const slice = files.slice(0, remainingSlots);
    const urls: string[] = [];
    for (const f of slice) {
      const up = await apiUploadFile(f);
      urls.push(up.url);
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
    if (!draft.trim() && uploadedMediaUrls.length === 0) return;
    setPublishing(true);
    try {
      const validPoll =
        showPollBuilder && pollQuestion.trim() && pollOpts.filter(o => o.trim()).length >= 2
          ? { question: pollQuestion.trim(), options: pollOpts.filter(o => o.trim()) }
          : null;

      await apiPost('/api/posts', {
        userId: user.id,
        content: draft.trim() || pollQuestion.trim(),
        mediaUrls: uploadedMediaUrls,
        poll: validPoll,
      });
      setDraft('');
      setUploadedMediaUrls([]);
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

  async function handleVote(postId: string, direction: 1 | -1, forceUpvote = false) {
    const target = posts.find(p => p.id === postId);
    if (forceUpvote && target?.myVote === 1) return;

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

  function handleMediaTap(post: SocialPost, mediaIndex: number) {
    const now = Date.now();
    const prev = lastTapMsRef.current[post.id] || 0;
    lastTapMsRef.current[post.id] = now;

    if (now - prev < 260) {
      window.clearTimeout(tapTimersRef.current[post.id]);
      lastTapMsRef.current[post.id] = 0;
      handleVote(post.id, 1, true);
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
    const invokeAi = Boolean(replyAiModeByPost[postId]) || /^(\/ai|-ai|\/|@(lm\s*ai|ai))/i.test(text);

    setSubmittingCommentPost(postId);
    try {
      await apiPost(`/api/posts/${postId}/comments`, {
        userId: user.id,
        content: text.replace(/^(\/ai|-ai|\/)\s*/i, '').trim() || text,
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
      transcript: 'رسالة صوتية.',
    });
    setReplyParentByPost(prev => ({ ...prev, [postId]: null }));
    const res = await apiGet<{ ok: boolean; comments: PostCommentItem[] }>(`/api/posts/${postId}/comments`);
    setCommentsByPost(prev => ({ ...prev, [postId]: res.comments }));
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: res.comments.length } : p)));
  }

  const showExpandIcon = composerActive || draft.length > 0 || uploadedMediaUrls.length > 0;

  return (
    <div className="min-h-full w-full bg-[#0A0A0C] text-[#F2F2F5]">
      {/* Seamless Borderless Feed Column (ZERO Side Walls/Borders on Laptop!) */}
      <div className="max-w-[620px] mx-auto min-h-screen px-2 sm:px-0">
        {/* Stories Strip */}
        {stories.length > 0 && (
          <div className="px-4 py-4 border-b border-white/[0.07] flex items-center gap-4 overflow-x-auto no-scrollbar">
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

        {/* Hidden Multi-Image File Input (Up to 4 Photos!) */}
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />

        {/* Inline Post Composer with Expand-to-Full-Page Trigger */}
        <form onSubmit={submitPost} className="px-4 py-4 border-b border-white/[0.07] flex gap-3 relative">
          <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={38} />
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

            <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={uploadedMediaUrls.length >= 4}
                  onClick={() => fileRef.current?.click()}
                  title="إضافة صور (حتى 4)"
                  className="w-8 h-8 rounded-full hover:bg-white/[0.06] text-[#8E8E93] hover:text-white disabled:opacity-35 flex items-center justify-center cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" strokeWidth={1.8} />
                </button>
                {uploadedMediaUrls.length > 0 && (
                  <span className="text-[11px] font-mono-num text-[#7A7A85]">{uploadedMediaUrls.length}/4</span>
                )}
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

              <ChromeArrowButton
                type="submit"
                disabled={publishing || (!draft.trim() && uploadedMediaUrls.length === 0)}
                size={36}
              />
            </div>
          </div>
        </form>

        {/* Continuous Borderless Feed */}
        <div className="divide-y divide-white/[0.07]">
          {posts.map(post => {
            const isThreadOpen = Boolean(openThreads[post.id]);
            const postComments = commentsByPost[post.id] || [];
            const rootComments = postComments.filter(c => !c.parentId);
            const getReplies = (parentId: string) => postComments.filter(c => c.parentId === parentId);
            const totalPollVotes = post.poll ? post.poll.options.reduce((acc, o) => acc + o.votes, 0) : 0;
            const aiMode = Boolean(replyAiModeByPost[post.id]);
            const commentText = replyDrafts[post.id] || '';
            const hasCommentText = commentText.trim().length > 0;

            return (
              <article key={post.id} className="px-4 py-5">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <UserAvatar initials={post.avatarInitials} avatarUrl={post.avatarUrl} size={40} />
                    {isThreadOpen && <div className="w-[1.5px] flex-1 bg-white/[0.12] mt-2" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="text-[14px] font-semibold text-[#F2F2F5] truncate">{post.displayName}</span>
                      {post.verified && <VerifiedIcon />}
                      <span className="text-xs text-[#7A7A85] font-mono-num">@{post.username}</span>
                      <span className="text-[#585860]">·</span>
                      <span className="text-xs text-[#7A7A85]">{post.createdAt}</span>
                    </div>

                    {post.content && (
                      <p
                        onDoubleClick={() => handleVote(post.id, 1, true)}
                        className="mt-1.5 text-[15px] text-[#F2F2F5] leading-[1.6] whitespace-pre-wrap select-text"
                      >
                        {post.content}
                      </p>
                    )}

                    {/* Media: Single-Tap opens Lightbox | Double-Tap triggers Upvote + Pulse */}
                    {post.mediaUrls.length > 0 && (
                      <div className="relative mt-3 rounded-2xl overflow-hidden border border-white/[0.08] bg-[#121216]">
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
                        {doubleTapPostId === post.id && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
                            <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center animate-ping">
                              <ArrowBigUp className="w-9 h-9 text-white fill-white" />
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

                    {/* Action Row */}
                    <div className="mt-3 flex items-center justify-between text-[#7A7A85]">
                      <div className="flex items-center gap-5">
                        <div className="inline-flex items-center rounded-full bg-[#131318] border border-white/[0.08]">
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

                        <button
                          type="button"
                          onClick={() => handleRepost(post.id)}
                          className="flex items-center gap-1.5 text-xs hover:text-white transition-colors cursor-pointer"
                        >
                          <Repeat2 className="w-4 h-4" strokeWidth={1.75} />
                          <span className="font-mono-num">{formatCount(post.sharesCount)}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSavedPosts(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                          title="حفظ"
                          className={`w-7 h-7 rounded-full hover:bg-white/[0.06] flex items-center justify-center cursor-pointer transition-colors ${
                            savedPosts[post.id] ? 'text-[#FACC15]' : 'hover:text-white'
                          }`}
                        >
                          <Bookmark className={`w-4 h-4 ${savedPosts[post.id] ? 'fill-current' : ''}`} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(window.location.href)}
                          title="مشاركة"
                          className="w-7 h-7 rounded-full hover:bg-white/[0.06] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Share2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                        </button>
                      </div>
                    </div>

                    {/* Threaded Comments with In-Composer Voice Button (Exact Chat Morphing!) + AI Summon */}
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
                                    <span className="font-semibold text-[#F2F2F5]">{c.displayName}</span>
                                    {c.verified && <VerifiedIcon />}
                                    <span className="text-[#7A7A85]">· {c.createdAt}</span>
                                  </div>

                                  {c.audioUrl ? (
                                    <div className="mt-1.5 p-2.5 rounded-2xl bg-[#15151B] border border-white/[0.08] max-w-[300px]">
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
                                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#7A7A85] hover:text-white cursor-pointer"
                                  >
                                    <CornerDownLeft className="w-3 h-3" />
                                    <span>رد</span>
                                  </button>
                                </div>
                              </div>

                              {replies.length > 0 && (
                                <div className="ms-3.5 ps-3.5 border-s border-white/[0.12] space-y-2.5">
                                  {replies.map(rep => (
                                    <div key={rep.id} className="flex gap-2">
                                      <UserAvatar initials={rep.avatarInitials} avatarUrl={rep.avatarUrl} size={24} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 text-[11.5px]">
                                          <span className="font-semibold text-[#F2F2F5] flex items-center gap-1">
                                            {rep.isAi && <NavAiIcon active className="w-3 h-3" />}
                                            {rep.displayName}
                                          </span>
                                          <span className="text-[#7A7A85]">· {rep.createdAt}</span>
                                        </div>
                                        {rep.audioUrl ? (
                                          <div className="mt-1 p-2 rounded-2xl bg-[#15151B] border border-white/[0.08] max-w-[280px]">
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

                        {/* Unified Comment Composer: Exact Chat Behavior (Mic inside the action button when empty -> Chrome ↑ Send when typing!) */}
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
                            <ObsidianComposerPill
                              value={commentText}
                              onChange={v => setReplyDrafts(prev => ({ ...prev, [post.id]: v }))}
                              onSubmit={e => submitComment(post.id, e)}
                              placeholder={aiMode ? 'اسأل الذكاء الاصطناعي...' : 'أضف تعليقًا...'}
                              extraEnd={
                                <button
                                  type="button"
                                  onClick={() => setReplyAiModeByPost(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                                  title="استدعاء الذكاء الاصطناعي"
                                  className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                                    aiMode ? 'bg-white text-black' : 'text-[#7A7A85] hover:text-white'
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
      </div>

      {/* FULL-PAGE EXPANDED COMPOSER (Keeps Typed Text + Bottom 1-4 Photos Shelf!) */}
      {composerExpanded && (
        <form
          onSubmit={submitPost}
          className="fixed inset-0 z-50 bg-[#0A0A0C] flex flex-col justify-between"
        >
          {/* Top Bar */}
          <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between max-w-[780px] w-full mx-auto">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setComposerExpanded(false)}
                title="تصغير"
                className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#D4D4D8] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={32} />
                <span className="text-sm font-semibold text-white">{user.displayName}</span>
              </div>
            </div>

            <ChromeArrowButton
              type="submit"
              disabled={publishing || (!draft.trim() && uploadedMediaUrls.length === 0)}
              size={40}
              title="نشر"
            />
          </div>

          {/* Spacious Full-Height Writing Area */}
          <div className="flex-1 overflow-y-auto px-5 py-6 max-w-[780px] w-full mx-auto">
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={lang === 'ar' ? 'اكتب فكرتك بحرية...' : 'Write freely...'}
              className="w-full min-h-[260px] bg-transparent resize-none text-[18px] leading-[1.8] text-[#F2F2F5] placeholder:text-[#585860] outline-none"
            />

            {showPollBuilder && (
              <div className="mt-4 pt-4 border-t border-white/[0.08] space-y-2.5 max-w-[520px]">
                <input
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  placeholder="سؤال الاستطلاع..."
                  className="w-full h-10 rounded-xl bg-[#131318] border border-white/[0.1] px-3.5 text-sm text-white outline-none"
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
                    className="w-full h-9 rounded-xl bg-[#131318] border border-white/[0.08] px-3.5 text-xs text-white outline-none"
                  />
                ))}
                {pollOpts.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setPollOpts([...pollOpts, ''])}
                    className="text-xs text-[#8E8E93] hover:text-white cursor-pointer"
                  >
                    + خيار إضافي
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Attached Media Tray (Up to 4 Images + Add More + Poll Toggle) */}
          <div className="border-t border-white/[0.08] bg-[#0D0D11] px-5 py-4">
            <div className="max-w-[780px] mx-auto space-y-3">
              {uploadedMediaUrls.length > 0 && (
                <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
                  {uploadedMediaUrls.map((url, idx) => (
                    <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-white/[0.12] shrink-0">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeUploadedImg(idx)}
                        className="absolute top-1 end-1 w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {uploadedMediaUrls.length < 4 && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-24 h-24 rounded-2xl border border-dashed border-white/[0.18] hover:border-white/40 text-[#8E8E93] hover:text-white flex flex-col items-center justify-center gap-1 shrink-0 cursor-pointer transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[10.5px] font-mono-num">{uploadedMediaUrls.length}/4</span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadedMediaUrls.length >= 4}
                    onClick={() => fileRef.current?.click()}
                    className="px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-35 text-xs text-[#E4E4E7] flex items-center gap-2 cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>صور ({uploadedMediaUrls.length}/4)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPollBuilder(v => !v)}
                    className={`px-3.5 py-2 rounded-full text-xs flex items-center gap-2 cursor-pointer ${
                      showPollBuilder ? 'bg-white text-black font-semibold' : 'bg-white/[0.06] hover:bg-white/[0.12] text-[#E4E4E7]'
                    }`}
                  >
                    <BarChart2 className="w-4 h-4" />
                    <span>استطلاع</span>
                  </button>
                </div>

                <span className="text-[11px] font-mono-num text-[#7A7A85]">{draft.length} حرف</span>
              </div>
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
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4"
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
