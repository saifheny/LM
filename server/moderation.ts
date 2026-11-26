import { db } from './db.ts';
import { liveEngine } from './liveEngine.ts';

export type ReportTargetType = 'post' | 'post_comment' | 'video' | 'video_comment' | 'live';

/**
 * Positive engagement reactions that raise the anti-brigading report threshold proportionally.
 * (Excludes 'sad' since tragic/disturbing content can still receive 'sad' reactions.)
 */
export const POSITIVE_REACTIONS = new Set([
  'like',
  'love',
  'haha',
  'fire',
  'wow',
  'zap',
  'support',
  'celebrate',
  'mindblown',
  'hundred',
  'heart',
  'thumbs',
  'laugh',
]);

/**
 * Proportional Anti-Brigading Sensitive Content Threshold:
 * Prevents coordinated reporting attacks on popular / viral posts!
 *
 * - 0–29 positive interactions   -> 3 unique reports
 * - 30–99 positive interactions  -> 5 unique reports
 * - 100–499 positive interactions -> 10 unique reports
 * - 500+ positive interactions   -> proportional 2% of positive engagement
 *     * 1,000 interactions  -> 20 reports
 *     * 10,000 interactions -> 200 reports
 *     * 50,000 interactions -> 1,000 reports
 *     * 100,000 interactions -> 2,000 reports
 */
export function computeSensitiveReportThreshold(positiveEngagement: number): number {
  const e = Math.max(0, Math.floor(positiveEngagement || 0));
  if (e < 30) return 3;
  if (e < 100) return 5;
  if (e < 500) return 10;
  return Math.max(10, Math.round(e * 0.02));
}

export function computePostPositiveEngagement(params: {
  reactions?: Record<string, number>;
  likesCount?: number;
  score?: number;
  commentsCount?: number;
  sharesCount?: number;
}): number {
  let rxPositive = 0;
  if (params.reactions) {
    for (const [k, count] of Object.entries(params.reactions)) {
      if (POSITIVE_REACTIONS.has(k)) rxPositive += Number(count || 0);
    }
  }
  const baseLikes = Math.max(rxPositive, Number(params.likesCount || 0), Number(params.score || 0));
  const extra = Math.floor(Number(params.commentsCount || 0) * 0.5 + Number(params.sharesCount || 0) * 0.5);
  return Math.max(0, baseLikes + extra);
}

export function getTargetPositiveEngagement(targetType: ReportTargetType, targetId: string): number {
  if (targetType === 'post') {
    const row = db
      .prepare('SELECT likes_count, score, comments_count, shares_count FROM posts WHERE id = ?')
      .get(targetId) as { likes_count?: number; score?: number; comments_count?: number; shares_count?: number } | undefined;
    if (!row) return 0;
    const rxRows = db
      .prepare('SELECT reaction FROM post_reactions WHERE post_id = ?')
      .all(targetId) as Array<{ reaction: string }>;
    const reactions: Record<string, number> = {};
    for (const r of rxRows) reactions[r.reaction] = (reactions[r.reaction] || 0) + 1;
    return computePostPositiveEngagement({
      reactions,
      likesCount: Number(row.likes_count || 0),
      score: Number(row.score || 0),
      commentsCount: Number(row.comments_count || 0),
      sharesCount: Number(row.shares_count || 0),
    });
  }

  if (targetType === 'video') {
    const row = db
      .prepare('SELECT likes_count, comments_count, saves_count, shares_count FROM short_videos WHERE id = ?')
      .get(targetId) as { likes_count?: number; comments_count?: number; saves_count?: number; shares_count?: number } | undefined;
    if (!row) return 0;
    return Math.floor(
      Number(row.likes_count || 0) +
        Number(row.comments_count || 0) * 0.5 +
        Number(row.saves_count || 0) * 0.5 +
        Number(row.shares_count || 0) * 0.5
    );
  }

  if (targetType === 'live') {
    const st = liveEngine.getPublicState(targetId);
    return Math.floor(Number(st.likesCount || 0) + Number(st.viewersCount || 0) * 0.1);
  }

  if (targetType === 'video_comment') {
    const row = db.prepare('SELECT likes_count FROM video_comments WHERE id = ?').get(targetId) as
      | { likes_count?: number }
      | undefined;
    return Number(row?.likes_count || 0);
  }

  if (targetType === 'post_comment') {
    const row = db.prepare('SELECT COUNT(*) as c FROM post_comments WHERE parent_id = ?').get(targetId) as
      | { c?: number }
      | undefined;
    return Number(row?.c || 0);
  }

  return 0;
}

export function isContentSensitive(targetType: ReportTargetType, targetId: string, reportsCount: number): boolean {
  if (reportsCount <= 0) return false;
  const engagement = getTargetPositiveEngagement(targetType, targetId);
  const threshold = computeSensitiveReportThreshold(engagement);
  return reportsCount >= threshold;
}
