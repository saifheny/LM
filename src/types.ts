export type VipTier = 0 | 5 | 4 | 3 | 2 | 1;

export type RankId =
  | 'soldier'
  | 'pfc'
  | 'sergeant'
  | 'colonel'
  | 'general'
  | 'prince'
  | 'king'
  | 'president'
  | 'emperor';

export type CountryCode = 'EG' | 'SA' | 'AE' | 'US' | 'EU';

export type ThemeId = 'obsidian' | 'alabaster' | 'royal-gold' | 'emerald-reserve' | 'imperial-onyx';

export type AiTierId = 'free' | 'ai_20' | 'ai_50' | 'ai_100' | 'ai_200';

export type NavTab =
  | 'chat'
  | 'videos'
  | 'social'
  | 'live'
  | 'ai'
  | 'vip'
  | 'finance'
  | 'settings';

export type Lang = 'ar' | 'en';

export interface AdRemovalFlags {
  videos: boolean;
  largeGroups: boolean;
  ai: boolean;
  investment: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  displayNameEn: string;
  bio: string;
  avatarColor: string;
  avatarInitials: string;
  avatarUrl: string | null;
  verified: boolean;
  vipTier: VipTier;
  prioritySupport: boolean;
  rankId: RankId;
  supremeTitle: 'king' | 'president' | 'emperor' | null;
  aiTier: AiTierId;
  aiUsedToday: number;
  adRemoval: AdRemovalFlags;
  customAppName: string;
  customAppIcon: string;
  theme: ThemeId;
  country: CountryCode;
  travelExceptionActive: boolean;
  travelExceptionNote: string | null;
  monthsAbroad: number;
  targetCountry: CountryCode | null;
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
  vipTier: VipTier;
  mediaUrl: string;
  caption: string;
  createdAt: string;
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
  vipTier: VipTier;
  rankId: RankId;
  supremeTitle: string | null;
  content: string;
  mediaUrl: string | null;
  mediaUrls: string[];
  location: string;
  mediaStyle: string | null;
  mediaCaption: string | null;
  isSponsored: boolean;
  sponsorBudgetEgp: number;
  sponsorAudience: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  likedByMe: boolean;
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
  vipTier: VipTier;
  rankId: RankId;
  title: string;
  description: string;
  tags: string;
  audioTitle: string;
  videoUrl: string | null;
  posterUrl: string | null;
  scenePreset: string;
  durationSec: number;
  isSponsored: boolean;
  sponsorBudgetEgp: number;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  sharesCount: number;
  viewsCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
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
  isLargeGroup: boolean;
  isEncrypted: boolean;
  memberCount: number;
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
  vipTier: VipTier;
  content: string;
  msgType: 'text' | 'image' | 'audio' | 'video_note' | 'file' | 'ai_reply';
  mediaUrl: string | null;
  transcript: string | null;
  sendEffect: string | null;
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
  vipTier: VipTier;
  content: string;
  audioUrl: string | null;
  audioDurationSec: number;
  transcript: string | null;
  likesCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface HighlightComment {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  username: string;
  vipTier: 1 | 2 | 3;
  rankId: RankId;
  avatarColor: string;
  avatarInitials: string;
  text: string;
  durationSec: 15 | 10 | 5;
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
  vipTier: VipTier;
  rankId: RankId;
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
  hostVip: VipTier;
  title: string;
  category: string;
  videoUrl: string | null;
  scenePreset: string;
  viewersCount: number;
  totalGiftsEgp: number;
  highlightsEnabled: boolean;
  cooldownSec: number;
  platformCutPct: number;
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
}

export const RANK_META: Record<RankId, { ar: string; en: string; color: string; supreme?: boolean }> = {
  soldier: { ar: 'جندي', en: 'Soldier', color: '#71717A' },
  pfc: { ar: 'جندي أول', en: 'PFC', color: '#94A3B8' },
  sergeant: { ar: 'رقيب', en: 'Sergeant', color: '#38BDF8' },
  colonel: { ar: 'عقيد', en: 'Colonel', color: '#818CF8' },
  general: { ar: 'جنرال', en: 'General', color: '#10B981' },
  prince: { ar: 'أمير', en: 'Prince', color: '#F59E0B' },
  king: { ar: 'الملك', en: 'The King', color: '#EAB308', supreme: true },
  president: { ar: 'الرئيس', en: 'The President', color: '#E2E8F0', supreme: true },
  emperor: { ar: 'الإمبراطور', en: 'The Emperor', color: '#D4AF37', supreme: true },
};

export const COUNTRY_META: Record<CountryCode, { ar: string; en: string; currency: string; symbol: string; flag: string }> = {
  EG: { ar: 'مصر', en: 'Egypt', currency: 'EGP', symbol: 'ج.م', flag: '🇪🇬' },
  SA: { ar: 'السعودية', en: 'Saudi Arabia', currency: 'SAR', symbol: 'ر.س', flag: '🇸🇦' },
  AE: { ar: 'الإمارات', en: 'UAE', currency: 'AED', symbol: 'د.إ', flag: '🇦🇪' },
  US: { ar: 'الولايات المتحدة', en: 'United States', currency: 'USD', symbol: '$', flag: '🇺🇸' },
  EU: { ar: 'أوروبا', en: 'Europe', currency: 'EUR', symbol: '€', flag: '🇪🇺' },
};
