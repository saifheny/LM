import { v4 as uuid } from 'uuid';
import { db } from './db.ts';
import { HighlightComment, LiveChatMessage, UserProfile } from './types.ts';

const BANNED_WORDS = [
  'تهديد', 'أقتلك', 'هقتلك', 'شتيمة', 'حقير', 'غبي جدا', 'سافل', 'كذاب نصاب',
  'kill you', 'threat', 'harass', 'scam idiot', 'hate speech', 'abuse',
];

export interface RoomRuntimeState {
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

class LiveBroadcastEngine {
  private states = new Map<string, {
    activeHighlight: HighlightComment | null;
    highlightQueue: HighlightComment[];
    recentMessages: LiveChatMessage[];
    lastHighlightByUser: Map<string, number>;
    bannedUsers: Set<string>;
    highlightsEnabled: boolean;
    cooldownSec: number;
    platformCutPct: number;
    totalGiftsEgp: number;
    viewersCount: number;
  }>();

  private broadcaster: ((event: string, payload: unknown) => void) | null = null;
  private timer: NodeJS.Timeout | null = null;

  setBroadcaster(fn: (event: string, payload: unknown) => void) {
    this.broadcaster = fn;
  }

  startTicker() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [roomId, st] of this.states.entries()) {
        if (st.activeHighlight && st.activeHighlight.expiresAt && now >= st.activeHighlight.expiresAt) {
          st.activeHighlight = null;
          this.promoteNext(roomId);
          this.emitRoomState(roomId);
        }
      }
    }, 250);
  }

  ensureRoom(roomId: string) {
    if (this.states.has(roomId)) return this.states.get(roomId)!;
    const row = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(roomId) as Record<string, unknown> | undefined;
    const isUserCustomLive = row?.scene_preset === 'webrtc_live';
    const state = {
      activeHighlight: null as HighlightComment | null,
      highlightQueue: [] as HighlightComment[],
      recentMessages: (isUserCustomLive
        ? []
        : [
            {
              id: uuid(),
              roomId,
              userId: 'u_nour',
              displayName: 'نور حسن',
              username: 'nour',
              vipTier: 0 as const,
              rankId: 'soldier' as const,
              avatarColor: '#27272A',
              avatarInitials: 'نح',
              text: 'جودة الصوت والصورة نقية جدًا الليلة 🔥',
              createdAt: Date.now() - 45000,
            },
            {
              id: uuid(),
              roomId,
              userId: 'u_omar',
              displayName: 'عمر طارق',
              username: 'omar',
              vipTier: 0 as const,
              rankId: 'soldier' as const,
              avatarColor: '#27272A',
              avatarInitials: 'عط',
              text: 'منورين البث يا شباب ✨🎙️',
              createdAt: Date.now() - 25000,
            },
            {
              id: uuid(),
              roomId,
              userId: 'u_karim',
              displayName: 'كريم فؤاد',
              username: 'karim',
              vipTier: 0 as const,
              rankId: 'soldier' as const,
              avatarColor: '#27272A',
              avatarInitials: 'كف',
              text: 'متابعين معاكم من القاهرة ⚡',
              createdAt: Date.now() - 10000,
            },
          ]) as LiveChatMessage[],
      lastHighlightByUser: new Map<string, number>(),
      bannedUsers: new Set<string>(),
      highlightsEnabled: row ? Boolean(row.highlights_enabled) : true,
      cooldownSec: row ? Number(row.cooldown_sec || 10) : 10,
      platformCutPct: row ? Number(row.platform_cut_pct || 25) : 25,
      totalGiftsEgp: row ? Number(row.total_gifts_egp || 0) : 0,
      viewersCount: row ? Number(row.viewers_count ?? (isUserCustomLive ? 1 : 4200)) : 4200,
    };
    this.states.set(roomId, state);
    return state;
  }

  getPublicState(roomId: string): RoomRuntimeState {
    const st = this.ensureRoom(roomId);
    return {
      roomId,
      activeHighlight: st.activeHighlight,
      highlightQueue: st.highlightQueue,
      recentMessages: st.recentMessages.slice(-60),
      highlightsEnabled: st.highlightsEnabled,
      cooldownSec: st.cooldownSec,
      bannedUserIds: Array.from(st.bannedUsers),
      platformCutPct: st.platformCutPct,
      totalGiftsEgp: st.totalGiftsEgp,
      viewersCount: st.viewersCount,
    };
  }

  private emitRoomState(roomId: string) {
    if (this.broadcaster) {
      this.broadcaster('live:state', this.getPublicState(roomId));
    }
  }

  private checkModeration(text: string): { ok: boolean; reason?: string } {
    const lower = text.toLowerCase();
    for (const word of BANNED_WORDS) {
      if (lower.includes(word)) {
        return { ok: false, reason: 'تم حجب التعليق لاحتوائه على كلمات مخالفة.' };
      }
    }
    if (!text.trim() || text.trim().length > 240) {
      return { ok: false, reason: 'اكتب تعليقًا بين 1 و240 حرفًا.' };
    }
    return { ok: true };
  }

  private promoteNext(roomId: string) {
    const st = this.ensureRoom(roomId);
    if (st.activeHighlight || st.highlightQueue.length === 0) return;
    const next = st.highlightQueue.shift()!;
    const now = Date.now();
    next.startedAt = now;
    next.expiresAt = now + next.durationSec * 1000;
    st.activeHighlight = next;
  }

  addNormalComment(roomId: string, user: UserProfile, text: string) {
    const st = this.ensureRoom(roomId);
    if (st.bannedUsers.has(user.id)) {
      return { ok: false, error: 'غير مسموح بالتعليق في هذا البث.' };
    }
    const mod = this.checkModeration(text);
    if (!mod.ok) return { ok: false, error: mod.reason };

    const msg: LiveChatMessage = {
      id: uuid(),
      roomId,
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      vipTier: 0,
      rankId: 'soldier',
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      text: text.trim(),
      createdAt: Date.now(),
    };
    st.recentMessages.push(msg);
    if (st.recentMessages.length > 100) st.recentMessages.shift();
    this.emitRoomState(roomId);
    return { ok: true, message: msg };
  }

  submitHighlight(roomId: string, user: UserProfile, text: string, bypassCooldown = false) {
    const st = this.ensureRoom(roomId);
    if (!st.highlightsEnabled) {
      return { ok: false, error: 'التعليقات المثبتة متوقفة حاليًا.' };
    }
    if (st.bannedUsers.has(user.id)) {
      return { ok: false, error: 'غير مسموح بالتعليق.' };
    }

    const now = Date.now();
    const lastSent = st.lastHighlightByUser.get(user.id) || 0;
    const elapsedSec = (now - lastSent) / 1000;
    if (!bypassCooldown && elapsedSec < st.cooldownSec) {
      const remaining = Math.ceil(st.cooldownSec - elapsedSec);
      return {
        ok: false,
        error: `انتظر ${remaining} ثانية قبل التثبيت مجددًا.`,
        cooldownRemaining: remaining,
      };
    }

    const mod = this.checkModeration(text);
    if (!mod.ok) return { ok: false, error: mod.reason };

    const highlight: HighlightComment = {
      id: uuid(),
      roomId,
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      vipTier: 1,
      rankId: 'soldier',
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      text: text.trim(),
      durationSec: 10,
      createdAt: now,
    };

    st.lastHighlightByUser.set(user.id, now);
    st.highlightQueue.push(highlight);
    this.promoteNext(roomId);

    st.recentMessages.push({
      id: uuid(),
      roomId,
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      vipTier: 0,
      rankId: 'soldier',
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      text: `📌 ${highlight.text}`,
      createdAt: now,
    });

    this.emitRoomState(roomId);
    return { ok: true, highlight };
  }

  simulatePriorityBurst(roomId: string) {
    const st = this.ensureRoom(roomId);
    const now = Date.now();
    st.highlightQueue.push({
      id: uuid(),
      roomId,
      userId: 'u_youssef',
      displayName: 'يوسف المنصوري',
      username: 'youssef',
      vipTier: 1,
      rankId: 'soldier',
      avatarColor: '#27272A',
      avatarInitials: 'يم',
      text: 'تحية كبيرة لفريق الإخراج والصوت الليلة 🔥🎙️',
      durationSec: 10,
      createdAt: now,
    });
    this.promoteNext(roomId);
    this.emitRoomState(roomId);
    return this.getPublicState(roomId);
  }

  sendGift(roomId: string, user: UserProfile, giftName: string, giftValueEgp: number) {
    const st = this.ensureRoom(roomId);
    const platformShare = Math.round(giftValueEgp * (st.platformCutPct / 100));
    const creatorShare = giftValueEgp - platformShare;

    st.totalGiftsEgp += giftValueEgp;
    db.prepare('UPDATE live_rooms SET total_gifts_egp = ? WHERE id = ?').run(st.totalGiftsEgp, roomId);

    const roomRow = db.prepare('SELECT host_id FROM live_rooms WHERE id = ?').get(roomId) as { host_id: string } | undefined;
    const hostId = roomRow?.host_id || 'u_mariam';

    db.prepare(`
      INSERT INTO ledger_entries (id, user_id, debit_account, credit_account, amount_egp, category, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), user.id, `wallet:${user.id}:egp`, `creator:${hostId}:earnings`, creatorShare, 'gift_creator_share', `هدية بث "${giftName}"`);

    db.prepare(`
      INSERT INTO ledger_entries (id, user_id, debit_account, credit_account, amount_egp, category, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), user.id, `wallet:${user.id}:egp`, 'revenue:lm:gift_commission', platformShare, 'gift_platform_fee', `عمولة هدية "${giftName}"`);

    db.prepare('UPDATE users SET creator_earnings_egp = creator_earnings_egp + ? WHERE id = ?').run(creatorShare, hostId);

    const msg: LiveChatMessage = {
      id: uuid(),
      roomId,
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      vipTier: 0,
      rankId: 'soldier',
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      text: `أرسل ${giftName}`,
      isGift: true,
      giftName,
      giftValueEgp,
      createdAt: Date.now(),
    };
    st.recentMessages.push(msg);
    this.emitRoomState(roomId);
    if (this.broadcaster) {
      this.broadcaster('live:gift', {
        roomId,
        sender: user.displayName,
        giftName,
        giftValueEgp,
        creatorShare,
        platformShare,
      });
    }
    return { ok: true, creatorShare, platformShare, totalGiftsEgp: st.totalGiftsEgp };
  }

  moderate(roomId: string, action: 'delete_active' | 'toggle_highlights' | 'ban_user' | 'unban_user' | 'set_cooldown', payload?: { userId?: string; cooldownSec?: number }) {
    const st = this.ensureRoom(roomId);
    if (action === 'delete_active') {
      st.activeHighlight = null;
      this.promoteNext(roomId);
    } else if (action === 'toggle_highlights') {
      st.highlightsEnabled = !st.highlightsEnabled;
      db.prepare('UPDATE live_rooms SET highlights_enabled = ? WHERE id = ?').run(st.highlightsEnabled ? 1 : 0, roomId);
    } else if (action === 'ban_user' && payload?.userId) {
      st.bannedUsers.add(payload.userId);
      if (st.activeHighlight?.userId === payload.userId) {
        st.activeHighlight = null;
        this.promoteNext(roomId);
      }
      st.highlightQueue = st.highlightQueue.filter(h => h.userId !== payload.userId);
    } else if (action === 'unban_user' && payload?.userId) {
      st.bannedUsers.delete(payload.userId);
    } else if (action === 'set_cooldown' && typeof payload?.cooldownSec === 'number') {
      st.cooldownSec = Math.max(5, Math.min(120, payload.cooldownSec));
      db.prepare('UPDATE live_rooms SET cooldown_sec = ? WHERE id = ?').run(st.cooldownSec, roomId);
    }
    this.emitRoomState(roomId);
    return this.getPublicState(roomId);
  }
}

export const liveEngine = new LiveBroadcastEngine();
