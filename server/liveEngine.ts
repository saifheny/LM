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
  likesCount: number;
}

const ROOM_SEED_CHATS: Record<
  string,
  {
    initialLikes: number;
    messages: Array<{ userId: string; displayName: string; username: string; initials: string; text: string }>;
  }
> = {
  live_1: {
    initialLikes: 1420,
    messages: [
      { userId: 'u_nour', displayName: 'نور حسن', username: 'nour', initials: 'نح', text: 'الأجواء من الزمالك الليلة هادية وجميلة جدًا' },
      { userId: 'u_omar', displayName: 'عمر طارق', username: 'omar', initials: 'عط', text: 'الإضاءة الليلية في الكادر طالعة سينمائية بجد' },
      { userId: 'u_karim', displayName: 'كريم فؤاد', username: 'karim', initials: 'كف', text: 'متابعين معاكي أول بأول يا مريم، بالتوفيق' },
    ],
  },
  live_2: {
    initialLikes: 980,
    messages: [
      { userId: 'u_mariam', displayName: 'مريم الشريف', username: 'mariam', initials: 'مش', text: 'عزف العود مع هدوء الليل مريح جدًا للأعصاب' },
      { userId: 'u_youssef', displayName: 'يوسف المنصوري', username: 'youssef', initials: 'يم', text: 'ممكن مقطوعة هادية تاني بعد دي؟ الصوت نقي أوي' },
      { userId: 'u_nour', displayName: 'نور حسن', username: 'nour', initials: 'نح', text: 'أحلى جلسة موسيقية على المنصة النهارده' },
    ],
  },
  live_3: {
    initialLikes: 1860,
    messages: [
      { userId: 'u_youssef', displayName: 'يوسف المنصوري', username: 'youssef', initials: 'يم', text: 'مقارنة نماذج 2026 المفتوحة والمغلقة ممتازة جدًا يا كريم' },
      { userId: 'u_omar', displayName: 'عمر طارق', username: 'omar', initials: 'عط', text: 'هل أداء WebRTC المحلي هيكفي مع الضغط العالي ولا نحتاج LiveKit؟' },
      { userId: 'u_mariam', displayName: 'مريم الشريف', username: 'mariam', initials: 'مش', text: 'يا ريت تتكلم كمان عن تحسين سرعة تحميل تطبيقات الويب على الموبايل' },
    ],
  },
  live_4: {
    initialLikes: 740,
    messages: [
      { userId: 'u_karim', displayName: 'كريم فؤاد', username: 'karim', initials: 'كف', text: 'العدسة المستخدمة في تصوير الكورنيش دي كام ملّي يا نور؟' },
      { userId: 'u_omar', displayName: 'عمر طارق', username: 'omar', initials: 'عط', text: 'انعكاس الأنوار على النيل في اللقطة الأخيرة خيالي' },
      { userId: 'u_youssef', displayName: 'يوسف المنصوري', username: 'youssef', initials: 'يم', text: 'جولة ممتعة جدًا، استمري في التصوير الليلي ده' },
    ],
  },
};

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
    likesCount: number;
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
    const seed = ROOM_SEED_CHATS[roomId];
    const now = Date.now();
    const initialMessages: LiveChatMessage[] = isUserCustomLive
      ? []
      : seed
        ? seed.messages.map((m, idx) => ({
            id: uuid(),
            roomId,
            userId: m.userId,
            displayName: m.displayName,
            username: m.username,
            vipTier: 0 as const,
            rankId: 'soldier' as const,
            avatarColor: '#27272A',
            avatarInitials: m.initials,
            text: m.text,
            createdAt: now - (seed.messages.length - idx) * 18000,
          }))
        : [];
    const dbLikes = Number(row?.likes_count || 0);
    const initialLikes = dbLikes > 0 ? dbLikes : isUserCustomLive ? 0 : (seed?.initialLikes ?? 320);

    const state = {
      activeHighlight: null as HighlightComment | null,
      highlightQueue: [] as HighlightComment[],
      recentMessages: initialMessages,
      lastHighlightByUser: new Map<string, number>(),
      bannedUsers: new Set<string>(),
      highlightsEnabled: row ? Boolean(row.highlights_enabled) : true,
      cooldownSec: row ? Number(row.cooldown_sec || 10) : 10,
      platformCutPct: row ? Number(row.platform_cut_pct || 25) : 25,
      totalGiftsEgp: row ? Number(row.total_gifts_egp || 0) : 0,
      viewersCount: row ? Number(row.viewers_count ?? (isUserCustomLive ? 1 : 4200)) : 4200,
      likesCount: initialLikes,
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
      recentMessages: st.recentMessages.slice(-250),
      highlightsEnabled: st.highlightsEnabled,
      cooldownSec: st.cooldownSec,
      bannedUserIds: Array.from(st.bannedUsers),
      platformCutPct: st.platformCutPct,
      totalGiftsEgp: st.totalGiftsEgp,
      viewersCount: st.viewersCount,
      likesCount: st.likesCount,
    };
  }

  addLikes(roomId: string, count: number) {
    const st = this.ensureRoom(roomId);
    const delta = Math.max(1, Math.min(50, Math.floor(count || 1)));
    st.likesCount += delta;
    try {
      db.prepare('UPDATE live_rooms SET likes_count = ? WHERE id = ?').run(st.likesCount, roomId);
    } catch {
      // ignore if room was transient
    }
    this.emitRoomState(roomId);
    return { ok: true, likesCount: st.likesCount };
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

  addNormalComment(
    roomId: string,
    user: UserProfile,
    text: string,
    replyTo?: { id?: string; name?: string; text?: string }
  ) {
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
      replyToId: replyTo?.id ? String(replyTo.id).slice(0, 64) : undefined,
      replyToName: replyTo?.name ? String(replyTo.name).trim().slice(0, 60) : undefined,
      replyToText: replyTo?.text ? String(replyTo.text).trim().slice(0, 120) : undefined,
      createdAt: Date.now(),
    };
    st.recentMessages.push(msg);
    if (st.recentMessages.length > 250) st.recentMessages.shift();
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
