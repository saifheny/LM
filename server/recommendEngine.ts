import { v4 as uuid } from 'uuid';
import { db } from './db.ts';

/**
 * 2026 LM Personalized Ranking & Interest Recommendation Engine
 * Inspired by TikTok For You & Instagram Ranking:
 * 1) Engagement Velocity (likes/reactions, comments, saves, shares, views)
 * 2) Social Graph & Creator Affinity (followed creators + creators you engage with frequently)
 * 3) Topic & Keyword Semantic Affinity (learns Arabic & English topics like technology, religion, cinema, design, sports, music)
 * 4) Exploration Interleaving (80% personalized / 20% discovery injection every 4th slot so feeds never stagnate!)
 */

const TOPIC_CLUSTERS: Record<string, string[]> = {
  technology: [
    'تقنية', 'تكنولوجيا', 'برمجة', 'ذكاء', 'اصطناعي', 'كمبيوتر', 'موبايل', 'تطبيق', 'كود', 'سيرفر', 'هندسة', 'مفتوحة', 'المصدر',
    'tech', 'ai', 'coding', 'software', 'app', 'llm', 'gemini', 'openai', 'dev', 'code', 'programming',
  ],
  religion: [
    'دين', 'ديني', 'إسلام', 'قرآن', 'صلاة', 'دعاء', 'أذكار', 'رمضان', 'مسجد', 'تأمل', 'إيمان', 'حكمة', 'تفسير', 'سنة', 'الله',
    'islam', 'quran', 'dua', 'faith', 'religion', 'prayer',
  ],
  cinema: [
    'سينما', 'تصوير', 'إضاءة', 'كاميرا', 'إخراج', 'عدسة', 'مونتاج', 'فيديو', 'فيلم', 'لقطة', 'استوديو', 'ألوان',
    'cinema', 'film', 'photo', 'camera', 'studio', 'video', 'lighting',
  ],
  design: [
    'تصميم', 'واجهة', 'إبداع', 'فن', 'فني', 'جرافيك', 'ألوان', 'خط', 'جمال', 'معماري', 'عمارة',
    'design', 'ui', 'ux', 'art', 'creative', 'minimal',
  ],
  music: [
    'موسيقى', 'أغنية', 'عود', 'بيانو', 'صوتيات', 'عزف', 'لحن', 'هدوء',
    'music', 'piano', 'oud', 'lofi', 'audio', 'sound', 'chill',
  ],
  lifestyle: [
    'القاهرة', 'النيل', 'قهوة', 'سفر', 'مدينة', 'صباح', 'ليل', 'سهرة', 'كواليس', 'يوميات', 'إسكندرية', 'مصر',
    'cairo', 'nile', 'travel', 'coffee', 'city', 'night', 'vlog',
  ],
  sports: [
    'رياضة', 'كرة', 'قدم', 'مباراة', 'تمرين', 'لياقة', 'جيم', 'بطولة',
    'sport', 'football', 'fitness', 'gym', 'match',
  ],
};

const STOP_WORDS = new Set([
  'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'التي', 'الذي', 'اللي', 'ده', 'دي', 'ما', 'لا', 'أن', 'إن', 'كان', 'كل', 'بعد', 'قبل', 'أو', 'ثم',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'you', 'your', 'just', 'now', 'into',
]);

export function extractKeywordsAndTopics(text: string): string[] {
  const clean = String(text || '').toLowerCase();
  if (!clean.trim()) return [];
  const tokens = new Set<string>();

  // 1. Extract explicit #hashtags
  const hashMatches = clean.match(/#[\p{L}\p{N}_]{2,32}/gu) || [];
  for (const h of hashMatches) {
    tokens.add(h);
    tokens.add(h.slice(1));
  }

  // 2. Match semantic topic clusters (Arabic & English)
  for (const [topic, vocab] of Object.entries(TOPIC_CLUSTERS)) {
    for (const term of vocab) {
      if (clean.includes(term)) {
        tokens.add(`topic:${topic}`);
        break;
      }
    }
  }

  // 3. Extract salient standalone words (>= 3 chars)
  const words = clean.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w.length >= 3 && !STOP_WORDS.has(w)) {
      tokens.add(w);
      if (tokens.size >= 18) break;
    }
  }

  return Array.from(tokens).slice(0, 18);
}

export function recordUserInteraction(params: {
  userId?: string | null;
  targetType: 'post' | 'video' | 'live' | 'user';
  targetId: string;
  authorId?: string | null;
  action: 'like' | 'react' | 'comment' | 'save' | 'share' | 'follow' | 'watch' | 'report' | 'not_interested';
  text?: string;
  weight?: number;
}) {
  if (!params.userId) return;
  const defaultWeights: Record<typeof params.action, number> = {
    like: 3,
    react: 3,
    comment: 4,
    save: 5,
    share: 4,
    follow: 6,
    watch: 1.5,
    report: -8,
    not_interested: -7,
  };
  const weight = params.weight ?? defaultWeights[params.action] ?? 2;
  const keywords = extractKeywordsAndTopics(params.text || '');
  try {
    db.prepare(`
      INSERT INTO user_interactions (id, user_id, target_type, target_id, author_id, action, keywords_json, weight)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `ix_${uuid().slice(0, 10)}`,
      params.userId,
      params.targetType,
      params.targetId,
      params.authorId || null,
      params.action,
      JSON.stringify(keywords),
      weight
    );
  } catch {
    // never fail primary action due to analytics write
  }
}

export interface UserInterestProfile {
  followingSet: Set<string>;
  authorAffinity: Map<string, number>;
  keywordAffinity: Map<string, number>;
  topTopics: Array<{ keyword: string; score: number }>;
}

export function buildUserInterestProfile(userId?: string | null): UserInterestProfile {
  const followingSet = new Set<string>();
  const authorAffinity = new Map<string, number>();
  const keywordAffinity = new Map<string, number>();

  if (!userId) {
    return { followingSet, authorAffinity, keywordAffinity, topTopics: [] };
  }

  const followRows = db.prepare('SELECT following_id FROM user_follows WHERE follower_id = ?').all(userId) as Array<{
    following_id: string;
  }>;
  for (const r of followRows) followingSet.add(r.following_id);

  const ixRows = db.prepare(`
    SELECT author_id, keywords_json, weight
    FROM user_interactions
    WHERE user_id = ?
    ORDER BY rowid DESC
    LIMIT 180
  `).all(userId) as Array<{ author_id: string | null; keywords_json: string; weight: number }>;

  ixRows.forEach((row, idx) => {
    // Exponential recency decay so latest interests dominate smoothly
    const decay = Math.pow(0.985, idx);
    const w = Number(row.weight || 1) * decay;
    if (row.author_id) {
      authorAffinity.set(row.author_id, (authorAffinity.get(row.author_id) || 0) + w);
    }
    let kws: string[] = [];
    try {
      kws = JSON.parse(row.keywords_json || '[]');
    } catch {
      kws = [];
    }
    for (const kw of kws) {
      keywordAffinity.set(kw, (keywordAffinity.get(kw) || 0) + w);
    }
  });

  const topTopics = Array.from(keywordAffinity.entries())
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, score]) => ({ keyword, score: Math.round(score * 10) / 10 }));

  return { followingSet, authorAffinity, keywordAffinity, topTopics };
}

export interface RankableItem {
  id: string;
  authorId: string;
  text: string;
  likes: number;
  comments: number;
  saves?: number;
  shares?: number;
  views?: number;
  recencyIndex: number; // 0 = newest
  isSensitive?: boolean;
  isOwnFresh?: boolean;
}

/**
 * Ranks items by Personalized Relevance + Engagement Velocity,
 * then interleaves 20% diverse exploration items every 4th slot (TikTok For You pattern)
 * and prevents a single creator from crowding consecutive slots.
 */
export function rankFeedItems<T extends RankableItem>(items: T[], userId?: string | null): T[] {
  if (items.length <= 1) return items;
  const profile = buildUserInterestProfile(userId);

  const scored = items.map(item => {
    const kws = extractKeywordsAndTopics(item.text);

    // 1. Engagement velocity score (high likes/comments/saves/shares rise naturally!)
    const engagementRaw =
      Math.max(0, item.likes) * 2.2 +
      Math.max(0, item.comments) * 3.4 +
      Math.max(0, item.saves || 0) * 4.5 +
      Math.max(0, item.shares || 0) * 3.5 +
      Math.max(0, item.views || 0) * 0.015;
    const engagementScore = Math.log1p(engagementRaw) * 7.5;

    // 2. Social graph follow boost
    const followScore = profile.followingSet.has(item.authorId) ? 16 : 0;

    // 3. Creator affinity boost (capped so feed remains diverse)
    const rawAuthorAff = profile.authorAffinity.get(item.authorId) || 0;
    const authorScore = Math.max(-20, Math.min(28, rawAuthorAff * 2.4));

    // 4. Topic / Keyword interest match boost
    let topicScore = 0;
    for (const kw of kws) {
      const aff = profile.keywordAffinity.get(kw);
      if (aff) topicScore += kw.startsWith('topic:') ? aff * 2.8 : aff * 1.6;
    }
    topicScore = Math.max(-24, Math.min(38, topicScore));

    // 5. Freshness boost (newly created posts/videos/lives surface smoothly)
    const freshnessScore = item.isOwnFresh ? 45 : Math.max(0, 14 - item.recencyIndex * 1.4);

    // 6. Mild penalty for 3+ report sensitive items in default ranking (still allowed, behind blur!)
    const sensitiveAdj = item.isSensitive ? -6 : 0;

    const total = engagementScore + followScore + authorScore + topicScore + freshnessScore + sensitiveAdj;
    const isDiscoveryCandidate = !profile.followingSet.has(item.authorId) && rawAuthorAff <= 0 && topicScore <= 2;

    return { item, total, isDiscoveryCandidate, engagementScore };
  });

  scored.sort((a, b) => b.total - a.total);

  // Separate personalized primary stream & discovery pool for 80/20 TikTok exploration mixing
  const primary = scored.filter(s => !s.isDiscoveryCandidate);
  const discovery = scored.filter(s => s.isDiscoveryCandidate).sort((a, b) => b.engagementScore - a.engagementScore);

  if (primary.length === 0 || discovery.length === 0) {
    return scored.map(s => s.item);
  }

  const mixed: T[] = [];
  let pIdx = 0;
  let dIdx = 0;
  let lastAuthor: string | null = null;

  while (pIdx < primary.length || dIdx < discovery.length) {
    // Inject a diverse discovery item every 4th slot
    const shouldInjectDiscovery = mixed.length > 0 && mixed.length % 4 === 3 && dIdx < discovery.length;
    if (shouldInjectDiscovery) {
      const pick = discovery[dIdx++];
      mixed.push(pick.item);
      lastAuthor = pick.item.authorId;
      continue;
    }

    if (pIdx < primary.length) {
      // Soft diversity check: avoid placing same creator back-to-back if another strong item is right next
      if (lastAuthor && primary[pIdx].item.authorId === lastAuthor && pIdx + 1 < primary.length) {
        const swap = primary[pIdx + 1];
        primary[pIdx + 1] = primary[pIdx];
        primary[pIdx] = swap;
      }
      const pick = primary[pIdx++];
      mixed.push(pick.item);
      lastAuthor = pick.item.authorId;
    } else if (dIdx < discovery.length) {
      const pick = discovery[dIdx++];
      mixed.push(pick.item);
      lastAuthor = pick.item.authorId;
    }
  }

  return mixed;
}

export const LICENSED_MUSIC_LIBRARY = [
  {
    id: 'm_night_piano',
    title: 'هدوء الليل — بيانو ناعم',
    artist: 'LM Studio',
    mood: 'هادئ',
    durationSec: 14,
    license: 'CC0 — مجانية ومرخصة',
    url: '/uploads/music/night_piano.wav',
  },
  {
    id: 'm_nile_oud',
    title: 'نسيم النيل — عود وموسيقى شرقية',
    artist: 'LM Studio',
    mood: 'شرقي هادئ',
    durationSec: 14,
    license: 'CC0 — مجانية ومرخصة',
    url: '/uploads/music/nile_oud.wav',
  },
  {
    id: 'm_morning_lofi',
    title: 'قهوة الصباح — لو-فاي دافئ',
    artist: 'LM Studio',
    mood: 'لو-فاي',
    durationSec: 14,
    license: 'CC0 — مجانية ومرخصة',
    url: '/uploads/music/morning_lofi.wav',
  },
  {
    id: 'm_cinema_horizon',
    title: 'أفق سينمائي — أوركسترا هادئة',
    artist: 'LM Studio',
    mood: 'سينمائي',
    durationSec: 14,
    license: 'CC0 — مجانية ومرخصة',
    url: '/uploads/music/cinema_horizon.wav',
  },
  {
    id: 'm_calm_serenity',
    title: 'تأمل وسكينة — نغمات صافية',
    artist: 'LM Studio',
    mood: 'تأمل',
    durationSec: 14,
    license: 'CC0 — مجانية ومرخصة',
    url: '/uploads/music/calm_serenity.wav',
  },
  {
    id: 'm_city_pulse',
    title: 'إيقاع المدينة — إلكترونيك ناعم',
    artist: 'LM Studio',
    mood: 'عصري',
    durationSec: 14,
    license: 'CC0 — مجانية ومرخصة',
    url: '/uploads/music/city_pulse.wav',
  },
];
