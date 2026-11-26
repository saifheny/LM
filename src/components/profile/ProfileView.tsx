import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  MessageCircle,
  Pencil,
  Play,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { Lang, ShortVideoItem, SocialPost, UserProfile } from '../../types';
import { RichMessageText, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ChromeArrowButton } from '../shared/HardwareUI';
import { api, apiGet, apiPost, apiUploadFile } from '../../lib/api';

interface ProfileViewProps {
  profileUserId: string;
  currentUser: UserProfile;
  lang: Lang;
  onProfileUpdated: (u: UserProfile) => void;
  onMessageUser: (targetUserId: string) => void;
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
  onOpenVideos,
}: ProfileViewProps) {
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [videos, setVideos] = useState<ShortVideoItem[]>([]);
  const [tab, setTab] = useState<'posts' | 'videos'>('posts');
  const [loading, setLoading] = useState(true);

  // Edit Profile Modal
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Inline Edit Own Post
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState('');

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
      }>(`/api/users/${profileUserId}/profile?viewerId=${currentUser.id}`);
      setProfileUser(res.user);
      setIsFollowing(res.isFollowing);
      setPosts(res.posts);
      setVideos(res.videos);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [profileUserId, currentUser.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function openEditModal() {
    if (!profileUser) return;
    setEditName(profileUser.displayName);
    setEditBio(profileUser.bio || '');
    setEditAvatar(profileUser.avatarUrl);
    setEditOpen(true);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingAvatar(true);
    try {
      const up = await apiUploadFile(f);
      setEditAvatar(up.url);
    } finally {
      setUploadingAvatar(false);
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
          avatarUrl: editAvatar,
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

  return (
    <div className="min-h-full w-full bg-[#0A0A0C] text-[#F2F2F5]">
      <div className="max-w-[660px] mx-auto px-4 pt-6 pb-28">
        {/* Floating Profile Header Card */}
        <div className="rounded-[28px] bg-[#121217]/92 backdrop-blur-xl border border-white/[0.08] p-5 sm:p-6 space-y-5 shadow-xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <UserAvatar
                  initials={profileUser.avatarInitials}
                  avatarUrl={profileUser.avatarUrl}
                  size={78}
                />
                {isMe && (
                  <button
                    type="button"
                    onClick={openEditModal}
                    title="تغيير الصورة"
                    className="absolute -bottom-1 -end-1 w-7 h-7 rounded-full bg-[#1C1C24] border border-white/20 text-white hover:bg-white hover:text-black flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-white truncate">{profileUser.displayName}</h1>
                  {profileUser.verified && <VerifiedIcon />}
                </div>
                <div className="text-xs text-[#7A7A85] font-mono-num">@{profileUser.username}</div>
              </div>
            </div>

            {/* Action Buttons: Edit Profile (me) OR Follow + Direct Message (other) */}
            <div className="flex items-center gap-2 shrink-0">
              {isMe ? (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="h-9 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.14] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تعديل الملف' : 'Edit Profile'}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleFollow}
                    className={`h-9 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      isFollowing
                        ? 'bg-white/[0.09] hover:bg-white/[0.15] border border-white/[0.16] text-white'
                        : 'bg-white text-black hover:bg-[#E4E4E7]'
                    }`}
                  >
                    {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>{isFollowing ? (lang === 'ar' ? 'متابَع' : 'Following') : lang === 'ar' ? 'متابعة' : 'Follow'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onMessageUser(profileUser.id)}
                    className="h-9 px-4 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'مراسلة' : 'Message'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {profileUser.bio && (
            <p className="text-[14px] text-[#D4D4D8] leading-relaxed whitespace-pre-wrap">{profileUser.bio}</p>
          )}

          {/* Stats Strip */}
          <div className="pt-3 border-t border-white/[0.07] flex items-center gap-6 text-xs">
            <div>
              <span className="font-mono-num font-bold text-white text-sm me-1.5">{posts.length + videos.length}</span>
              <span className="text-[#8E8E93]">{lang === 'ar' ? 'محتوى' : 'Posts'}</span>
            </div>
            <div>
              <span className="font-mono-num font-bold text-white text-sm me-1.5">
                {compactNum(profileUser.followersCount)}
              </span>
              <span className="text-[#8E8E93]">{lang === 'ar' ? 'متابِع' : 'Followers'}</span>
            </div>
            <div>
              <span className="font-mono-num font-bold text-white text-sm me-1.5">
                {compactNum(profileUser.followingCount)}
              </span>
              <span className="text-[#8E8E93]">{lang === 'ar' ? 'يتابع' : 'Following'}</span>
            </div>
          </div>
        </div>

        {/* Clean Floating Tab Switcher: Posts | Pulse */}
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('posts')}
            className={`px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              tab === 'posts'
                ? 'bg-white text-black'
                : 'bg-[#121217] border border-white/[0.08] text-[#8E8E93] hover:text-white'
            }`}
          >
            {lang === 'ar' ? `المنشورات (${posts.length})` : `Posts (${posts.length})`}
          </button>

          <button
            type="button"
            onClick={() => setTab('videos')}
            className={`px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              tab === 'videos'
                ? 'bg-white text-black'
                : 'bg-[#121217] border border-white/[0.08] text-[#8E8E93] hover:text-white'
            }`}
          >
            {lang === 'ar' ? `نبض (${videos.length})` : `Pulse (${videos.length})`}
          </button>
        </div>

        {/* Tab Content */}
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
                      {post.isEdited && <span className="text-[10.5px] text-[#7A7A85]">(معدّل)</span>}
                    </div>

                    {isMe && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPostId(post.id);
                            setEditingPostText(post.content);
                          }}
                          title="تعديل"
                          className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#7A7A85] hover:text-white flex items-center justify-center cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePost(post.id)}
                          title="حذف"
                          className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#7A7A85] hover:text-[#EF4444] flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
            {videos.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-[#7A7A85]">لا توجد فيديوهات نبض بعد</div>
            ) : (
              videos.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={onOpenVideos}
                  className="group relative aspect-[9/14] rounded-2xl overflow-hidden bg-[#121217] border border-white/[0.08] text-start cursor-pointer"
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
                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent space-y-1">
                    <p className="text-[11.5px] text-white line-clamp-2 leading-snug">{v.title}</p>
                    <div className="flex items-center gap-1 text-[10.5px] font-mono-num text-white/80">
                      <Play className="w-3 h-3 fill-current" />
                      <span>{compactNum(v.viewsCount)}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Floating Modal */}
      {editOpen && (
        <div
          onClick={() => setEditOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={saveProfile}
            className="w-full max-w-[430px] rounded-[26px] bg-[#131319] border border-white/[0.13] p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
              <span className="text-sm font-semibold text-white">تعديل الملف الشخصي</span>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#7A7A85] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />

            <div className="flex items-center gap-4">
              <UserAvatar initials={editName.slice(0, 2) || profileUser.avatarInitials} avatarUrl={editAvatar} size={64} />
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-xs font-medium text-white flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{uploadingAvatar ? 'جارٍ الرفع...' : 'تغيير صورة الحساب'}</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#8E8E93] px-1">الاسم</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="الاسم الظاهر..."
                className="w-full h-11 rounded-2xl bg-[#0A0A0C] border border-white/[0.11] px-4 text-xs text-white outline-none focus:border-white/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#8E8E93] px-1">النبذة التعريفية</label>
              <textarea
                rows={3}
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                placeholder="اكتب نبذة قصيرة عنك..."
                className="w-full rounded-2xl bg-[#0A0A0C] border border-white/[0.11] p-3.5 text-xs text-white outline-none resize-none focus:border-white/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 rounded-full bg-white/[0.06] text-xs text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                إلغاء
              </button>
              <ChromeArrowButton type="submit" disabled={savingProfile || !editName.trim()} size={40} title="حفظ" />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
