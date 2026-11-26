export type CountryCode = 'EG' | 'SA' | 'AE' | 'US' | 'EU';

export type NavTab =
  | 'social'
  | 'videos'
  | 'live'
  | 'chat'
  | 'ai'
  | 'profile'
  | 'settings';

export type Lang = 'ar' | 'en';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  displayNameEn: string;
  bio: string;
  avatarColor: string;
  avatarInitials: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  location?: string;
  website?: string;
  verified: boolean;
  country: CountryCode;
  demoBalanceEgp: number;
  creatorEarningsEgp: number;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

export interface StoryItem {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  avatarUrl: string | null;
  mediaUrl: string;
  caption: string;
  reactions?: Record<string, number>;
  myReaction?: string | null;
  createdAt: string;
}

export interface PostPollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PostPoll {
  question: string;
  options: PostPollOption[];
  votedOptionId?: string | null;
}

export interface LicensedMusicTrack {
  id: string;
  title: string;
  artist: string;
  mood: string;
  durationSec: number;
  license: string;
  url: string;
}

export interface SocialPost {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  avatarUrl: string | null;
  verified: boolean;
  hasActiveStory?: boolean;
  topic: string;
  content: string;
  mediaUrl: string | null;
  mediaUrls: string[];
  musicUrl?: string | null;
  musicTitle?: string | null;
  location: string;
  poll: PostPoll | null;
  score: number;
  myVote: -1 | 0 | 1;
  reactions?: Record<string, number>;
  myReaction?: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  likedByMe: boolean;
  savedByMe?: boolean;
  isEdited?: boolean;
  reportsCount?: number;
  isSensitive?: boolean;
  createdAt: string;
}

export interface PostCommentItem {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  avatarUrl: string | null;
  verified: boolean;
  isAi?: boolean;
  aiSummoned?: boolean;
  content: string;
  audioUrl: string | null;
  audioDurationSec: number;
  transcript: string | null;
  reportsCount?: number;
  isSensitive?: boolean;
  createdAt: string;
}

export interface ShortVideoItem {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  avatarUrl: string | null;
  verified: boolean;
  hasActiveStory?: boolean;
  isFollowingAuthor?: boolean;
  title: string;
  description: string;
  tags: string;
  audioTitle: string;
  videoUrl: string | null;
  posterUrl: string | null;
  scenePreset: string;
  durationSec: number;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  sharesCount: number;
  viewsCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  reportsCount?: number;
  isSensitive?: boolean;
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  type: 'dm' | 'group' | 'community';
  folder: 'personal' | 'groups' | 'channels';
  title: string;
  description: string;
  avatarColor: string;
  avatarUrl: string | null;
  onlineText: string;
  pinnedMessage: string | null;
  isPinned: boolean;
  unreadCount: number;
  isEncrypted: boolean;
  memberCount: number;
  aiEnabled?: boolean;
  creatorId?: string;
  peerUserId?: string | null;
  lastMessage: string;
  lastMessageAt: string;
}

export interface ChatMessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  avatarUrl: string | null;
  verified?: boolean;
  isAi?: boolean;
  aiSummoned?: boolean;
  content: string;
  msgType: 'text' | 'image' | 'audio' | 'video_note' | 'file' | 'ai_reply';
  mediaUrl: string | null;
  transcript: string | null;
  isSpoiler: boolean;
  isEdited?: boolean;
  replyToId: string | null;
  replySender: string | null;
  replyText: string | null;
  reactions: Record<string, string[]>;
  aiConsentRef: string | null;
  createdAt: string;
}

export interface VideoCommentItem {
  id: string;
  videoId: string;
  userId: string;
  parentId: string | null;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  avatarUrl: string | null;
  verified?: boolean;
  isAi?: boolean;
  aiSummoned?: boolean;
  content: string;
  audioUrl: string | null;
  audioDurationSec: number;
  transcript: string | null;
  likesCount: number;
  likedByMe: boolean;
  isEdited?: boolean;
  reportsCount?: number;
  isSensitive?: boolean;
  createdAt: string;
}

export interface HighlightComment {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  text: string;
  durationSec: number;
  createdAt: number;
  startedAt?: number;
  expiresAt?: number;
}

export interface LiveChatMessage {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  text: string;
  isGift?: boolean;
  giftName?: string;
  giftValueEgp?: number;
  createdAt: number;
}

export interface LiveRoomItem {
  id: string;
  hostId: string;
  hostName: string;
  hostUsername: string;
  hostColor: string;
  hostInitials: string;
  hostAvatarUrl: string | null;
  title: string;
  category: string;
  videoUrl: string | null;
  scenePreset: string;
  viewersCount: number;
  likesCount?: number;
  totalGiftsEgp: number;
  highlightsEnabled: boolean;
  cooldownSec: number;
  hasActiveStory?: boolean;
  reportsCount?: number;
  isSensitive?: boolean;
}

export interface LiveRoomState {
  roomId: string;
  activeHighlight: HighlightComment | null;
  highlightQueue: HighlightComment[];
  recentMessages: LiveChatMessage[];
  highlightsEnabled: boolean;
  cooldownSec: number;
  bannedUserIds: string[];
  platformCutPct: number;
  totalGiftsEgp: number;
  viewersCount: number;
  likesCount?: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  actorId: string;
  actorName: string;
  actorInitials: string;
  actorAvatarUrl: string | null;
  type: 'follow' | 'react' | 'comment' | 'message';
  text: string;
  refTab: NavTab;
  refId: string | null;
  isRead: boolean;
  createdAt: string;
}
