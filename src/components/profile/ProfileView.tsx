import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark,
  Check,
  Globe,
  Grid,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  Pin,
  Play,
  QrCode,
  Repeat2,
  Share2,
  ShieldBan,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { Lang, ShortVideoItem, SocialPost, UserProfile } from '../../types';
import { RichMessageText, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import type { SharePayload } from '../shared/ShareSheetModal';
import { ProfileQrModal } from './ProfileQrModal';
import { ChromeArrowButton } from '../shared/HardwareUI';
import {
  CoverCanvasIcon,
  NavCommunityIcon,
  NavPulseIcon,
  PortraitStudioIcon,
  StylusEditIcon,
} from '../shared/Icons2026Pro';
import { ActionMenuOrb } from '../shared/ActionOrb2026';
import { CloseOrbButton, PublishActionButton } from '../shared/ModalChrome2026';
import { FacebookReactionButton } from '../shared/TelegramReactions';
import { MediaCollageGrid } from '../shared/MediaCollageGrid';
import { SmartVoicePill } from '../shared/VoiceStudio2026';
import { api, apiGet, apiPost, apiUploadFile } from '../../lib/api';
import { t } from '../../lib/i18n';

interface ProfileViewProps {
  profileUserId: string;
  currentUser: UserProfile;
  lang: Lang;
  onProfileUpdated: (u: UserProfile) => void;
  onMessageUser: (targetUserId: string) => void;
  onOpenProfile: (uid: string) => void;
  onOpenProfileByUsername?: (username: string) => void;
  onOpenHashtag?: (tag: string) => void;
  onShare?: (payload: SharePayload) => void;
  onOpenPostComments?: (postId: string) => void;
  onOpenVideo?: (videoId: string) => void;
  onOpenVideos: () => void;
}

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ProfileView({
  profileUserId,
  currentUser,
  lang,
  onProfileUpdated,
  onMessageUser,
  onOpenProfile,
  onOpenProfileByUsername,
  onOpenHashtag,
  onShare,
  onOpenPostComments,
  onOpenVideo,
  onOpenVideos,
}: ProfileViewProps) {
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [isBlockedFromViewing, setIsBlockedFromViewing] = useState(false);
  const [hasActiveStory, setHasActiveStory] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [videos, setVideos] = useState<ShortVideoItem[]>([]);
  const [savedPosts, setSavedPosts] = useState<SocialPost[]>([]);
  const [savedVideos, setSavedVideos] = useState<ShortVideoItem[]>([]);
  const [likedPosts, setLikedPosts] = useState<SocialPost[]>([]);
  const [savedFilter, setSavedFilter] = useState<'all' | 'posts' | 'videos'>('all');
  const [followersList, setFollowersList] = useState<UserProfile[]>([]);
  const [followingList, setFollowingList] = useState<UserProfile[]>([]);
  const [tab, setTab] = useState<'posts' | 'videos' | 'media' | 'likes' | 'saved'>('posts');
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [stickyHeaderVisible, setStickyHeaderVisible] = useState(false);
  const coverSentinelRef = useRef<HTMLDivElement | null>(null);

  // Interactive Followers / Following Directory Sheet
  const [peopleSheet, setPeopleSheet] = useState<'followers' | 'following' | null>(null);

  // 2026 Profile Studio Editor Modal
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [editCover, setEditCover] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<'avatar' | 'cover' | null>(null);
  const [profileUploadError, setProfileUploadError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Inline Edit Own Post
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState('');

  // Edit Own Pulse Video Modal
  const [editingVideo, setEditingVideo] = useState<ShortVideoItem | null>(null);
  const [editVidTitle, setEditVidTitle] = useState('');
  const [editVidDesc, setEditVidDesc] = useState('');
  const [editVidTags, setEditVidTags] = useState('');
  const [savingVideo, setSavingVideo] = useState(false);

  const isMe = profileUserId === currentUser.id;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setIsBlockedFromViewing(false);
    try {
      const res = await apiGet<{
        ok: boolean;
        blocked?: boolean;
        user: UserProfile;
        isFollowing: boolean;
        blockedByMe?: boolean;
        hasActiveStory?: boolean;
        posts: SocialPost[];
        videos: ShortVideoItem[];
        savedPosts?: SocialPost[];
        savedVideos?: ShortVideoItem[];
        likedPosts?: SocialPost[];
        followersList?: UserProfile[];
        followingList?: UserProfile[];
      }>(`/api/users/${profileUserId}/profile?viewerId=${currentUser.id}`);
      setProfileUser(res.user);
      setIsFollowing(res.isFollowing);
      setBlockedByMe(Boolean(res.blockedByMe));
      setHasActiveStory(Boolean(res.hasActiveStory));
      setPosts(res.posts);
      setVideos(res.videos);
      setSavedPosts(res.savedPosts || []);
      setSavedVideos(res.savedVideos || []);
      setLikedPosts(res.likedPosts || []);
      setFollowersList(res.followersList || []);
      setFollowingList(res.followingList || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('غير متاح') || msg.includes('403')) {
        setIsBlockedFromViewing(true);
        setProfileUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [profileUserId, currentUser.id]);

  async function toggleBlockUser() {
    if (!profileUser || isMe) return;
    if (blockedByMe) {
      await api(`/api/users/${profileUser.id}/block?blockerId=${encodeURIComponent(currentUser.id)}`, { method: 'DELETE' });
      setBlockedByMe(false);
    } else {
      await apiPost(`/api/users/${profileUser.id}/block`, { blockerId: currentUser.id });
      setBlockedByMe(true);
      setIsFollowing(false);
    }
  }

  useEffect(() => {
    setPeopleSheet(null);
    setTab('posts');
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const el = coverSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      entries => {
        setStickyHeaderVisible(!entries[0]?.isIntersecting);
      },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [profileUser?.id]);

  async function togglePinPost(postId: string) {
    if (!isMe || !profileUser) return;
    try {
      const res = await apiPost<{ ok: boolean; pinnedPostId: string | null; user: UserProfile }>(
        `/api/users/${currentUser.id}/pin-post`,
        { postId }
      );
      if (res.user) {
        setProfileUser(res.user);
        onProfileUpdated(res.user);
      }
      await loadProfile();
    } catch {
      // ignore
    }
  }

  function openEditStudio() {
    if (!profileUser) return;
    setEditName(profileUser.displayName);
    setEditBio(profileUser.bio || '');
    setEditLocation(profileUser.location || '');
    setEditWebsite(profileUser.website || '');
    setEditAvatar(profileUser.avatarUrl);
    setEditCover(profileUser.coverUrl || null);
    setEditOpen(true);
  }

  async function handleProfilePostReact(postId: string, reactionId: string) {
    // 0ms optimistic live reaction/like update inside Profile!
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const curRx = { ...(p.reactions || {}) };
        const prevMine = p.myReaction || null;
        let nextMine: string | null = reactionId;
        let delta = 0;
        if (prevMine === reactionId) {
          if (curRx[reactionId]) curRx[reactionId] = Math.max(0, curRx[reactionId] - 1);
          nextMine = null;
          delta = -1;
        } else {
          if (prevMine && curRx[prevMine]) curRx[prevMine] = Math.max(0, curRx[prevMine] - 1);
          else delta = 1;
          curRx[reactionId] = (curRx[reactionId] || 0) + 1;
        }
        return {
          ...p,
          reactions: curRx,
          myReaction: nextMine,
          score: Math.max(0, (p.score || 0) + delta),
          likesCount: Math.max(0, (p.likesCount || 0) + delta),
          likedByMe: Boolean(nextMine),
        };
      })
    );
    try {
      const res = await apiPost<{
        ok: boolean;
        score: number;
        reactions: Record<string, number>;
        myReaction: string | null;
      }>(`/api/posts/${postId}/react`, {
        userId: currentUser.id,
        reaction: reactionId,
      });
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? {
                ...p,
                score: res.score,
                likesCount: res.score,
                reactions: res.reactions,
                myReaction: res.myReaction,
                likedByMe: Boolean(res.myReaction),
              }
            : p
        )
      );
    } catch {
      loadProfile();
    }
  }

  async function handleImageUpload(kind: 'avatar' | 'cover', e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingKind(kind);
    setProfileUploadError(null);
    try {
      const up = await apiUploadFile(f, kind === 'avatar' ? 'avatar' : 'cover');
      if (kind === 'avatar') setEditAvatar(up.url);
      else setEditCover(up.url);
    } catch (err) {
      setProfileUploadError(err instanceof Error ? err.message : 'تعذر رفع الصورة.');
    } finally {
      setUploadingKind(null);
      e.target.value = '';
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileUser || !editName.trim() || savingProfile) return;
    setSavingProfile(true);
    try {
      const res = await api<{ ok: boolean; user: UserProfile }>(`/api/users/${profileUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: editName.trim(),
          bio: editBio.trim(),
          location: editLocation.trim(),
          website: editWebsite.trim(),
          avatarUrl: editAvatar,
          coverUrl: editCover,
        }),
      });
      setProfileUser(res.user);
      onProfileUpdated(res.user);
      setEditOpen(false);
      await loadProfile();
    } finally {
      setSavingProfile(false);
    }
  }

  async function toggleFollow() {
    if (!profileUser || isMe) return;
    const prevFollow = isFollowing;
    setIsFollowing(!prevFollow);
    setProfileUser(prev =>
      prev
        ? { ...prev, followersCount: Math.max(0, prev.followersCount + (prevFollow ? -1 : 1)) }
        : prev
    );
    try {
      const res = await apiPost<{ ok: boolean; following: boolean; followersCount: number }>(
        `/api/users/${profileUser.id}/follow`,
        { followerId: currentUser.id }
      );
      setIsFollowing(res.following);
      setProfileUser(prev => (prev ? { ...prev, followersCount: res.followersCount } : prev));
      loadProfile();
    } catch {
      setIsFollowing(prevFollow);
    }
  }

  async function saveEditedPost(postId: string) {
    if (!editingPostText.trim()) return;
    await api(`/api/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify({ userId: currentUser.id, content: editingPostText.trim() }),
    });
    setEditingPostId(null);
    setEditingPostText('');
    await loadProfile();
  }

  async function deletePost(postId: string) {
    await api(`/api/posts/${postId}?userId=${currentUser.id}`, { method: 'DELETE' });
    setPosts(prev => prev.filter(p => p.id !== postId));
  }

  async function undoRepost(postId: string) {
    await apiPost(`/api/posts/${postId}/repost`, { userId: currentUser.id });
    setPosts(prev => prev.filter(p => !(p.id === postId && p.repostedBy?.userId === currentUser.id)));
  }

  async function unsavePost(postId: string) {
    await apiPost(`/api/posts/${postId}/save`, { userId: currentUser.id });
    setSavedPosts(prev => prev.filter(p => p.id !== postId));
  }

  function openVideoEditor(v: ShortVideoItem) {
    setEditingVideo(v);
    setEditVidTitle(v.title);
    setEditVidDesc(v.description || '');
    setEditVidTags(v.tags || '');
  }

  async function saveEditedVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!editingVideo || !editVidTitle.trim() || savingVideo) return;
    setSavingVideo(true);
    try {
      await api(`/api/videos/${editingVideo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          userId: currentUser.id,
          title: editVidTitle.trim(),
          description: editVidDesc.trim(),
          tags: editVidTags.trim(),
        }),
      });
      setEditingVideo(null);
      await loadProfile();
    } finally {
      setSavingVideo(false);
    }
  }

  async function deleteVideo(videoId: string) {
    await api(`/api/videos/${videoId}?userId=${currentUser.id}`, { method: 'DELETE' });
    setVideos(prev => prev.filter(v => v.id !== videoId));
  }

  if (loading && !profileUser) {
    return (
      <div className="min-h-full w-full bg-[#121212] text-[#F2F2F5]">
        <div className="max-w-[720px] mx-auto pb-28 animate-pulse">
          <div className="h-44 sm:h-56 w-full bg-white/[0.05]" />
          <div className="px-4 sm:px-6 -mt-12 space-y-5">
            <div className="flex items-end justify-between">
              <div className="w-24 h-24 rounded-full bg-[#1E1F28] border-4 border-[#121212]" />
              <div className="flex gap-2">
                <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
                <div className="w-28 h-10 rounded-xl bg-white/[0.06]" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-6 w-44 rounded-lg bg-white/[0.08]" />
              <div className="h-3.5 w-64 rounded-lg bg-white/[0.05]" />
            </div>
            <div className="flex gap-8">
              <div className="h-5 w-16 rounded-lg bg-white/[0.06]" />
              <div className="h-5 w-16 rounded-lg bg-white/[0.06]" />
              <div className="h-5 w-16 rounded-lg bg-white/[0.06]" />
            </div>
            <div className="space-y-4 pt-4">
              <div className="h-28 rounded-2xl bg-white/[0.04]" />
              <div className="h-44 rounded-2xl bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isBlockedFromViewing) {
    return (
      <div className="min-h-full w-full bg-[#121212] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-[#1E1F28] flex items-center justify-center text-[#FF595A]">
          <ShieldBan className="w-6 h-6" />
        </div>
        <div className="text-base font-bold text-white">هذا الملف الشخصي غير متاح</div>
        <p className="text-xs text-[#8E8E93] max-w-xs leading-relaxed">
          قام صاحب هذا الحساب بتقييد الوصول إلى ملفه الشخصي وبثوثه المباشرة.
        </p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-full w-full bg-[#121212] flex items-center justify-center text-xs text-[#7A7A85]">
        لم يتم العثور على هذا الحساب.
      </div>
    );
  }

  const websiteHref = profileUser.website
    ? /^https?:\/\//i.test(profileUser.website)
      ? profileUser.website
      : `https://${profileUser.website}`
    : '';

  return (
    <div className="min-h-full w-full bg-[#121212] text-[#F2F2F5] relative">
      {/* Sticky Scroll-Reveal Compact Profile Header (Appears smoothly once scrolled past Cover!) */}
      {stickyHeaderVisible && (
        <div
          style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
          className="sticky top-0 z-30 bg-[#121212]/88 backdrop-blur-xl px-4 sm:px-6 pb-2.5"
        >
          <div className="max-w-[720px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar initials={profileUser.avatarInitials} avatarUrl={profileUser.avatarUrl} size={32} />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white flex items-center gap-1 truncate">
                  <span className="truncate">{profileUser.displayName}</span>
                  {profileUser.verified && <VerifiedIcon />}
                </div>
              </div>
            </div>
            {isMe ? (
              <button
                type="button"
                onClick={openEditStudio}
                className="h-8 px-3.5 rounded-full bg-white/[0.09] hover:bg-white/[0.15] text-xs font-semibold text-white cursor-pointer shrink-0"
              >
                {lang === 'ar' ? 'تعديل' : 'Edit'}
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleFollow}
                className={`h-8 px-4 rounded-full text-xs font-bold cursor-pointer shrink-0 ${
                  isFollowing ? 'bg-white/[0.1] text-white' : 'bg-[#FE2C55] text-white'
                }`}
              >
                {isFollowing ? (lang === 'ar' ? 'متابَع' : 'Following') : lang === 'ar' ? 'متابعة' : 'Follow'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-[720px] mx-auto pb-28">
        {/* 2026 BORDERLESS FULL-BLEED COVER (ZERO Outer Container Box!) */}
        <div ref={coverSentinelRef} className="relative h-44 sm:h-56 w-full overflow-hidden bg-[#0E0E12]">
          {profileUser.coverUrl ? (
            <img
              src={profileUser.coverUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              style={{
                background:
                  'linear-gradient(135deg, #161210 0%, #1E1415 50%, #0E1514 100%)',
              }}
              className="w-full h-full"
            />
          )}
          {/* Seamless Melt into TikTok Matte Canvas */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/45 to-black/15" />

          {isMe && (
            <button
              type="button"
              onClick={openEditStudio}
              className="absolute top-4 end-4 h-10 px-4 rounded-full bg-black/55 hover:bg-black/75 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer transition-colors"
            >
              <CoverCanvasIcon className="w-4 h-4" />
              <span>تخصيص الغلاف</span>
            </button>
          )}
        </div>

        {/* FLOATING BORDERLESS IDENTITY STAGE (Directly on Open Matte Canvas — ZERO Containers!) */}
        <div className="px-4 sm:px-6 -mt-12 relative z-10 space-y-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="relative">
              <div
                className={`p-[2.5px] rounded-full ${
                  hasActiveStory
                    ? 'bg-gradient-to-tr from-[#FE2C55] to-[#25F4EE]'
                    : 'border-2 border-white/[0.18]'
                }`}
              >
                <div className="p-[2.5px] rounded-full bg-[#121212]">
                  <UserAvatar
                    initials={profileUser.avatarInitials}
                    avatarUrl={profileUser.avatarUrl}
                    size={92}
                  />
                </div>
              </div>

              {/* 2026 Sculpted Portrait Studio Trigger */}
              {isMe && (
                <button
                  type="button"
                  onClick={openEditStudio}
                  title="تحديث صورة الحساب"
                  className="absolute -bottom-1 -end-1 w-9 h-9 rounded-full bg-[#1E1F28] hover:bg-[#272936] border-2 border-[#121212] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <PortraitStudioIcon className="w-[18px] h-[18px]" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pb-1">
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                title={lang === 'ar' ? 'بطاقة QR للحساب' : 'Profile QR'}
                className="w-10 h-10 rounded-full bg-[#1E1F28] hover:bg-[#272936] text-[#25F4EE] flex items-center justify-center cursor-pointer transition-colors"
              >
                <QrCode className="w-5 h-5" strokeWidth={1.9} />
              </button>
              {onShare && (
                <button
                  type="button"
                  onClick={() => {
                    const usableAvatar =
                      profileUser.avatarUrl && !profileUser.avatarUrl.startsWith('lm:')
                        ? profileUser.avatarUrl
                        : null;
                    const usableCover =
                      profileUser.coverUrl && !profileUser.coverUrl.startsWith('lm:')
                        ? profileUser.coverUrl
                        : null;
                    onShare({
                      kind: 'profile',
                      targetId: profileUser.id,
                      title: profileUser.displayName,
                      subtitle: profileUser.location || 'ملف شخصي على منصة LM',
                      snippet: profileUser.bio || profileUser.location || 'ملف شخصي على منصة LM',
                      imageUrl: usableAvatar || usableCover || null,
                      avatarUrl: usableAvatar,
                      avatarInitials: profileUser.avatarInitials,
                      path: `/u/${profileUser.username}`,
                    });
                  }}
                  title="مشاركة الملف الشخصي"
                  className="w-10 h-10 rounded-full bg-[#1E1F28] hover:bg-[#272936] text-[#F1F1F2] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Share2 className="w-5 h-5" strokeWidth={2} />
                </button>
              )}
              {isMe ? (
                <button
                  type="button"
                  onClick={openEditStudio}
                  className="h-10 px-4 rounded-xl bg-[#1E1F28] hover:bg-[#272936] text-xs font-semibold text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <StylusEditIcon className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تعديل الملف' : 'Edit Profile'}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleFollow}
                    className={`h-10 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95 ${
                      isFollowing
                        ? 'bg-[#1E1F28] hover:bg-[#272936] text-white'
                        : 'bg-[#FE2C55] hover:bg-[#EA284E] text-white'
                    }`}
                  >
                    {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span>{isFollowing ? (lang === 'ar' ? 'متابَع' : 'Following') : lang === 'ar' ? 'متابعة' : 'Follow'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onMessageUser(profileUser.id)}
                    className="h-10 px-4 rounded-xl bg-[#1E1F28] hover:bg-[#272936] text-xs font-semibold text-[#25F4EE] flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'مراسلة' : 'Message'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleBlockUser}
                    title={blockedByMe ? 'إلغاء الحظر' : 'حظر هذا المستخدم'}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                      blockedByMe
                        ? 'bg-[#FF595A]/20 text-[#FF595A] hover:bg-[#FF595A]/30'
                        : 'bg-[#1E1F28] hover:bg-[#FF595A]/15 text-[#A1A1AA] hover:text-[#FF595A]'
                    }`}
                  >
                    <ShieldBan className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Name + Handle + Bio + Location + Website */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{profileUser.displayName}</h1>
              {profileUser.verified && <VerifiedIcon />}
              {profileUser.isPrivate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.08] text-[10.5px] text-[#C4C4CC]">
                  <Lock className="w-3 h-3" />
                  <span>{lang === 'ar' ? 'حساب خاص' : 'Private'}</span>
                </span>
              )}
              
            </div>

            {profileUser.bio && (
              <div className="text-[14px] text-[#E4E4E7] leading-relaxed whitespace-pre-wrap">
                <RichMessageText
                  text={profileUser.bio}
                  maxChars={200}
                  lang={lang}
                  onMentionClick={onOpenProfileByUsername}
                  onHashtagClick={onOpenHashtag}
                />
              </div>
            )}

            {(profileUser.location || profileUser.website) && (
              <div className="flex items-center gap-4 flex-wrap pt-0.5 text-xs text-[#9E9EA8]">
                {profileUser.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FBBF24]" />
                    <span>{profileUser.location}</span>
                  </span>
                )}
                {profileUser.website && (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="inline-flex items-center gap-1.5 lm-link-shine text-xs"
                  >
                    <Globe className="w-3.5 h-3.5 text-[#34D399]" />
                    <span>{profileUser.website.replace(/^https?:\/\//i, '')}</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* OPEN FLOATING EDITORIAL METRICS (ZERO Boxed Stat Cards!) */}
          <div className="flex items-center gap-6 sm:gap-9 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24] self-center" />
              <span className="text-lg font-mono-num font-bold text-white">{posts.length + videos.length}</span>
              <span className="text-xs text-[#8E8E93]">{lang === 'ar' ? 'محتوى' : 'Posts'}</span>
            </div>

            <span className="w-px h-5 bg-white/[0.09]" />

            <button
              type="button"
              onClick={() => setPeopleSheet('followers')}
              className="flex items-baseline gap-2 group cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] self-center" />
              <span className="text-lg font-mono-num font-bold text-white group-hover:text-[#6EE7B7] transition-colors">
                {compactNum(profileUser.followersCount)}
              </span>
              <span className="text-xs text-[#8E8E93] group-hover:text-white transition-colors">
                {lang === 'ar' ? 'متابِع' : 'Followers'}
              </span>
            </button>

            <span className="w-px h-5 bg-white/[0.09]" />

            <button
              type="button"
              onClick={() => setPeopleSheet('following')}
              className="flex items-baseline gap-2 group cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#FB7185] self-center" />
              <span className="text-lg font-mono-num font-bold text-white group-hover:text-[#FDA4AF] transition-colors">
                {compactNum(profileUser.followingCount)}
              </span>
              <span className="text-xs text-[#8E8E93] group-hover:text-white transition-colors">
                {lang === 'ar' ? 'يتابع' : 'Following'}
              </span>
            </button>
          </div>

          {/* BORDERLESS FLOATING UNDERLINE TABS */}
          <div className="pt-2 border-b border-white/[0.08] flex items-center gap-7 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setTab('posts')}
              className={`pb-3 text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors relative shrink-0 ${
                tab === 'posts' ? 'text-white' : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              <NavCommunityIcon active={tab === 'posts'} className="w-5 h-5" />
              <span>{lang === 'ar' ? `المنشورات (${posts.length})` : `Posts (${posts.length})`}</span>
              {tab === 'posts' && (
                <span className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-full bg-[#FE2C55]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setTab('videos')}
              className={`pb-3 text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors relative shrink-0 ${
                tab === 'videos' ? 'text-white' : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              <NavPulseIcon active={tab === 'videos'} className="w-5 h-5" />
              <span>{lang === 'ar' ? `نبض (${videos.length})` : `Pulse (${videos.length})`}</span>
              {tab === 'videos' && (
                <span className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-full bg-[#25F4EE]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setTab('media')}
              className={`pb-3 text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors relative shrink-0 ${
                tab === 'media' ? 'text-white' : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              <Grid className={`w-4 h-4 ${tab === 'media' ? 'text-[#FBBF24]' : ''}`} />
              <span>{lang === 'ar' ? 'الوسائط' : 'Media'}</span>
              {tab === 'media' && (
                <span className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-full bg-[#FBBF24]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setTab('likes')}
              className={`pb-3 text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors relative shrink-0 ${
                tab === 'likes' ? 'text-white' : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${tab === 'likes' ? 'text-[#FE2C55] fill-current' : ''}`} />
              <span>{lang === 'ar' ? `الإعجابات (${likedPosts.length})` : `Likes (${likedPosts.length})`}</span>
              {tab === 'likes' && (
                <span className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-full bg-[#FE2C55]" />
              )}
            </button>

            {isMe && (
              <button
                type="button"
                onClick={() => setTab('saved')}
                className={`pb-3 text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors relative shrink-0 ${
                  tab === 'saved' ? 'text-white' : 'text-[#8E8E93] hover:text-white'
                }`}
              >
                <Bookmark className={`w-5 h-5 ${tab === 'saved' ? 'text-[#FE2C55] fill-current' : ''}`} />
                <span>
                  {lang === 'ar'
                    ? `المحفوظات (${savedPosts.length + savedVideos.length})`
                    : `Saved (${savedPosts.length + savedVideos.length})`}
                </span>
                {tab === 'saved' && (
                  <span className="absolute bottom-0 inset-x-0 h-[2px] rounded-full bg-gradient-to-r from-[#34D399] to-[#10B981]" />
                )}
              </button>
            )}
          </div>

        {/* Content Area — Completely Open Borderless Feed (ZERO Card Boxes!) */}
        {tab === 'posts' ? (
          <div className="mt-3 divide-y divide-white/[0.08]">
            {posts.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#8E8E93]">
                {lang === 'en' ? 'No posts yet' : 'لا توجد منشورات بعد'}
              </div>
            ) : (
              posts.map(post => {
                const isRepostItem = Boolean(post.repostedBy);
                const isOwnOriginal = post.userId === currentUser.id;
                const isPinnedPost = Boolean(profileUser.pinnedPostId && profileUser.pinnedPostId === post.id && !isRepostItem);
                return (
                <article
                  key={`${post.id}_${isRepostItem ? 'rp' : 'orig'}`}
                  className="py-5 space-y-3"
                >
                  {/* Pinned Post Attribution */}
                  {isPinnedPost && (
                    <div className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#25F4EE]">
                      <Pin className="w-3.5 h-3.5" />
                      <span>{lang === 'en' ? 'Pinned Post' : 'منشور مثبّت'}</span>
                    </div>
                  )}

                  {/* X-Style Repost Header */}
                  {isRepostItem && post.repostedBy && (
                    <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-[#8E8E93]">
                      <div className="inline-flex items-center gap-1.5">
                        <Repeat2 className="w-3.5 h-3.5 text-[#34D399]" />
                        <span>
                          {post.repostedBy.userId === currentUser.id
                            ? lang === 'en'
                              ? 'You reposted'
                              : 'أعدت النشر'
                            : lang === 'en'
                              ? `${post.repostedBy.displayName} reposted`
                              : `أعاد ${post.repostedBy.displayName} النشر`}
                        </span>
                      </div>
                      {isMe && post.repostedBy.userId === currentUser.id && (
                        <button
                          type="button"
                          onClick={() => undoRepost(post.id)}
                          className="text-[11px] text-[#8E8E93] hover:text-[#FB7185] cursor-pointer transition-colors"
                        >
                          {lang === 'en' ? 'Undo repost' : 'إلغاء إعادة النشر'}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(post.userId)}
                      className="flex items-center gap-2 text-xs text-[#7A7A85] cursor-pointer group"
                    >
                      {post.userId !== profileUser.id && (
                        <UserAvatar initials={post.avatarInitials} avatarUrl={post.avatarUrl} size={24} />
                      )}
                      <span className="font-semibold text-white group-hover:underline">{post.displayName}</span>
                      {post.verified && <VerifiedIcon />}
                      <span>· {post.createdAt}</span>
                      {post.isEdited && (
                        <span className="text-[10.5px] text-[#FBBF24]/80">
                          {lang === 'en' ? '(edited)' : '(معدّل)'}
                        </span>
                      )}
                    </button>

                    {isMe && isOwnOriginal && !isRepostItem && (
                      <ActionMenuOrb
                        editLabel={lang === 'en' ? 'Edit post' : 'تعديل المنشور'}
                        removeLabel={lang === 'en' ? 'Delete post' : 'حذف المنشور'}
                        extraItems={[
                          {
                            id: 'pin_post',
                            label: isPinnedPost
                              ? lang === 'en'
                                ? 'Unpin from profile'
                                : 'إلغاء التثبيت'
                              : lang === 'en'
                                ? 'Pin to top of profile'
                                : 'تثبيت في أعلى الملف',
                            icon: <Pin className="w-4 h-4 text-[#25F4EE]" />,
                            onClick: () => togglePinPost(post.id),
                          },
                        ]}
                        onEdit={() => {
                          setEditingPostId(post.id);
                          setEditingPostText(post.content);
                        }}
                        onRemove={() => deletePost(post.id)}
                      />
                    )}
                  </div>

                  {editingPostId === post.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={editingPostText}
                        onChange={e => setEditingPostText(e.target.value)}
                        className="w-full rounded-2xl bg-[#131318] border border-white/[0.14] p-3 text-sm text-white outline-none resize-none"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingPostId(null)}
                          className="px-3 py-1.5 rounded-full bg-white/[0.07] text-xs text-[#A1A1AA] hover:text-white cursor-pointer"
                        >
                          {t(lang, 'cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditedPost(post.id)}
                          className="px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{t(lang, 'save')}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    post.content && (
                      <div className="text-[14.5px] text-[#F2F2F5] leading-relaxed">
                        <RichMessageText
                          text={post.content}
                          maxChars={240}
                          lang={lang}
                          onMentionClick={onOpenProfileByUsername}
                          onHashtagClick={onOpenHashtag}
                        />
                      </div>
                    )
                  )}

                  {post.musicUrl && post.mediaUrls.length === 0 && (
                    <div className="mt-2 p-3 rounded-2xl bg-[#181920]">
                      <SmartVoicePill
                        url={post.musicUrl}
                        title={post.musicTitle || (lang === 'en' ? 'Attached Audio' : 'مقطع صوتي')}
                      />
                    </div>
                  )}

                  {post.mediaUrls.length > 0 && (
                    <div className="rounded-[16px] overflow-hidden border border-[#94B3D6]/[0.12]">
                      <MediaCollageGrid
                        urls={post.mediaUrls}
                        onSelect={() => onOpenPostComments?.(post.id)}
                      />
                    </div>
                  )}

                  {/* Embedded Quoted Post Card */}
                  {post.quotedPost && (
                    <div
                      onClick={() => onOpenProfile(post.quotedPost!.userId)}
                      className="mt-2 rounded-2xl bg-[#101925] border border-[#94B3D6]/[0.12] hover:border-[#94B3D6]/[0.24] p-3 space-y-2 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <UserAvatar
                          initials={post.quotedPost.avatarInitials}
                          avatarUrl={post.quotedPost.avatarUrl}
                          size={22}
                        />
                        <span className="font-semibold text-white truncate">{post.quotedPost.displayName}</span>
                        {post.quotedPost.verified && <VerifiedIcon />}
                        
                        <span className="text-[#697C93]">·</span>
                        <span className="text-[10.5px] text-[#8DA2BC]">{post.quotedPost.createdAt}</span>
                      </div>
                      {post.quotedPost.content && (
                        <p className="text-xs text-[#D7E3F0] leading-relaxed line-clamp-3">
                          {post.quotedPost.content}
                        </p>
                      )}
                      {post.quotedPost.mediaUrl && (
                        <img
                          src={post.quotedPost.mediaUrl}
                          alt=""
                          className="w-full max-h-[200px] rounded-xl object-cover border border-white/[0.08]"
                        />
                      )}
                    </div>
                  )}

                  {/* Live Profile Post Engagement Bar — Open Borderless, Enlarged Crisp Icons! */}
                  <div className="pt-1 flex items-center justify-between gap-3 text-[#A6A7B2]">
                    <div className="flex items-center gap-5 sm:gap-6 flex-wrap">
                      <FacebookReactionButton
                        reactions={post.reactions}
                        myReaction={post.myReaction}
                        totalCount={post.score || post.likesCount || 0}
                        onReact={rxId => handleProfilePostReact(post.id, rxId)}
                        lang={lang}
                      />

                      <button
                        type="button"
                        onClick={() => onOpenPostComments?.(post.id)}
                        className="flex items-center gap-2 text-[13px] font-medium text-[#A6A7B2] hover:text-white transition-colors cursor-pointer py-1"
                      >
                        <MessageCircle className="w-5 h-5" strokeWidth={1.85} />
                        <span className="font-mono-num">{compactNum(post.commentsCount || 0)}</span>
                      </button>

                      <span className="flex items-center gap-1.5 text-[13px] text-[#A6A7B2]">
                        <Repeat2 className="w-5 h-5" strokeWidth={1.8} />
                        <span className="font-mono-num">{compactNum(post.sharesCount || 0)}</span>
                      </span>
                    </div>

                    {onShare && (
                      <button
                        type="button"
                        onClick={() => {
                          const rawTxt = (post.content || '').replace(/\s+/g, ' ').trim();
                          const headline = rawTxt
                            ? rawTxt.length > 64
                              ? `${rawTxt.slice(0, 61)}...`
                              : rawTxt
                            : post.musicTitle
                              ? `مقطع صوتي: ${post.musicTitle}`
                              : `منشور بقلم ${post.displayName}`;
                          const firstPhoto =
                            post.mediaUrls.find(u => !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)) || null;
                          onShare({
                            kind: 'post',
                            targetId: post.id,
                            title: headline,
                            subtitle: post.displayName,
                            snippet: `${rawTxt || 'منشور مشارَك على منصة LM'}\n👍 ${post.score} · 💬 ${post.commentsCount}`,
                            imageUrl: firstPhoto,
                            avatarUrl: post.avatarUrl,
                            avatarInitials: post.avatarInitials,
                            path: `/post/${post.id}`,
                          });
                        }}
                        title={lang === 'en' ? 'Share' : 'مشاركة'}
                        className="w-9 h-9 rounded-full text-[#A6A7B2] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Share2 className="w-5 h-5" strokeWidth={1.85} />
                      </button>
                    )}
                  </div>
                </article>
                );
              })
            )}
          </div>
        ) : tab === 'videos' ? (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {videos.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-[#7A7A85]">لا توجد فيديوهات نبض بعد</div>
            ) : (
              videos.map(v => (
                <div
                  key={v.id}
                  onClick={() => (onOpenVideo ? onOpenVideo(v.id) : onOpenVideos())}
                  className="group relative aspect-[9/14] rounded-2xl overflow-hidden bg-[#121217] border border-white/[0.09] text-start cursor-pointer"
                >
                  {v.posterUrl ? (
                    <img
                      src={v.posterUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <video src={v.videoUrl || ''} muted className="w-full h-full object-cover" />
                  )}

                  {/* Edit / Remove Floating Orb on Own Pulse Videos */}
                  {isMe && (
                    <div className="absolute top-2 end-2 z-20">
                      <ActionMenuOrb
                        compact
                        editLabel="تعديل الفيديو"
                        removeLabel="إزالة الفيديو"
                        onEdit={() => openVideoEditor(v)}
                        onRemove={() => deleteVideo(v.id)}
                      />
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/45 to-transparent space-y-1">
                    <p className="text-[11.5px] text-white line-clamp-2 leading-snug">{v.title}</p>
                    <div className="flex items-center gap-1 text-[10.5px] font-mono-num text-white/80">
                      <Play className="w-3 h-3 fill-current text-[#FF2D55]" />
                      <span>{compactNum(v.viewsCount)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : tab === 'media' ? (
          /* Instagram-Style 3-Column Square Photo Gallery */
          (() => {
            const mediaItems = posts.flatMap(p =>
              p.mediaUrls.map((url, idx) => ({ postId: p.id, url, key: `${p.id}_${idx}` }))
            );
            return mediaItems.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#7A7A85]">
                {lang === 'en' ? 'No photos yet' : 'لا توجد صور منشورة بعد'}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
                {mediaItems.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onOpenPostComments?.(item.postId)}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-[#181920] cursor-pointer"
                  >
                    <img
                      src={item.url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </button>
                ))}
              </div>
            );
          })()
        ) : tab === 'likes' ? (
          <div className="mt-3 divide-y divide-white/[0.08]">
            {likedPosts.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#7A7A85]">
                {lang === 'en' ? 'No liked posts yet' : 'لا توجد منشورات معجَب بها بعد'}
              </div>
            ) : (
              likedPosts.map(post => (
                <article
                  key={`liked_${post.id}`}
                  onClick={() => onOpenPostComments?.(post.id)}
                  className="py-4 space-y-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <UserAvatar initials={post.avatarInitials} avatarUrl={post.avatarUrl} size={28} />
                    <span className="font-semibold text-white">{post.displayName}</span>
                    {post.verified && <VerifiedIcon />}
                    <span className="text-[#8E8E93] font-mono-num">{post.createdAt}</span>
                  </div>
                  {post.content && (
                    <div className="text-[14px] text-[#E4E4E7] leading-relaxed line-clamp-4">
                      <RichMessageText text={post.content} lang={lang} />
                    </div>
                  )}
                  {post.mediaUrls.length > 0 && (
                    <div className="rounded-2xl overflow-hidden">
                      <MediaCollageGrid urls={post.mediaUrls} onSelect={() => onOpenPostComments?.(post.id)} />
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Sub-Filter Chips inside Saved */}
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all' as const, label: `الكل (${savedPosts.length + savedVideos.length})` },
                { id: 'posts' as const, label: `المنشورات (${savedPosts.length})` },
                { id: 'videos' as const, label: `نبض (${savedVideos.length})` },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSavedFilter(f.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors ${
                    savedFilter === f.id
                      ? 'bg-[#34D399]/18 border border-[#34D399]/40 text-[#6EE7B7]'
                      : 'bg-white/[0.04] border border-white/[0.08] text-[#8E8E93] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {savedPosts.length === 0 && savedVideos.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#7A7A85]">لم تحفظ أي منشورات أو فيديوهات بعد</div>
            ) : (
              <>
                {(savedFilter === 'all' || savedFilter === 'posts') && savedPosts.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-[#A1A1AA]">المنشورات المحفوظة</div>
                    <div className="divide-y divide-white/[0.07]">
                      {savedPosts.map(post => (
                        <article key={post.id} className="py-4 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenProfile(post.userId)}
                              className="flex items-center gap-2 text-start cursor-pointer group"
                            >
                              <UserAvatar initials={post.avatarInitials} avatarUrl={post.avatarUrl} size={30} />
                              <div>
                                <div className="text-xs font-semibold text-white group-hover:underline flex items-center gap-1">
                                  <span>{post.displayName}</span>
                                  {post.verified && <VerifiedIcon />}
                                </div>
                                <div className="text-[10.5px] text-[#7A7A85]">{post.createdAt}</div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => unsavePost(post.id)}
                              title="إزالة من المحفوظات"
                              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#FACC15] flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Bookmark className="w-4 h-4 fill-current" />
                            </button>
                          </div>

                          {post.content && (
                            <div className="text-[14px] text-[#F2F2F5] leading-relaxed">
                              <RichMessageText
                                text={post.content}
                                onMentionClick={onOpenProfileByUsername}
                                onHashtagClick={onOpenHashtag}
                              />
                            </div>
                          )}

                          {post.mediaUrls.length > 0 && (
                            <div className="rounded-[16px] overflow-hidden border border-[#94B3D6]/[0.12]">
                              <MediaCollageGrid
                                urls={post.mediaUrls}
                                onSelect={() => onOpenPostComments?.(post.id)}
                              />
                            </div>
                          )}

                          <div className="pt-2 border-t border-[#94B3D6]/[0.1] flex items-center gap-4 text-xs text-[#96A7BC]">
                            <button
                              type="button"
                              onClick={() => onOpenPostComments?.(post.id)}
                              className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span className="font-mono-num">{compactNum(post.commentsCount || 0)}</span>
                              <span>{lang === 'en' ? 'Open post & comments' : 'عرض المنشور والتعليقات'}</span>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {(savedFilter === 'all' || savedFilter === 'videos') && savedVideos.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-[#A1A1AA]">فيديوهات نبض المحفوظة</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {savedVideos.map(v => (
                        <div
                          key={v.id}
                          onClick={() => (onOpenVideo ? onOpenVideo(v.id) : onOpenVideos())}
                          className="group relative aspect-[9/14] rounded-2xl overflow-hidden bg-[#121217] border border-white/[0.09] text-start cursor-pointer"
                        >
                          {v.posterUrl ? (
                            <img
                              src={v.posterUrl}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <video src={v.videoUrl || ''} muted className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/45 to-transparent space-y-1">
                            <p className="text-[11.5px] text-white line-clamp-2 leading-snug">{v.title}</p>
                            <div className="flex items-center gap-1 text-[10.5px] font-mono-num text-white/80">
                              <Play className="w-3 h-3 fill-current text-[#FF2D55]" />
                              <span>{compactNum(v.viewsCount)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        </div>
      </div>

      {/* 2026 PROFILE STUDIO LIVE-PREVIEW EDITOR MODAL */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditOpen(false)}
            style={{ paddingBottom: 'var(--lm-kb-offset, 0px)' }}
            className="fixed inset-0 z-50 bg-black/82 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 transition-[padding] duration-150"
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              onClick={e => e.stopPropagation()}
              onSubmit={saveProfile}
              style={{ maxHeight: 'calc(var(--lm-vv-h, 100dvh) - 16px)' }}
              className="w-full max-w-[490px] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-[#131319] border border-white/[0.13] shadow-2xl"
            >
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => handleImageUpload('avatar', e)} className="hidden" />
              <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => handleImageUpload('cover', e)} className="hidden" />

              {/* Live Visual Preview Header inside Studio */}
              <div className="relative h-32 w-full bg-[#191922] overflow-hidden">
                {editCover ? (
                  <img src={editCover} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-[#1D1715] via-[#261B1A] to-[#131A18]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#131319] via-[#131319]/25 to-black/30" />

                <div className="absolute top-3 inset-x-4 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={uploadingKind === 'cover'}
                    onClick={() => coverInputRef.current?.click()}
                    className="h-8 px-3 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/[0.16] text-[11.5px] font-medium text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <CoverCanvasIcon className="w-3.5 h-3.5" />
                    <span>{uploadingKind === 'cover' ? 'جارٍ الرفع...' : 'صورة الغلاف'}</span>
                  </button>

                  <CloseOrbButton onClick={() => setEditOpen(false)} />
                </div>
              </div>

              <div className="px-5 pb-5 -mt-10 relative z-10 space-y-4">
                {profileUploadError && (
                  <div className="px-3.5 py-2 rounded-2xl bg-[#EF4444]/15 border border-[#FB7185]/35 text-xs text-[#FDA4AF]">
                    {profileUploadError}
                  </div>
                )}
                {/* Overlapping Live Avatar Editor */}
                <div className="flex items-end gap-3.5">
                  <div className="relative">
                    <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#F59E0B] via-[#FB7185] to-[#34D399]">
                      <div className="p-[2px] rounded-full bg-[#131319]">
                        <UserAvatar
                          initials={editName.slice(0, 2) || profileUser.avatarInitials}
                          avatarUrl={editAvatar}
                          size={72}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={uploadingKind === 'avatar'}
                    onClick={() => avatarInputRef.current?.click()}
                    className="mb-1 h-9 px-3.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.14] text-xs font-medium text-white flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <PortraitStudioIcon className="w-4 h-4" />
                    <span>{uploadingKind === 'avatar' ? 'جارٍ الرفع...' : 'تغيير الصورة الشخصية'}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#9E9EA8] px-1">الاسم</label>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="الاسم الظاهر..."
                      className="w-full h-11 rounded-2xl bg-[#0A0A0E] border border-white/[0.1] px-4 text-xs text-white outline-none focus:border-[#FBBF24]/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#9E9EA8] px-1">النبذة التعريفية</label>
                    <textarea
                      rows={3}
                      value={editBio}
                      onChange={e => setEditBio(e.target.value)}
                      placeholder="عرّف الناس بنفسك..."
                      className="w-full rounded-2xl bg-[#0A0A0E] border border-white/[0.1] p-3.5 text-xs text-white outline-none resize-none focus:border-[#FBBF24]/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#9E9EA8] px-1">الموقع</label>
                      <input
                        value={editLocation}
                        onChange={e => setEditLocation(e.target.value)}
                        placeholder="مثال: القاهرة، مصر"
                        className="w-full h-10 rounded-2xl bg-[#0A0A0E] border border-white/[0.1] px-3.5 text-xs text-white outline-none focus:border-[#34D399]/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#9E9EA8] px-1">الرابط الشخصي</label>
                      <input
                        dir="ltr"
                        value={editWebsite}
                        onChange={e => setEditWebsite(e.target.value)}
                        placeholder="https://..."
                        className="w-full h-10 rounded-2xl bg-[#0A0A0E] border border-white/[0.1] px-3.5 text-xs font-mono-num text-white outline-none focus:border-[#34D399]/50"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="h-9 px-4 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs text-[#C4C4CC] hover:text-white cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <PublishActionButton
                    type="submit"
                    variant="luminous"
                    loading={savingProfile}
                    disabled={!editName.trim()}
                    label="حفظ التغييرات"
                    loadingLabel="جارٍ الحفظ..."
                    icon={<Check className="w-3.5 h-3.5" />}
                  />
                </div>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT OWN PULSE VIDEO MODAL */}
      <AnimatePresence>
        {editingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingVideo(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={e => e.stopPropagation()}
              onSubmit={saveEditedVideo}
              className="w-full max-w-[430px] rounded-[26px] bg-[#131319] border border-white/[0.13] p-5 space-y-3.5 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <StylusEditIcon className="w-4 h-4" />
                  <span>تعديل فيديو نبض</span>
                </div>
                <CloseOrbButton onClick={() => setEditingVideo(null)} />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#9E9EA8] px-1">العنوان</label>
                <textarea
                  rows={2}
                  value={editVidTitle}
                  onChange={e => setEditVidTitle(e.target.value)}
                  className="w-full rounded-2xl bg-[#0A0A0E] border border-white/[0.1] p-3 text-xs text-white outline-none resize-none focus:border-[#FBBF24]/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#9E9EA8] px-1">الوصف</label>
                <input
                  value={editVidDesc}
                  onChange={e => setEditVidDesc(e.target.value)}
                  className="w-full h-10 rounded-2xl bg-[#0A0A0E] border border-white/[0.1] px-3.5 text-xs text-white outline-none focus:border-[#FBBF24]/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#9E9EA8] px-1">الوسوم</label>
                <input
                  value={editVidTags}
                  onChange={e => setEditVidTags(e.target.value)}
                  placeholder="#تصوير #القاهرة"
                  className="w-full h-10 rounded-2xl bg-[#0A0A0E] border border-white/[0.1] px-3.5 text-xs text-white outline-none focus:border-[#FBBF24]/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingVideo(null)}
                  className="h-9 px-4 rounded-full bg-white/[0.07] text-xs text-[#C4C4CC] hover:text-white cursor-pointer"
                >
                  إلغاء
                </button>
                <PublishActionButton
                  type="submit"
                  variant="rose"
                  loading={savingVideo}
                  disabled={!editVidTitle.trim()}
                  label="حفظ"
                  loadingLabel="جارٍ الحفظ..."
                  icon={<Check className="w-3.5 h-3.5" />}
                />
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOLLOWERS / FOLLOWING INTERACTIVE DIRECTORY SHEET */}
      <AnimatePresence>
        {peopleSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPeopleSheet(null)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[380px] max-h-[65vh] rounded-[26px] bg-[#131319] border border-white/[0.13] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  {peopleSheet === 'followers' ? 'المتابِعون' : 'يتابع'}
                </span>
                <CloseOrbButton size="sm" onClick={() => setPeopleSheet(null)} />
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                {(peopleSheet === 'followers' ? followersList : followingList).length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#7A7A85]">القائمة فارغة حاليًا</div>
                ) : (
                  (peopleSheet === 'followers' ? followersList : followingList).map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setPeopleSheet(null);
                        onOpenProfile(u.id);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.05] text-start cursor-pointer transition-colors"
                    >
                      <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white flex items-center gap-1 truncate">
                          <span>{u.displayName}</span>
                          {u.verified && <VerifiedIcon />}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ProfileQrModal open={qrOpen} user={profileUser} lang={lang} onClose={() => setQrOpen(false)} />
    </div>
  );
}
