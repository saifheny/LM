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
  coverUrl?: string | null;
  location?: string;
  website?: string;
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

export type ProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'xai'
  | 'mistral'
  | 'groq'
  | 'openrouter'
  | 'perplexity'
  | 'together'
  | 'cohere'
  | 'ollama';

export interface ProviderConfig {
  geminiApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  deepseekApiKey: string;
  xaiApiKey: string;
  mistralApiKey: string;
  groqApiKey: string;
  openrouterApiKey: string;
  perplexityApiKey: string;
  togetherApiKey: string;
  cohereApiKey: string;
  ollamaUrl: string;
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  meilisearchUrl: string;
  blnkUrl: string;
  matrixUrl: string;
  defaultProvider: ProviderId;
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
