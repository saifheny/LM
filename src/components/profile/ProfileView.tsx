import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Globe,
  MapPin,
  MessageCircle,
  Play,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { Lang, ShortVideoItem, SocialPost, UserProfile } from '../../types';
import { RichMessageText, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ChromeArrowButton } from '../shared/HardwareUI';
import {
  CoverCanvasIcon,
  NavCommunityIcon,
  NavPulseIcon,
  PortraitStudioIcon,
  StylusEditIcon,
} from '../shared/Icons2026Pro';
import { ActionMenuOrb } from '../shared/ActionOrb2026';
import { api, apiGet, apiPost, apiUploadFile } from '../../lib/api';

interface ProfileViewProps {
  profileUserId: string;
  currentUser: UserProfile;
  lang: Lang;
  onProfileUpdated: (u: UserProfile) => void;
  onMessageUser: (targetUserId: string) => void;
  onOpenProfile: (uid: string) => void;
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
  onOpenVideos,
}: ProfileViewProps) {
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [videos, setVideos] = useState<ShortVideoItem[]>([]);
  const [savedVideos, setSavedVideos] = useState<ShortVideoItem[]>([]);
  const [followersList, setFollowersList] = useState<UserProfile[]>([]);
  const [followingList, setFollowingList] = useState<UserProfile[]>([]);
  const [tab, setTab] = useState<'posts' | 'videos' | 'saved'>('posts');
  const [loading, setLoading] = useState(true);

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
    try {
      const res = await apiGet<{
        ok: boolean;
        user: UserProfile;
        isFollowing: boolean;
        posts: SocialPost[];
        videos: ShortVideoItem[];
        savedVideos?: ShortVideoItem[];
        followersList?: UserProfile[];
        followingList?: UserProfile[];
      }>(`/api/users/${profileUserId}/profile?viewerId=${currentUser.id}`);
      setProfileUser(res.user);
      setIsFollowing(res.isFollowing);
      setPosts(res.posts);
      setVideos(res.videos);
      setSavedVideos(res.savedVideos || []);
      setFollowersList(res.followersList || []);
      setFollowingList(res.followingList || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [profileUserId, currentUser.id]);

  useEffect(() => {
    setPeopleSheet(null);
    setTab('posts');
    loadProfile();
  }, [loadProfile]);

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

  async function handleImageUpload(kind: 'avatar' | 'cover', e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingKind(kind);
    try {
      const up = await apiUploadFile(f);
      if (kind === 'avatar') setEditAvatar(up.url);
      else setEditCover(up.url);
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
      <div className="min-h-full w-full bg-[#0A0A0C] flex items-center justify-center text-xs text-[#7A7A85]">
        جارٍ تحميل الملف الشخصي...
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-full w-full bg-[#0A0A0C] flex items-center justify-center text-xs text-[#7A7A85]">
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
    <div className="min-h-full w-full bg-[#0A0A0C] text-[#F2F2F5]">
      <div className="max-w-[700px] mx-auto px-3 sm:px-5 pt-4 pb-28">
        {/* 2026 CINEMATIC COVER + FLOATING IDENTITY HERO */}
        <div className="rounded-[30px] overflow-hidden bg-[#111116] border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          {/* Editorial Cover Canvas */}
          <div className="relative h-40 sm:h-48 w-full overflow-hidden bg-[#16161D]">
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
                    'linear-gradient(135deg, #1A1614 0%, #241917 48%, #141918 100%)',
                }}
                className="w-full h-full"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111116] via-[#111116]/35 to-black/20" />

            {isMe && (
              <button
                type="button"
                onClick={openEditStudio}
                className="absolute top-3.5 end-3.5 h-9 px-3.5 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-xl border border-white/[0.16] text-xs font-medium text-white flex items-center gap-2 cursor-pointer transition-colors"
              >
                <CoverCanvasIcon className="w-4 h-4" />
                <span>تخصيص الغلاف</span>
              </button>
            )}
          </div>

          {/* Avatar + Identity + Actions */}
          <div className="px-5 sm:px-6 pb-6 -mt-12 relative z-10 space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div className="relative">
                <div className="p-[3px] rounded-full bg-gradient-to-tr from-[#F59E0B] via-[#FB7185] to-[#34D399]">
                  <div className="p-[2px] rounded-full bg-[#111116]">
                    <UserAvatar
                      initials={profileUser.avatarInitials}
                      avatarUrl={profileUser.avatarUrl}
                      size={88}
                    />
                  </div>
                </div>

                {/* 2026 Sculpted Portrait Studio Trigger (NO Generic Camera Icon!) */}
                {isMe && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={openEditStudio}
                    title="تحديث صورة الحساب"
                    className="absolute -bottom-1 -end-1 w-9 h-9 rounded-full bg-[#16161E]/95 backdrop-blur-xl border border-white/[0.2] flex items-center justify-center cursor-pointer shadow-xl"
                  >
                    <PortraitStudioIcon className="w-[18px] h-[18px]" />
                  </motion.button>
                )}
              </div>

              <div className="flex items-center gap-2 pb-1">
                {isMe ? (
                  <button
                    type="button"
                    onClick={openEditStudio}
                    className="h-10 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.14] text-xs font-semibold text-white flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <StylusEditIcon className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تعديل الملف' : 'Edit Profile'}</span>
                  </button>
                ) : (
                  <>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={toggleFollow}
                      className={`h-10 px-5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isFollowing
                          ? 'bg-white/[0.09] hover:bg-white/[0.15] border border-white/[0.16] text-white'
                          : 'bg-gradient-to-r from-[#F59E0B] to-[#FB7185] text-black font-bold hover:opacity-95'
                      }`}
                    >
                      {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      <span>{isFollowing ? (lang === 'ar' ? 'متابَع' : 'Following') : lang === 'ar' ? 'متابعة' : 'Follow'}</span>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onMessageUser(profileUser.id)}
                      className="h-10 px-4 rounded-full bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#34D399]/30 text-xs font-semibold text-[#6EE7B7] flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'مراسلة' : 'Message'}</span>
                    </motion.button>
                  </>
                )}
              </div>
            </div>

            {/* Name + Handle + Bio + Location + Website */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{profileUser.displayName}</h1>
                {profileUser.verified && <VerifiedIcon />}
                <span className="text-xs text-[#8E8E93] font-mono-num">@{profileUser.username}</span>
              </div>

              {profileUser.bio && (
                <p className="text-[14px] text-[#E4E4E7] leading-relaxed whitespace-pre-wrap">{profileUser.bio}</p>
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

            {/* 2026 Interactive Jewel-Accented Bento Stats Strip */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="rounded-2xl bg-[#16161D] border border-white/[0.08] px-3.5 py-2.5 relative overflow-hidden">
                <span className="absolute top-0 inset-x-4 h-[2px] rounded-full bg-gradient-to-r from-[#FBBF24] to-[#FB7185]" />
                <div className="text-base sm:text-lg font-mono-num font-bold text-white">
                  {posts.length + videos.length}
                </div>
                <div className="text-[11px] text-[#8E8E93]">{lang === 'ar' ? 'إجمالي المحتوى' : 'Content'}</div>
              </div>

              <button
                type="button"
                onClick={() => setPeopleSheet('followers')}
                className="rounded-2xl bg-[#16161D] hover:bg-[#1C1C25] border border-white/[0.08] px-3.5 py-2.5 text-start relative overflow-hidden cursor-pointer transition-colors"
              >
                <span className="absolute top-0 inset-x-4 h-[2px] rounded-full bg-gradient-to-r from-[#34D399] to-[#10B981]" />
                <div className="text-base sm:text-lg font-mono-num font-bold text-white">
                  {compactNum(profileUser.followersCount)}
                </div>
                <div className="text-[11px] text-[#8E8E93]">{lang === 'ar' ? 'متابِع' : 'Followers'}</div>
              </button>

              <button
                type="button"
                onClick={() => setPeopleSheet('following')}
                className="rounded-2xl bg-[#16161D] hover:bg-[#1C1C25] border border-white/[0.08] px-3.5 py-2.5 text-start relative overflow-hidden cursor-pointer transition-colors"
              >
                <span className="absolute top-0 inset-x-4 h-[2px] rounded-full bg-gradient-to-r from-[#FB7185] to-[#F97316]" />
                <div className="text-base sm:text-lg font-mono-num font-bold text-white">
                  {compactNum(profileUser.followingCount)}
                </div>
                <div className="text-[11px] text-[#8E8E93]">{lang === 'ar' ? 'يتابع' : 'Following'}</div>
              </button>
            </div>
          </div>
        </div>

        {/* Floating Tab Capsules */}
        <div className="mt-5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setTab('posts')}
            className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              tab === 'posts'
                ? 'bg-[#1A1A22] border border-[#FBBF24]/40 text-white'
                : 'bg-[#121217] border border-white/[0.08] text-[#8E8E93] hover:text-white'
            }`}
          >
            <NavCommunityIcon active={tab === 'posts'} className="w-4 h-4" />
            <span>{lang === 'ar' ? `المنشورات (${posts.length})` : `Posts (${posts.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('videos')}
            className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              tab === 'videos'
                ? 'bg-[#1A1A22] border border-[#FF2D55]/40 text-white'
                : 'bg-[#121217] border border-white/[0.08] text-[#8E8E93] hover:text-white'
            }`}
          >
            <NavPulseIcon active={tab === 'videos'} className="w-4 h-4" />
            <span>{lang === 'ar' ? `نبض (${videos.length})` : `Pulse (${videos.length})`}</span>
          </button>

          {isMe && (
            <button
              type="button"
              onClick={() => setTab('saved')}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                tab === 'saved'
                  ? 'bg-[#1A1A22] border border-[#34D399]/40 text-white'
                  : 'bg-[#121217] border border-white/[0.08] text-[#8E8E93] hover:text-white'
              }`}
            >
              <span>{lang === 'ar' ? `المحفوظات (${savedVideos.length})` : `Saved (${savedVideos.length})`}</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        {tab === 'posts' ? (
          <div className="mt-4 divide-y divide-white/[0.07]">
            {posts.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#7A7A85]">لا توجد منشورات بعد</div>
            ) : (
              posts.map(post => (
                <article key={post.id} className="py-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-[#7A7A85]">
                      <span className="font-semibold text-white">{post.displayName}</span>
                      <span>· {post.createdAt}</span>
                      {post.isEdited && <span className="text-[10.5px] text-[#FBBF24]/80">(معدّل)</span>}
                    </div>

                    {isMe && (
                      <ActionMenuOrb
                        editLabel="تعديل المنشور"
                        removeLabel="إزالة المنشور"
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
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditedPost(post.id)}
                          className="px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>حفظ</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[14.5px] text-[#F2F2F5] leading-relaxed">
                      <RichMessageText text={post.content} />
                    </div>
                  )}

                  {post.mediaUrls.length > 0 && (
                    <div className={`grid gap-1.5 ${post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {post.mediaUrls.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt=""
                          className={`w-full rounded-2xl object-cover border border-white/[0.08] ${
                            post.mediaUrls.length === 1 ? 'max-h-[380px]' : 'h-[190px]'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {(tab === 'videos' ? videos : savedVideos).length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-[#7A7A85]">
                {tab === 'videos' ? 'لا توجد فيديوهات نبض بعد' : 'لم تحفظ أي فيديوهات بعد'}
              </div>
            ) : (
              (tab === 'videos' ? videos : savedVideos).map(v => (
                <div
                  key={v.id}
                  onClick={onOpenVideos}
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
                  {isMe && tab === 'videos' && (
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
        )}
      </div>

      {/* 2026 PROFILE STUDIO LIVE-PREVIEW EDITOR MODAL */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditOpen(false)}
            className="fixed inset-0 z-50 bg-black/82 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              onClick={e => e.stopPropagation()}
              onSubmit={saveProfile}
              className="w-full max-w-[490px] max-h-[90vh] overflow-y-auto rounded-[28px] bg-[#131319] border border-white/[0.13] shadow-2xl"
            >
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={e => handleImageUpload('avatar', e)} className="hidden" />
              <input ref={coverInputRef} type="file" accept="image/*" onChange={e => handleImageUpload('cover', e)} className="hidden" />

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

                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="px-5 pb-5 -mt-10 relative z-10 space-y-4">
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
                    className="px-4 py-2 rounded-full bg-white/[0.06] text-xs text-[#A1A1AA] hover:text-white cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <ChromeArrowButton type="submit" disabled={savingProfile || !editName.trim()} size={40} title="حفظ التغييرات" />
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
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <StylusEditIcon className="w-4 h-4" />
                  <span>تعديل فيديو نبض</span>
                </div>
                <button type="button" onClick={() => setEditingVideo(null)} className="text-[#7A7A85] hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
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
                  className="px-4 py-2 rounded-full bg-white/[0.06] text-xs text-[#A1A1AA] hover:text-white cursor-pointer"
                >
                  إلغاء
                </button>
                <ChromeArrowButton type="submit" disabled={savingVideo || !editVidTitle.trim()} size={38} title="حفظ" />
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
              className="w-full max-w-[380px] max-h-[65vh] rounded-[24px] bg-[#131319] border border-white/[0.13] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  {peopleSheet === 'followers' ? 'المتابِعون' : 'يتابع'}
                </span>
                <button type="button" onClick={() => setPeopleSheet(null)} className="text-[#7A7A85] hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
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
                        <div className="text-[11px] text-[#7A7A85] font-mono-num truncate">@{u.username}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
