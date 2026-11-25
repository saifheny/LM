import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { GoogleGenAI } from '@google/genai';

import { db, initDatabase, mapUserRow, loadProviderConfig, saveProviderConfig, UPLOADS_DIR } from './db.ts';
import { liveEngine } from './liveEngine.ts';
import { runLmAi } from './aiGateway.ts';
import {
  MARKETS,
  VIP_PLANS,
  PRIORITY_SUPPORT_EGP,
  AD_REMOVAL_PLANS,
  AI_PLANS,
  RANKS,
  localizePrice,
  evaluateResidencyPolicy,
} from './pricingEngine.ts';
import { CountryCode, RankId, ThemeId, VipTier, AiTierId } from './types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
initDatabase();

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 10) || '.bin';
    cb(null, `${Date.now()}-${uuid().slice(0, 8)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 80 * 1024 * 1024 } });

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set<WebSocket>();

function broadcast(event: string, payload: unknown) {
  const frame = JSON.stringify({ event, payload, ts: Date.now() });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(frame);
    }
  }
}

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ event: 'system:connected', payload: { status: 'online' }, ts: Date.now() }));
  ws.on('close', () => wsClients.delete(ws));
});

liveEngine.setBroadcaster(broadcast);
liveEngine.startTicker();

function getUserOrNull(id: string) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapUserRow(row) : null;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'LM Super App Local Core v2', wsClients: wsClients.size });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'لم يتم إرسال أي ملف.' });
  res.json({
    ok: true,
    url: `/uploads/${req.file.filename}`,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

// ============================================================
// AUTH & USERS
// ============================================================
app.get('/api/auth/users', (_req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY vip_tier = 0, vip_tier ASC').all() as Array<Record<string, unknown>>;
  res.json({ ok: true, users: rows.map(mapUserRow) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username) return res.status(400).json({ ok: false, error: 'أدخل اسم المستخدم.' });
  const clean = username.trim().replace(/^@/, '').toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(clean) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'الحساب غير موجود.' });
  if (password && String(row.password) !== password) {
    return res.status(401).json({ ok: false, error: 'كلمة المرور غير صحيحة (كلمة المرور التجريبية: 123456).' });
  }
  res.json({ ok: true, user: mapUserRow(row) });
});

app.post('/api/auth/register', (req, res) => {
  const { username, displayName, password, country } = req.body as {
    username?: string;
    displayName?: string;
    password?: string;
    country?: CountryCode;
  };
  if (!username || !displayName) return res.status(400).json({ ok: false, error: 'الاسم واسم المستخدم مطلوبان.' });
  const cleanUser = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUser.length < 3) return res.status(400).json({ ok: false, error: 'اسم المستخدم 3 أحرف على الأقل.' });
  const exists = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUser);
  if (exists) return res.status(409).json({ ok: false, error: 'اسم المستخدم مسجل بالفعل.' });

  const id = `u_${uuid().slice(0, 8)}`;
  const palette = ['#3390EC', '#10B981', '#D4AF37', '#F59E0B', '#E11D48', '#8774E1'];
  const color = palette[Math.floor(Math.random() * palette.length)];
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('') || 'LM';

  db.prepare(`
    INSERT INTO users (id, username, password, display_name, display_name_en, bio, avatar_color, avatar_initials, country, demo_balance_egp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, cleanUser, password || '123456', displayName.trim(), displayName.trim(), 'عضو جديد في منصة LM.', color, initials, country || 'EG', 5000);

  res.json({ ok: true, user: getUserOrNull(id) });
});

app.get('/api/users/:id', (req, res) => {
  const user = getUserOrNull(req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });
  res.json({ ok: true, user });
});

// ============================================================
// SEARCH
// ============================================================
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = `%${q}%`;
  const users = (db.prepare(
    'SELECT * FROM users WHERE display_name LIKE ? OR display_name_en LIKE ? OR username LIKE ? OR bio LIKE ? LIMIT 8'
  ).all(like, like, like, like) as Array<Record<string, unknown>>).map(mapUserRow);

  const posts = db.prepare(`
    SELECT p.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.vip_tier
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.content LIKE ? OR u.display_name LIKE ?
    ORDER BY p.created_at DESC LIMIT 8
  `).all(like, like);

  const videos = db.prepare(`
    SELECT v.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.vip_tier
    FROM short_videos v JOIN users u ON v.user_id = u.id
    WHERE v.title LIKE ? OR v.description LIKE ? OR v.tags LIKE ?
    ORDER BY v.views_count DESC LIMIT 8
  `).all(like, like, like);

  const groups = db.prepare(
    'SELECT * FROM conversations WHERE type != ? AND (title LIKE ? OR description LIKE ?) LIMIT 8'
  ).all('dm', like, like);

  res.json({ ok: true, users, posts, videos, groups });
});

// ============================================================
// STORIES & SOCIAL FEED (Instagram / Pixelfed Grade)
// ============================================================
app.get('/api/stories', (_req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.vip_tier
    FROM stories s JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  res.json({
    ok: true,
    stories: rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      displayName: r.display_name,
      username: r.username,
      avatarColor: r.avatar_color,
      avatarInitials: r.avatar_initials,
      avatarUrl: r.avatar_url,
      vipTier: Number(r.vip_tier),
      mediaUrl: r.media_url,
      caption: r.caption,
      createdAt: r.created_at,
    })),
  });
});

app.get('/api/posts', (req, res) => {
  const viewerId = String(req.query.userId || '');
  const rows = db.prepare(`
    SELECT p.*, u.display_name, u.display_name_en, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified, u.vip_tier, u.rank_id, u.supreme_title
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  const likedRows = viewerId
    ? (db.prepare('SELECT post_id FROM post_likes WHERE user_id = ?').all(viewerId) as Array<{ post_id: string }>)
    : [];
  const likedSet = new Set(likedRows.map(r => r.post_id));

  const posts = rows.map(r => {
    let mediaUrls: string[] = [];
    try {
      mediaUrls = JSON.parse(String(r.media_urls_json || '[]'));
    } catch {
      mediaUrls = [];
    }
    if (mediaUrls.length === 0 && r.media_url) mediaUrls = [String(r.media_url)];
    return {
      id: r.id,
      userId: r.user_id,
      displayName: r.display_name,
      username: r.username,
      avatarColor: r.avatar_color,
      avatarInitials: r.avatar_initials,
      avatarUrl: r.avatar_url,
      verified: Boolean(r.verified),
      vipTier: Number(r.vip_tier),
      rankId: r.rank_id,
      supremeTitle: r.supreme_title,
      content: r.content,
      mediaUrl: r.media_url,
      mediaUrls,
      location: r.location || 'القاهرة',
      mediaStyle: r.media_style,
      mediaCaption: r.media_caption,
      isSponsored: Boolean(r.is_sponsored),
      sponsorBudgetEgp: Number(r.sponsor_budget_egp || 0),
      sponsorAudience: r.sponsor_audience,
      likesCount: Number(r.likes_count),
      commentsCount: Number(r.comments_count),
      sharesCount: Number(r.shares_count),
      likedByMe: likedSet.has(String(r.id)),
      createdAt: r.created_at,
    };
  });
  res.json({ ok: true, posts });
});

app.post('/api/posts', (req, res) => {
  const { userId, content, mediaUrl, isSponsored, sponsorBudgetEgp, sponsorAudience } = req.body as {
    userId: string;
    content: string;
    mediaUrl?: string;
    isSponsored?: boolean;
    sponsorBudgetEgp?: number;
    sponsorAudience?: string;
  };
  if (!userId || !content?.trim()) return res.status(400).json({ ok: false, error: 'محتوى المنشور مطلوب.' });
  const id = `p_${uuid().slice(0, 8)}`;
  const urlsJson = mediaUrl ? JSON.stringify([mediaUrl]) : '[]';
  db.prepare(`
    INSERT INTO posts (id, user_id, content, media_url, media_urls_json, is_sponsored, sponsor_budget_egp, sponsor_audience)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, content.trim(), mediaUrl || null, urlsJson, isSponsored ? 1 : 0, sponsorBudgetEgp || 0, sponsorAudience || null);
  broadcast('social:new_post', { id });
  res.json({ ok: true, id });
});

app.post('/api/posts/:id/like', (req, res) => {
  const { userId } = req.body as { userId: string };
  const postId = req.params.id;
  const existing = db.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?').get(postId, userId);
  if (existing) {
    db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(postId, userId);
    db.prepare('UPDATE posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(postId);
    res.json({ ok: true, liked: false });
  } else {
    db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').run(postId, userId);
    db.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?').run(postId);
    res.json({ ok: true, liked: true });
  }
});

app.get('/api/posts/:id/comments', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.vip_tier
    FROM post_comments c JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ? ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json({ ok: true, comments: rows });
});

app.post('/api/posts/:id/comments', (req, res) => {
  const { userId, content } = req.body as { userId: string; content: string };
  if (!content?.trim()) return res.status(400).json({ ok: false, error: 'اكتب تعليقًا.' });
  const id = `pc_${uuid().slice(0, 8)}`;
  db.prepare('INSERT INTO post_comments (id, post_id, user_id, content) VALUES (?, ?, ?, ?)').run(id, req.params.id, userId, content.trim());
  db.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true, id });
});

app.post('/api/posts/:id/promote', (req, res) => {
  const { budgetEgp, audience } = req.body as { budgetEgp?: number; audience?: string };
  db.prepare('UPDATE posts SET is_sponsored = 1, sponsor_budget_egp = ?, sponsor_audience = ? WHERE id = ?')
    .run(budgetEgp || 500, audience || 'الجمهور العام — مصر', req.params.id);
  res.json({ ok: true });
});

// ============================================================
// SHORT VIDEOS (TikTok / Loops Open-Source Architecture)
// ============================================================
app.get('/api/videos', (req, res) => {
  const viewerId = String(req.query.userId || '');
  const rows = db.prepare(`
    SELECT v.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified, u.vip_tier, u.rank_id
    FROM short_videos v JOIN users u ON v.user_id = u.id
    ORDER BY v.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  const likes = new Set((viewerId ? db.prepare('SELECT video_id FROM video_likes WHERE user_id = ?').all(viewerId) as Array<{ video_id: string }> : []).map(r => r.video_id));
  const saves = new Set((viewerId ? db.prepare('SELECT video_id FROM video_saves WHERE user_id = ?').all(viewerId) as Array<{ video_id: string }> : []).map(r => r.video_id));

  res.json({
    ok: true,
    videos: rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      displayName: r.display_name,
      username: r.username,
      avatarColor: r.avatar_color,
      avatarInitials: r.avatar_initials,
      avatarUrl: r.avatar_url,
      verified: Boolean(r.verified),
      vipTier: Number(r.vip_tier),
      rankId: r.rank_id,
      title: r.title,
      description: r.description,
      tags: r.tags,
      audioTitle: r.audio_title || 'الصوت الأصلي — LM Studio',
      videoUrl: r.video_url,
      posterUrl: r.poster_url,
      scenePreset: r.scene_preset,
      durationSec: Number(r.duration_sec),
      isSponsored: Boolean(r.is_sponsored),
      sponsorBudgetEgp: Number(r.sponsor_budget_egp || 0),
      likesCount: Number(r.likes_count),
      commentsCount: Number(r.comments_count),
      savesCount: Number(r.saves_count),
      sharesCount: Number(r.shares_count || 0),
      viewsCount: Number(r.views_count),
      likedByMe: likes.has(String(r.id)),
      savedByMe: saves.has(String(r.id)),
      createdAt: r.created_at,
    })),
  });
});

app.post('/api/videos', (req, res) => {
  const { userId, title, description, tags, videoUrl, isSponsored, sponsorBudgetEgp } = req.body as {
    userId: string;
    title: string;
    description: string;
    tags?: string;
    videoUrl?: string;
    isSponsored?: boolean;
    sponsorBudgetEgp?: number;
  };
  if (!userId || !title?.trim()) return res.status(400).json({ ok: false, error: 'عنوان الفيديو مطلوب.' });
  const id = `v_${uuid().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO short_videos (id, user_id, title, description, tags, video_url, is_sponsored, sponsor_budget_egp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title.trim(), (description || '').trim(), tags || '#LM', videoUrl || '/uploads/seed/reel1.mp4', isSponsored ? 1 : 0, sponsorBudgetEgp || 0);
  res.json({ ok: true, id });
});

app.post('/api/videos/:id/like', (req, res) => {
  const { userId } = req.body as { userId: string };
  const exists = db.prepare('SELECT 1 FROM video_likes WHERE video_id = ? AND user_id = ?').get(req.params.id, userId);
  if (exists) {
    db.prepare('DELETE FROM video_likes WHERE video_id = ? AND user_id = ?').run(req.params.id, userId);
    db.prepare('UPDATE short_videos SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(req.params.id);
    res.json({ ok: true, liked: false });
  } else {
    db.prepare('INSERT INTO video_likes (video_id, user_id) VALUES (?, ?)').run(req.params.id, userId);
    db.prepare('UPDATE short_videos SET likes_count = likes_count + 1 WHERE id = ?').run(req.params.id);
    res.json({ ok: true, liked: true });
  }
});

app.post('/api/videos/:id/save', (req, res) => {
  const { userId } = req.body as { userId: string };
  const exists = db.prepare('SELECT 1 FROM video_saves WHERE video_id = ? AND user_id = ?').get(req.params.id, userId);
  if (exists) {
    db.prepare('DELETE FROM video_saves WHERE video_id = ? AND user_id = ?').run(req.params.id, userId);
    db.prepare('UPDATE short_videos SET saves_count = MAX(0, saves_count - 1) WHERE id = ?').run(req.params.id);
    res.json({ ok: true, saved: false });
  } else {
    db.prepare('INSERT INTO video_saves (video_id, user_id) VALUES (?, ?)').run(req.params.id, userId);
    db.prepare('UPDATE short_videos SET saves_count = saves_count + 1 WHERE id = ?').run(req.params.id);
    res.json({ ok: true, saved: true });
  }
});

app.get('/api/videos/:id/comments', (req, res) => {
  const viewerId = String(req.query.userId || '');
  const rows = db.prepare(`
    SELECT c.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.vip_tier
    FROM video_comments c JOIN users u ON c.user_id = u.id
    WHERE c.video_id = ? ORDER BY c.rowid ASC
  `).all(req.params.id) as Array<Record<string, unknown>>;

  const comments = rows.map(r => {
    let likedBy: string[] = [];
    try { likedBy = JSON.parse(String(r.liked_by_json || '[]')); } catch { likedBy = []; }
    return {
      id: r.id,
      videoId: r.video_id,
      userId: r.user_id,
      parentId: r.parent_id ? String(r.parent_id) : null,
      displayName: r.display_name,
      username: r.username,
      avatarColor: r.avatar_color,
      avatarInitials: r.avatar_initials,
      avatarUrl: r.avatar_url,
      vipTier: Number(r.vip_tier || 0),
      content: r.content || '',
      audioUrl: r.audio_url ? String(r.audio_url) : null,
      audioDurationSec: Number(r.audio_duration_sec || 6),
      transcript: r.transcript ? String(r.transcript) : null,
      likesCount: Number(r.likes_count || 0),
      likedByMe: viewerId ? likedBy.includes(viewerId) : false,
      createdAt: r.created_at || 'الآن',
    };
  });
  res.json({ ok: true, comments });
});

app.post('/api/videos/:id/comments', (req, res) => {
  const { userId, content, parentId, audioUrl, audioDurationSec, transcript } = req.body as {
    userId: string;
    content?: string;
    parentId?: string | null;
    audioUrl?: string | null;
    audioDurationSec?: number;
    transcript?: string | null;
  };
  if (!content?.trim() && !audioUrl) return res.status(400).json({ ok: false, error: 'أضف تعليقًا نصيًا أو صوتيًا.' });
  const id = `vc_${uuid().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO video_comments (id, video_id, user_id, parent_id, content, audio_url, audio_duration_sec, transcript, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.params.id, userId, parentId || null, (content || '').trim(),
    audioUrl || null, Number(audioDurationSec || 5), transcript || (audioUrl ? 'رد صوتي مسجّل بتقنية LM Voice' : null), 'الآن'
  );
  db.prepare('UPDATE short_videos SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true, id });
});

app.post('/api/video-comments/:commentId/like', (req, res) => {
  const { userId } = req.body as { userId: string };
  const row = db.prepare('SELECT likes_count, liked_by_json FROM video_comments WHERE id = ?').get(req.params.commentId) as { likes_count: number; liked_by_json: string } | undefined;
  if (!row) return res.status(404).json({ ok: false });
  let likedBy: string[] = [];
  try { likedBy = JSON.parse(row.liked_by_json || '[]'); } catch { likedBy = []; }
  let count = Number(row.likes_count || 0);
  if (likedBy.includes(userId)) {
    likedBy = likedBy.filter(x => x !== userId);
    count = Math.max(0, count - 1);
  } else {
    likedBy.push(userId);
    count += 1;
  }
  db.prepare('UPDATE video_comments SET likes_count = ?, liked_by_json = ? WHERE id = ?').run(count, JSON.stringify(likedBy), req.params.commentId);
  res.json({ ok: true, likesCount: count, liked: likedBy.includes(userId) });
});

app.post('/api/videos/:id/promote', (req, res) => {
  const { budgetEgp } = req.body as { budgetEgp?: number };
  db.prepare('UPDATE short_videos SET is_sponsored = 1, sponsor_budget_egp = ? WHERE id = ?').run(budgetEgp || 800, req.params.id);
  res.json({ ok: true });
});

// ============================================================
// TELEGRAM-GRADE MESSAGING (Folders, Replies, Reactions, Waveforms)
// ============================================================
app.get('/api/conversations', (_req, res) => {
  const convs = db.prepare('SELECT * FROM conversations ORDER BY is_pinned DESC, created_at DESC').all() as Array<Record<string, unknown>>;
  const enriched = convs.map(c => {
    const last = db.prepare('SELECT content, created_at, msg_type FROM messages WHERE conversation_id = ? ORDER BY rowid DESC LIMIT 1').get(String(c.id)) as Record<string, unknown> | undefined;
    return {
      id: c.id,
      type: c.type,
      folder: c.folder || 'personal',
      title: c.title,
      description: c.description,
      avatarColor: c.avatar_color,
      avatarUrl: c.avatar_url,
      onlineText: c.online_text || 'متصل الآن',
      pinnedMessage: c.pinned_message,
      isPinned: Boolean(c.is_pinned),
      unreadCount: Number(c.unread_count || 0),
      isLargeGroup: Boolean(c.is_large_group),
      isEncrypted: Boolean(c.is_encrypted),
      memberCount: Number(c.member_count),
      lastMessage: last ? String(last.content) : '',
      lastMessageAt: last ? String(last.created_at) : 'الآن',
    };
  });
  res.json({ ok: true, conversations: enriched });
});

app.post('/api/conversations', (req, res) => {
  const { title, type, description, isLargeGroup } = req.body as {
    title: string;
    type?: 'dm' | 'group' | 'community';
    description?: string;
    isLargeGroup?: boolean;
  };
  if (!title?.trim()) return res.status(400).json({ ok: false, error: 'اسم المحادثة مطلوب.' });
  const id = `c_${uuid().slice(0, 8)}`;
  const folder = type === 'community' ? 'channels' : type === 'group' ? 'groups' : 'personal';
  db.prepare(`
    INSERT INTO conversations (id, type, folder, title, description, avatar_color, is_large_group, is_encrypted, member_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type || 'group', folder, title.trim(), description || 'مجموعة جديدة على LM', '#8774E1', isLargeGroup ? 1 : 0, type === 'community' ? 0 : 1, isLargeGroup ? 1500 : 5);
  res.json({ ok: true, id });
});

app.get('/api/conversations/:id/messages', (req, res) => {
  db.prepare('UPDATE conversations SET unread_count = 0 WHERE id = ?').run(req.params.id);
  const rows = db.prepare(`
    SELECT m.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.vip_tier
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.rowid ASC
  `).all(req.params.id) as Array<Record<string, unknown>>;

  res.json({
    ok: true,
    messages: rows.map(r => {
      let reactions: Record<string, string[]> = {};
      try {
        reactions = JSON.parse(String(r.reactions_json || '{}'));
      } catch {
        reactions = {};
      }
      return {
        id: r.id,
        conversationId: r.conversation_id,
        senderId: r.sender_id,
        displayName: r.sender_id === 'lm_ai' ? 'LM AI' : (r.display_name || 'مستخدم'),
        username: r.sender_id === 'lm_ai' ? 'lm_ai' : (r.username || 'user'),
        avatarColor: r.sender_id === 'lm_ai' ? '#10B981' : (r.avatar_color || '#3390EC'),
        avatarInitials: r.sender_id === 'lm_ai' ? 'AI' : (r.avatar_initials || 'LM'),
        avatarUrl: r.sender_id === 'lm_ai' ? null : (r.avatar_url ? String(r.avatar_url) : null),
        vipTier: Number(r.vip_tier || 0),
        content: r.content,
        msgType: r.msg_type,
        mediaUrl: r.media_url,
        transcript: r.transcript ? String(r.transcript) : null,
        sendEffect: r.send_effect ? String(r.send_effect) : null,
        isSpoiler: Boolean(r.is_spoiler),
        kineticStyle: r.kinetic_style ? String(r.kinetic_style) : null,
        meta: r.meta_json ? (() => { try { return JSON.parse(String(r.meta_json)); } catch { return null; } })() : null,
        replyToId: r.reply_to_id ? String(r.reply_to_id) : null,
        replySender: r.reply_sender ? String(r.reply_sender) : null,
        replyText: r.reply_text ? String(r.reply_text) : null,
        reactions,
        aiConsentRef: r.ai_consent_ref,
        createdAt: r.created_at,
      };
    }),
  });
});

app.post('/api/conversations/:id/messages', async (req, res) => {
  const {
    senderId, content, msgType, mediaUrl, transcript, sendEffect,
    isSpoiler, kineticStyle, meta, replyToId, replySender, replyText, invokeAi, sharedSnippet,
  } = req.body as {
    senderId: string;
    content: string;
    msgType?: string;
    mediaUrl?: string;
    transcript?: string;
    sendEffect?: string;
    isSpoiler?: boolean;
    kineticStyle?: string;
    meta?: Record<string, unknown>;
    replyToId?: string;
    replySender?: string;
    replyText?: string;
    invokeAi?: boolean;
    sharedSnippet?: string;
  };
  if (!senderId || (!content?.trim() && !mediaUrl)) {
    return res.status(400).json({ ok: false, error: 'الرسالة فارغة.' });
  }
  const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const msgId = `m_${uuid().slice(0, 8)}`;

  // Server-generated fair random result for Telegram mini-games (dice / slot / target)
  let finalMeta = meta || null;
  if (msgType === 'game_dice') {
    const game = String(meta?.game || content || 'dice');
    if (game === 'dice') {
      finalMeta = { game: 'dice', result: Math.floor(Math.random() * 6) + 1 };
    } else if (game === 'slot') {
      const syms = ['💎', '👑', '⚡', '🔥', '7️⃣'];
      const jackpot = Math.random() < 0.28;
      const pick = syms[Math.floor(Math.random() * syms.length)];
      finalMeta = {
        game: 'slot',
        reels: jackpot
          ? [pick, pick, pick]
          : [syms[Math.floor(Math.random() * syms.length)], syms[Math.floor(Math.random() * syms.length)], syms[Math.floor(Math.random() * syms.length)]],
        jackpot,
      };
    } else {
      const score = [100, 95, 80, 60, 40][Math.floor(Math.random() * 5)];
      finalMeta = { game: 'target', score };
    }
  }

  db.prepare(`
    INSERT INTO messages (
      id, conversation_id, sender_id, content, msg_type, media_url, transcript, send_effect,
      is_spoiler, kinetic_style, meta_json, reply_to_id, reply_sender, reply_text, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    msgId, req.params.id, senderId, (content || '').trim(), msgType || 'text', mediaUrl || null,
    transcript || (msgType === 'audio' ? 'رسالة صوتية مسجّلة بتقنية LM Voice 2026.' : null),
    sendEffect || null,
    isSpoiler ? 1 : 0,
    kineticStyle || null,
    finalMeta ? JSON.stringify(finalMeta) : null,
    replyToId || null, replySender || null, replyText || null, nowStr
  );

  broadcast('chat:message', { conversationId: req.params.id, msgId });
  if (msgType === 'interactive_emoji') {
    broadcast('chat:interactive_fx', { conversationId: req.params.id, emojiId: String(finalMeta?.emojiId || content) });
  }

  let aiReply = null;
  if (invokeAi) {
    const aiResult = await runLmAi({
      userId: senderId,
      prompt: content.replace(/@LM\s*AI/gi, '').trim() || 'لخص المحتوى المشارك.',
      source: 'chat',
      explicitUserConsent: Boolean(sharedSnippet),
      sharedContext: sharedSnippet,
    });
    const aiMsgId = `m_${uuid().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, content, msg_type, reply_to_id, reply_sender, reply_text, ai_consent_ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(aiMsgId, req.params.id, 'lm_ai', aiResult.reply, 'ai_reply', msgId, 'LM AI Shield', sharedSnippet ? sharedSnippet.slice(0, 50) : null, aiResult.securityAuditId, nowStr);
    broadcast('chat:message', { conversationId: req.params.id, msgId: aiMsgId });
    aiReply = aiResult;
  }

  res.json({ ok: true, id: msgId, aiReply });
});

app.post('/api/chat/interactive-fx', (req, res) => {
  const { conversationId, emojiId } = req.body as { conversationId: string; emojiId: string };
  broadcast('chat:interactive_fx', { conversationId, emojiId });
  res.json({ ok: true });
});

app.post('/api/messages/:id/react', (req, res) => {
  const { userId, emoji } = req.body as { userId: string; emoji: string };
  const row = db.prepare('SELECT conversation_id, reactions_json FROM messages WHERE id = ?').get(req.params.id) as { conversation_id: string; reactions_json: string } | undefined;
  if (!row) return res.status(404).json({ ok: false });

  let reactions: Record<string, string[]> = {};
  try {
    reactions = JSON.parse(row.reactions_json || '{}');
  } catch {
    reactions = {};
  }
  const current = reactions[emoji] || [];
  if (current.includes(userId)) {
    const next = current.filter(u => u !== userId);
    if (next.length === 0) delete reactions[emoji];
    else reactions[emoji] = next;
  } else {
    reactions[emoji] = [...current, userId];
  }

  db.prepare('UPDATE messages SET reactions_json = ? WHERE id = ?').run(JSON.stringify(reactions), req.params.id);
  broadcast('chat:message', { conversationId: row.conversation_id, msgId: req.params.id });
  res.json({ ok: true, reactions });
});

// ============================================================
// LIVE STREAMING & VIP HIGHLIGHTED COMMENTS ENGINE
// ============================================================
app.get('/api/live/rooms', (_req, res) => {
  const rows = db.prepare(`
    SELECT r.*, u.display_name as host_name, u.username as host_username, u.avatar_color as host_color, u.avatar_initials as host_initials, u.avatar_url as host_avatar, u.vip_tier as host_vip
    FROM live_rooms r JOIN users u ON r.host_id = u.id
    WHERE r.is_active = 1
    ORDER BY r.viewers_count DESC
  `).all() as Array<Record<string, unknown>>;

  res.json({
    ok: true,
    rooms: rows.map(r => {
      const runtime = liveEngine.getPublicState(String(r.id));
      return {
        id: r.id,
        hostId: r.host_id,
        hostName: r.host_name,
        hostUsername: r.host_username,
        hostColor: r.host_color,
        hostInitials: r.host_initials,
        hostAvatarUrl: r.host_avatar,
        hostVip: Number(r.host_vip),
        title: r.title,
        category: r.category,
        videoUrl: r.video_url,
        scenePreset: r.scene_preset,
        viewersCount: runtime.viewersCount,
        totalGiftsEgp: runtime.totalGiftsEgp,
        highlightsEnabled: runtime.highlightsEnabled,
        cooldownSec: runtime.cooldownSec,
        platformCutPct: runtime.platformCutPct,
      };
    }),
  });
});

app.get('/api/live/rooms/:id/state', (req, res) => {
  res.json({ ok: true, state: liveEngine.getPublicState(req.params.id) });
});

app.post('/api/live/rooms/:id/comment', (req, res) => {
  const { userId, text } = req.body as { userId: string; text: string };
  const user = getUserOrNull(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });
  const result = liveEngine.addNormalComment(req.params.id, user, text);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/live/rooms/:id/highlight', (req, res) => {
  const { userId, text } = req.body as { userId: string; text: string };
  const user = getUserOrNull(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });
  const result = liveEngine.submitHighlight(req.params.id, user, text);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/live/rooms/:id/simulate-burst', (req, res) => {
  const state = liveEngine.simulatePriorityBurst(req.params.id);
  res.json({ ok: true, state });
});

app.post('/api/live/rooms/:id/gift', (req, res) => {
  const { userId, giftName, giftValueEgp } = req.body as { userId: string; giftName: string; giftValueEgp: number };
  const user = getUserOrNull(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });
  const result = liveEngine.sendGift(req.params.id, user, giftName, Number(giftValueEgp || 50));
  res.json(result);
});

app.post('/api/live/rooms/:id/moderate', (req, res) => {
  const { action, userId, cooldownSec } = req.body as {
    action: 'delete_active' | 'toggle_highlights' | 'ban_user' | 'unban_user' | 'set_cooldown';
    userId?: string;
    cooldownSec?: number;
  };
  const state = liveEngine.moderate(req.params.id, action, { userId, cooldownSec });
  res.json({ ok: true, state });
});

// ============================================================
// LM AI MULTI-PROVIDER GATEWAY
// ============================================================
app.post('/api/ai/chat', async (req, res) => {
  const result = await runLmAi(req.body);
  res.json(result);
});

app.get('/api/ai/security-logs', (_req, res) => {
  const logs = db.prepare('SELECT * FROM ai_security_logs ORDER BY created_at DESC LIMIT 30').all();
  res.json({ ok: true, logs });
});

// ============================================================
// VIP, RANKS, AD REMOVAL & GEO-PRICING
// ============================================================
app.get('/api/pricing/catalog', (req, res) => {
  const country = (String(req.query.country || 'EG').toUpperCase() as CountryCode);
  const safeCountry: CountryCode = MARKETS[country] ? country : 'EG';
  res.json({
    ok: true,
    country: safeCountry,
    market: MARKETS[safeCountry],
    markets: Object.values(MARKETS),
    vipPlans: VIP_PLANS.map(p => ({ ...p, localized: localizePrice(p.egpMonthly, safeCountry) })),
    prioritySupport: { egpMonthly: PRIORITY_SUPPORT_EGP, localized: localizePrice(PRIORITY_SUPPORT_EGP, safeCountry) },
    adRemovalPlans: AD_REMOVAL_PLANS.map(p => ({ ...p, localized: localizePrice(p.egpMonthly, safeCountry) })),
    adRemovalTotal: localizePrice(205, safeCountry),
    aiPlans: AI_PLANS.map(p => ({ ...p, localized: localizePrice(p.egpMonthly, safeCountry) })),
    ranks: RANKS.map(r => ({ ...r, localized: localizePrice(r.egpPrice, safeCountry) })),
  });
});

app.post('/api/pricing/simulate-residency', (req, res) => {
  const { userId, currentCountry, targetCountry, monthsAbroad, travelExceptionActive, travelExceptionNote } = req.body as {
    userId?: string;
    currentCountry: CountryCode;
    targetCountry: CountryCode | null;
    monthsAbroad: number;
    travelExceptionActive: boolean;
    travelExceptionNote?: string;
  };
  const evaluation = evaluateResidencyPolicy({
    currentCountry,
    targetCountry,
    monthsAbroad: Number(monthsAbroad || 0),
    travelExceptionActive: Boolean(travelExceptionActive),
  });
  if (userId) {
    db.prepare(`
      UPDATE users SET country = ?, target_country = ?, months_abroad = ?, travel_exception_active = ?, travel_exception_note = ?
      WHERE id = ?
    `).run(currentCountry, targetCountry || null, Number(monthsAbroad || 0), travelExceptionActive ? 1 : 0, travelExceptionNote || null, userId);
  }
  res.json({ ok: true, evaluation, user: userId ? getUserOrNull(userId) : null });
});

app.post('/api/users/:id/activate-vip', (req, res) => {
  const { vipTier, prioritySupport, aiTier } = req.body as { vipTier?: VipTier; prioritySupport?: boolean; aiTier?: AiTierId };
  const user = getUserOrNull(req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });
  const nextVip = vipTier !== undefined ? vipTier : user.vipTier;
  const nextPriority = prioritySupport !== undefined ? prioritySupport : user.prioritySupport;
  const nextAi = aiTier !== undefined ? aiTier : user.aiTier;
  let nextAds = user.adRemoval;
  if (nextVip > 0) nextAds = { videos: true, largeGroups: true, ai: true, investment: true };

  db.prepare('UPDATE users SET vip_tier = ?, priority_support = ?, ai_tier = ?, ad_removal_json = ? WHERE id = ?')
    .run(nextVip, nextPriority ? 1 : 0, nextAi, JSON.stringify(nextAds), user.id);
  res.json({ ok: true, user: getUserOrNull(user.id) });
});

app.post('/api/users/:id/activate-rank', (req, res) => {
  const { rankId } = req.body as { rankId: RankId };
  const supreme = rankId === 'king' || rankId === 'president' || rankId === 'emperor' ? rankId : null;
  db.prepare('UPDATE users SET rank_id = ?, supreme_title = ? WHERE id = ?').run(rankId, supreme, req.params.id);
  res.json({ ok: true, user: getUserOrNull(req.params.id) });
});

app.post('/api/users/:id/ad-removal', (req, res) => {
  const { adRemoval } = req.body as { adRemoval: { videos: boolean; largeGroups: boolean; ai: boolean; investment: boolean } };
  db.prepare('UPDATE users SET ad_removal_json = ? WHERE id = ?').run(JSON.stringify(adRemoval), req.params.id);
  res.json({ ok: true, user: getUserOrNull(req.params.id) });
});

app.post('/api/users/:id/customize', (req, res) => {
  const { theme, customAppName, customAppIcon, country } = req.body as {
    theme?: ThemeId;
    customAppName?: string;
    customAppIcon?: string;
    country?: CountryCode;
  };
  const user = getUserOrNull(req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });

  db.prepare('UPDATE users SET theme = ?, custom_app_name = ?, custom_app_icon = ?, country = ? WHERE id = ?')
    .run(theme || user.theme, customAppName !== undefined ? customAppName.slice(0, 18) : user.customAppName, customAppIcon || user.customAppIcon, country || user.country, user.id);
  res.json({ ok: true, user: getUserOrNull(user.id) });
});

// ============================================================
// FINANCE SANDBOX & TRADINGVIEW DATA
// ============================================================
app.get('/api/finance/ledger/:userId', (req, res) => {
  const entries = db.prepare('SELECT * FROM ledger_entries WHERE user_id = ? OR credit_account LIKE ? ORDER BY created_at DESC LIMIT 30')
    .all(req.params.userId, `%${req.params.userId}%`);
  res.json({ ok: true, entries, mode: 'SANDBOX_DESIGN_ONLY' });
});

app.get('/api/finance/markets', (_req, res) => {
  const makeSeries = (startPrice: number, drift: number, vol: number, days = 90) => {
    const out = [];
    let price = startPrice;
    const baseDate = new Date('2026-08-25T00:00:00Z');
    for (let i = 0; i < days; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000);
      const seed = Math.sin(i * 1.37 + startPrice) * 0.5 + Math.cos(i * 0.63) * 0.5;
      const open = Number(price.toFixed(2));
      const change = price * (drift + seed * vol);
      const close = Number(Math.max(1, open + change).toFixed(2));
      const high = Number((Math.max(open, close) * (1 + Math.abs(seed) * vol * 0.6)).toFixed(2));
      const low = Number((Math.min(open, close) * (1 - Math.abs(seed) * vol * 0.5)).toFixed(2));
      price = close;
      out.push({ time: d.toISOString().slice(0, 10), open, high, low, close });
    }
    return out;
  };
  res.json({
    ok: true,
    assets: [
      { symbol: 'EGX30', nameAr: 'مؤشر البورصة المصرية EGX30', nameEn: 'Egypt EGX30 Index', category: 'stocks', currency: 'EGP', series: makeSeries(30450, 0.0018, 0.014) },
      { symbol: 'COMI.CA', nameAr: 'البنك التجاري الدولي CIB', nameEn: 'CIB Egypt', category: 'stocks', currency: 'EGP', series: makeSeries(81.5, 0.0014, 0.018) },
      { symbol: 'AAPL', nameAr: 'آبل Apple Inc.', nameEn: 'Apple Inc.', category: 'stocks', currency: 'USD', series: makeSeries(226.4, 0.0015, 0.015) },
      { symbol: 'NVDA', nameAr: 'إنفيديا NVIDIA', nameEn: 'NVIDIA Corp.', category: 'stocks', currency: 'USD', series: makeSeries(138.2, 0.0024, 0.026) },
      { symbol: 'BTC', nameAr: 'بيتكوين Bitcoin', nameEn: 'Bitcoin', category: 'crypto', currency: 'USD', series: makeSeries(89400, 0.0021, 0.032) },
      { symbol: 'ETH', nameAr: 'إيثيريوم Ethereum', nameEn: 'Ethereum', category: 'crypto', currency: 'USD', series: makeSeries(3240, 0.0016, 0.035) },
    ],
  });
});

// ============================================================
// API HUB
// ============================================================
function maskKey(k: string): string {
  if (!k) return '';
  if (k.length <= 8) return '••••••••';
  return `${k.slice(0, 4)}••••••${k.slice(-4)}`;
}

app.get('/api/providers', (_req, res) => {
  const cfg = loadProviderConfig();
  res.json({
    ok: true,
    providers: {
      geminiConfigured: Boolean(cfg.geminiApiKey),
      geminiMasked: maskKey(cfg.geminiApiKey),
      openaiConfigured: Boolean(cfg.openaiApiKey),
      openaiMasked: maskKey(cfg.openaiApiKey),
      anthropicConfigured: Boolean(cfg.anthropicApiKey),
      anthropicMasked: maskKey(cfg.anthropicApiKey),
      openrouterConfigured: Boolean(cfg.openrouterApiKey),
      openrouterMasked: maskKey(cfg.openrouterApiKey),
      groqConfigured: Boolean(cfg.groqApiKey),
      groqMasked: maskKey(cfg.groqApiKey),
      ollamaUrl: cfg.ollamaUrl,
      livekitUrl: cfg.livekitUrl,
      livekitConfigured: Boolean(cfg.livekitUrl && cfg.livekitApiKey),
      meilisearchUrl: cfg.meilisearchUrl,
      blnkUrl: cfg.blnkUrl,
      matrixUrl: cfg.matrixUrl,
      defaultProvider: cfg.defaultProvider,
      defaultModel: cfg.defaultModel,
    },
  });
});

app.post('/api/providers', (req, res) => {
  const body = req.body as Record<string, string>;
  const patch: Record<string, string> = {};
  const allowed = [
    'geminiApiKey', 'openaiApiKey', 'anthropicApiKey', 'openrouterApiKey', 'groqApiKey',
    'ollamaUrl', 'livekitUrl', 'livekitApiKey', 'livekitApiSecret',
    'meilisearchUrl', 'blnkUrl', 'matrixUrl', 'defaultProvider', 'defaultModel',
  ];
  for (const key of allowed) {
    if (body[key] !== undefined && !String(body[key]).includes('••••')) {
      patch[key] = String(body[key]).trim();
    }
  }
  saveProviderConfig(patch);
  res.json({ ok: true });
});

app.post('/api/providers/test', async (req, res) => {
  const { target } = req.body as { target: string };
  const cfg = loadProviderConfig();
  const start = Date.now();
  try {
    if (target === 'ollama') {
      const r = await fetch(`${cfg.ollamaUrl.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(3000) });
      const data = (await r.json()) as { models?: Array<{ name: string }> };
      return res.json({ ok: r.ok, latencyMs: Date.now() - start, detail: `تم الاتصال بـ Ollama (${data.models?.length || 0} نماذج متاحة)` });
    }
    if (target === 'gemini') {
      if (!cfg.geminiApiKey) return res.json({ ok: false, detail: 'أدخل مفتاح Gemini API أولًا.' });
      const ai = new GoogleGenAI({ apiKey: cfg.geminiApiKey });
      const out = await ai.interactions.create({ model: 'gemini-3.5-flash-lite', input: 'Reply OK' });
      return res.json({ ok: true, latencyMs: Date.now() - start, detail: `اتصال ناجح بـ Gemini API: ${(out.output_text || 'OK').slice(0, 40)}` });
    }
    if (target === 'meilisearch' && cfg.meilisearchUrl) {
      const r = await fetch(`${cfg.meilisearchUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(3000) });
      return res.json({ ok: r.ok, latencyMs: Date.now() - start, detail: r.ok ? 'Meilisearch متصل' : `HTTP ${r.status}` });
    }
    if (target === 'blnk' && cfg.blnkUrl) {
      const r = await fetch(`${cfg.blnkUrl.replace(/\/$/, '')}/`, { signal: AbortSignal.timeout(3000) });
      return res.json({ ok: r.ok, latencyMs: Date.now() - start, detail: r.ok ? 'Blnk متصل' : `HTTP ${r.status}` });
    }
    if (target === 'matrix' && cfg.matrixUrl) {
      const r = await fetch(`${cfg.matrixUrl.replace(/\/$/, '')}/_matrix/client/versions`, { signal: AbortSignal.timeout(3000) });
      return res.json({ ok: r.ok, latencyMs: Date.now() - start, detail: r.ok ? 'Matrix Synapse متصل' : `HTTP ${r.status}` });
    }
    return res.json({ ok: false, detail: 'أدخل العنوان أو المفتاح أولًا.' });
  } catch (e) {
    return res.json({ ok: false, latencyMs: Date.now() - start, detail: `غير متصل: ${e instanceof Error ? e.message : String(e)}` });
  }
});

const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`\n  ✦ LM Super App v2 running at http://localhost:${PORT}\n`);
});
