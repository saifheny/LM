export type VipTier = 0 | 5 | 4 | 3 | 2 | 1; // 0 = Free, 5 = VIP 5 ... 1 = VIP 1 (highest)

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

export interface AdRemovalFlags {
  videos: boolean;      // 100 EGP
  largeGroups: boolean; // 50 EGP
  ai: boolean;          // 50 EGP
  investment: boolean;  // 5 EGP
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

export interface ProviderConfig {
  geminiApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  openrouterApiKey: string;
  groqApiKey: string;
  ollamaUrl: string;
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  meilisearchUrl: string;
  blnkUrl: string;
  matrixUrl: string;
  defaultProvider: 'local-smart' | 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq' | 'ollama';
  defaultModel: string;
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
