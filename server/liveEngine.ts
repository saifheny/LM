import { v4 as uuid } from 'uuid';
import { db } from './db.ts';
import { HighlightComment, LiveChatMessage, UserProfile } from './types.ts';

const BANNED_WORDS = [
  'تهديد', 'أقتلك', 'هقتلك', 'شتيمة', 'حقير', 'غبي جدا', 'سافل', 'كذاب نصاب',
  'kill you', 'threat', 'harass', 'scam idiot', 'hate speech', 'abuse'
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
    const state = {
      activeHighlight: null as HighlightComment | null,
      highlightQueue: [] as HighlightComment[],
      recentMessages: [
        {
          id: uuid(),
          roomId,
          userId: 'u_nour',
          displayName: 'نور حسن',
          username: 'nour',
          vipTier: 5 as const,
          rankId: 'sergeant' as const,
          avatarColor: '#F59E0B',
          avatarInitials: 'نح',
          text: 'الصوت والصورة ممتازين جدًا! متحمسين لتجربة التعليقات المميزة.',
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
          avatarColor: '#64748B',
          avatarInitials: 'عط',
          text: 'أول مرة أشوف بث مباشر سريع كده ومنظم بدون زحمة!',
          createdAt: Date.now() - 20000,
        },
      ] as LiveChatMessage[],
      lastHighlightByUser: new Map<string, number>(),
      bannedUsers: new Set<string>(),
      highlightsEnabled: row ? Boolean(row.highlights_enabled) : true,
      cooldownSec: row ? Number(row.cooldown_sec || 15) : 15,
      platformCutPct: row ? Number(row.platform_cut_pct || 25) : 25,
      totalGiftsEgp: row ? Number(row.total_gifts_egp || 0) : 0,
      viewersCount: row ? Number(row.viewers_count || 1200) : 1200,
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
        return {
          ok: false,
          reason: 'تم رفض التعليق تلقائيًا بواسطة نظام الفحص المسبق لاحتوائه على محتوى مخالف أو مسيء.',
        };
      }
    }
    if (!text.trim() || text.trim().length > 240) {
      return { ok: false, reason: 'يجب أن يكون التعليق بين 1 و240 حرفًا.' };
    }
    return { ok: true };
  }

  private sortQueue(queue: HighlightComment[]) {
    // Priority: VIP 1 (1) > VIP 2 (2) > VIP 3 (3), then FIFO (createdAt ASC)
    queue.sort((a, b) => {
      if (a.vipTier !== b.vipTier) return a.vipTier - b.vipTier;
      return a.createdAt - b.createdAt;
    });
  }

  private promoteNext(roomId: string) {
    const st = this.ensureRoom(roomId);
    if (st.activeHighlight || st.highlightQueue.length === 0) return;
    this.sortQueue(st.highlightQueue);
    const next = st.highlightQueue.shift()!;
    const now = Date.now();
    next.startedAt = now;
    next.expiresAt = now + next.durationSec * 1000;
    st.activeHighlight = next;
  }

  addNormalComment(roomId: string, user: UserProfile, text: string) {
    const st = this.ensureRoom(roomId);
    if (st.bannedUsers.has(user.id)) {
      return { ok: false, error: 'قام صاحب البث بمنعك من التعليق في هذا البث.' };
    }
    const mod = this.checkModeration(text);
    if (!mod.ok) return { ok: false, error: mod.reason };

    const msg: LiveChatMessage = {
      id: uuid(),
      roomId,
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      vipTier: user.vipTier,
      rankId: user.rankId,
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
      return { ok: false, error: 'قام صاحب البث بتعطيل خاصية التعليقات المميزة مؤقتًا.' };
    }
    if (st.bannedUsers.has(user.id)) {
      return { ok: false, error: 'تم منعك من استخدام التعليقات المميزة بواسطة صاحب البث.' };
    }
    if (user.vipTier !== 1 && user.vipTier !== 2 && user.vipTier !== 3) {
      return {
        ok: false,
        error: 'التعليقات المميزة متاحة حصريًا لمستويات VIP 3 (5ث) وVIP 2 (10ث) وVIP 1 (15ث). يمكنك التعليق بشكل عادي.',
      };
    }

    const now = Date.now();
    const lastSent = st.lastHighlightByUser.get(user.id) || 0;
    const elapsedSec = (now - lastSent) / 1000;
    if (!bypassCooldown && elapsedSec < st.cooldownSec) {
      const remaining = Math.ceil(st.cooldownSec - elapsedSec);
      return {
        ok: false,
        error: `يرجى الانتظار ${remaining} ثانية قبل إرسال تعليق مميز جديد (فترة الانتظار المفعلة: ${st.cooldownSec} ثانية).`,
        cooldownRemaining: remaining,
      };
    }

    const mod = this.checkModeration(text);
    if (!mod.ok) return { ok: false, error: mod.reason };

    const durationMap: Record<1 | 2 | 3, 15 | 10 | 5> = { 1: 15, 2: 10, 3: 5 };
    const highlight: HighlightComment = {
      id: uuid(),
      roomId,
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      vipTier: user.vipTier,
      rankId: user.rankId,
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      text: text.trim(),
      durationSec: durationMap[user.vipTier],
      createdAt: now,
    };

    st.lastHighlightByUser.set(user.id, now);
    st.highlightQueue.push(highlight);
    this.sortQueue(st.highlightQueue);
    this.promoteNext(roomId);

    // Also record in chat feed for continuity
    st.recentMessages.push({
      id: uuid(),
      roomId,
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      vipTier: user.vipTier,
      rankId: user.rankId,
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      text: `★ [تعليق مميز ${highlight.durationSec}ث] ${highlight.text}`,
      createdAt: now,
    });

    this.emitRoomState(roomId);
    return { ok: true, highlight, queuePosition: st.activeHighlight?.id === highlight.id ? 0 : st.highlightQueue.findIndex(h => h.id === highlight.id) + 1 };
  }

  simulatePriorityBurst(roomId: string) {
    const st = this.ensureRoom(roomId);
    if (!st.highlightsEnabled) st.highlightsEnabled = true;
    const now = Date.now();

    // Arrives 1st: VIP 3 (5s) -> should go AFTER VIP 1 & VIP 2!
    const h3: HighlightComment = {
      id: uuid(),
      roomId,
      userId: 'u_mariam',
      displayName: 'مريم الشريف',
      username: 'mariam',
      vipTier: 3,
      rankId: 'general',
      avatarColor: '#10B981',
      avatarInitials: 'مش',
      text: 'وصلت أولًا كـ VIP 3 (مدة 5 ثوانٍ) — شاهد كيف سيتقدمني VIP 1 وVIP 2 حسب نظام الأولوية!',
      durationSec: 5,
      createdAt: now,
    };
    // Arrives 2nd: VIP 2 (10s) -> Priority #2
    const h2: HighlightComment = {
      id: uuid(),
      roomId,
      userId: 'u_karim',
      displayName: 'كريم فؤاد',
      username: 'karim',
      vipTier: 2,
      rankId: 'prince',
      avatarColor: '#2F6BFF',
      avatarInitials: 'كف',
      text: 'تعليق VIP 2 (مدة 10 ثوانٍ) — أولوية رقم 2 مباشرة بعد VIP 1 وقبل VIP 3.',
      durationSec: 10,
      createdAt: now + 10,
    };
    // Arrives 3rd: VIP 1 (15s) -> Priority #1
    const h1: HighlightComment = {
      id: uuid(),
      roomId,
      userId: 'u_youssef',
      displayName: 'يوسف المنصوري',
      username: 'youssef',
      vipTier: 1,
      rankId: 'emperor',
      avatarColor: '#D4AF37',
      avatarInitials: 'يم',
      text: 'تعليق VIP 1 الإمبراطور (مدة 15 ثانية) — الأولوية القصوى رقم 1 تتصدر الطابور فورًا!',
      durationSec: 15,
      createdAt: now + 20,
    };

    st.highlightQueue.push(h3, h2, h1);
    this.sortQueue(st.highlightQueue);
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

    // Record in sandbox double-entry ledger
    const roomRow = db.prepare('SELECT host_id FROM live_rooms WHERE id = ?').get(roomId) as { host_id: string } | undefined;
    const hostId = roomRow?.host_id || 'u_mariam';

    db.prepare(`
      INSERT INTO ledger_entries (id, user_id, debit_account, credit_account, amount_egp, category, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), user.id, `wallet:${user.id}:egp`, `creator:${hostId}:earnings`, creatorShare, 'gift_creator_share', `هدية بث "${giftName}" — حصة صانع المحتوى (${100 - st.platformCutPct}%)`);

    db.prepare(`
      INSERT INTO ledger_entries (id, user_id, debit_account, credit_account, amount_egp, category, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), user.id, `wallet:${user.id}:egp`, 'revenue:lm:gift_commission', platformShare, 'gift_platform_fee', `هدية بث "${giftName}" — عمولة منصة LM (${st.platformCutPct}%)`);

    db.prepare('UPDATE users SET creator_earnings_egp = creator_earnings_egp + ? WHERE id = ?').run(creatorShare, hostId);

    const msg: LiveChatMessage = {
      id: uuid(),
      roomId,
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      vipTier: user.vipTier,
      rankId: user.rankId,
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      text: `أرسل هدية "${giftName}" بقيمة ${giftValueEgp.toLocaleString('en-US')} ج.م (${100 - st.platformCutPct}% لصانع المحتوى / ${st.platformCutPct}% لـ LM)`,
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
