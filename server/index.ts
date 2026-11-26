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

import { db, initDatabase, mapUserRow, loadProviderConfig, saveProviderConfig, UPLOADS_DIR } from './db.ts';
import { liveEngine } from './liveEngine.ts';
import { runLmAi } from './aiGateway.ts';
import { CountryCode } from './types.ts';

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
  res.json({ ok: true, service: 'LM Core v6', wsClients: wsClients.size });
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
// INSTANT MESSAGE TRANSLATION (Cloud AI / Free Open Endpoint / Offline Fallback)
// ============================================================
const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  'zh-CN': 'Chinese (Simplified)',
  hi: 'Hindi',
  ru: 'Russian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  tr: 'Turkish',
  it: 'Italian',
  ur: 'Urdu',
  fa: 'Persian',
  id: 'Indonesian',
};

const SEED_TRANSLATIONS: Record<string, Record<string, string>> = {
  'Just finished color grading the sunset frame — sending it to you now.': {
    ar: 'انتهيت للتو من تلوين لقطة الغروب — أرسلها لك الآن.',
    fr: "Je viens de terminer l'étalonnage du coucher de soleil — je te l'envoie maintenant.",
    es: 'Acabo de terminar la corrección de color del atardecer — te lo envío ahora.',
    de: 'Ich bin gerade mit dem Color Grading des Sonnenuntergangs fertig — ich schicke es dir jetzt.',
    tr: 'Gün batımı karesinin renk düzenlemesini yeni bitirdim — şimdi sana gönderiyorum.',
    'zh-CN': '刚完成日落画面的调色——现在发给你。',
    ru: 'Только что закончил цветокоррекцию кадра заката — отправляю тебе сейчас.',
    ja: '夕日のフレームのカラーグレーディングが終わりました。今送りますね。',
  },
  'Hey! Just finished testing the new release in New York — performance feels super fast and clean. Are we ready for tonight?': {
    ar: 'أهلًا! انتهيت للتو من اختبار الإصدار الجديد في نيويورك — الأداء سريع جدًا ونظيف. هل نحن جاهزون لليلة؟',
    fr: "Salut ! Je viens de tester la nouvelle version à New York — les performances sont ultra fluides. On est prêts pour ce soir ?",
    es: '¡Hola! Acabo de probar la nueva versión en Nueva York — el rendimiento es súper rápido y limpio. ¿Listos para esta noche?',
    de: 'Hey! Habe gerade das neue Release in New York getestet — extrem schnell und sauber. Bereit für heute Abend?',
    tr: 'Selam! New York’ta yeni sürümü test etmeyi bitirdim — performans çok hızlı ve akıcı. Bu geceye hazır mıyız?',
    'zh-CN': '嗨！刚在纽约测试完新版本——速度极快且流畅。今晚准备好了吗？',
    ru: 'Привет! Только что протестировал новый релиз в Нью-Йорке — всё работает молниеносно. Готовы к сегодняшнему вечеру?',
    ja: 'やあ！ニューヨークで新リリースのテストを終えたよ。すごく高速でクリーンだ。今夜の準備はできてる？',
  },
};

app.post('/api/translate', async (req, res) => {
  const { text, targetLang } = req.body as { text: string; targetLang: string };
  const clean = (text || '').trim();
  const lang = LANG_NAMES[targetLang] ? targetLang : 'ar';
  if (!clean) return res.status(400).json({ ok: false, error: 'النص فارغ.' });

  // 1. Check exact instant seed cache first for 0ms latency
  if (SEED_TRANSLATIONS[clean]?.[lang]) {
    return res.json({ ok: true, translated: SEED_TRANSLATIONS[clean][lang], targetLang: lang });
  }

  // 2. If Gemini API key is configured, translate natively with sub-second Gemini 2.5 Flash
  const cfg = loadProviderConfig();
  if (cfg.geminiApiKey) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(cfg.geminiApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(7000),
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `Translate the following message naturally into ${LANG_NAMES[lang]}. Return ONLY the translated text without quotes or notes:\n\n${clean}`,
                  },
                ],
              },
            ],
          }),
        }
      );
      if (resp.ok) {
        const data = (await resp.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
        if (text) return res.json({ ok: true, translated: text, targetLang: lang });
      }
    } catch {
      // fall through to public open translation API
    }
  }

  // 3. Free open-source Google Translate GTX endpoint (no key required)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(clean)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (r.ok) {
      const data = (await r.json()) as unknown[];
      const chunks = Array.isArray(data[0]) ? (data[0] as Array<[string]>) : [];
      const joined = chunks.map(c => c[0]).join('').trim();
      if (joined) {
        return res.json({ ok: true, translated: joined, targetLang: lang });
      }
    }
  } catch {
    // offline fallback below
  }

  // 4. Clean offline fallback if computer has no internet
  const fallbackLabels: Record<string, string> = {
    ar: `[ترجمة للعربية]: ${clean}`,
    en: `[English Translation]: ${clean}`,
    fr: `[Traduction FR]: ${clean}`,
    es: `[Traducción ES]: ${clean}`,
    de: `[Übersetzung DE]: ${clean}`,
    tr: `[TR Çeviri]: ${clean}`,
  };
  return res.json({ ok: true, translated: fallbackLabels[lang] || clean, targetLang: lang });
});

// ============================================================
// REAL VOICE-TO-TEXT TRANSCRIPTION (Gemini Multimodal Audio / Whisper)
// ============================================================
function detectAudioMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.mp4' || ext === '.m4a') return 'audio/mp4';
  if (ext === '.ogg' || ext === '.oga') return 'audio/ogg';
  if (ext === '.mp3') return 'audio/mpeg';
  return 'audio/webm';
}

app.post('/api/transcribe', async (req, res) => {
  const { audioUrl, table, recordId } = req.body as {
    audioUrl?: string;
    table?: 'messages' | 'post_comments' | 'video_comments';
    recordId?: string;
  };

  if (!audioUrl || !audioUrl.startsWith('/uploads/')) {
    return res.status(400).json({ ok: false, error: 'رابط الملف الصوتي غير صالح.' });
  }

  const rel = audioUrl.replace(/^\/uploads\//, '');
  const resolved = path.resolve(UPLOADS_DIR, rel);
  if (!resolved.startsWith(path.resolve(UPLOADS_DIR)) || !fs.existsSync(resolved)) {
    return res.status(404).json({ ok: false, error: 'الملف الصوتي غير موجود.' });
  }

  const cfg = loadProviderConfig();
  const audioBuffer = fs.readFileSync(resolved);
  const mimeType = detectAudioMime(resolved);
  let transcript = '';
  let modelUsed = '';

  // 1. Primary: Google Gemini multimodal native audio transcription (Arabic + English verbatim)
  if (cfg.geminiApiKey) {
    const base64 = audioBuffer.toString('base64');
    const modelsToTry = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite'];
    for (const model of modelsToTry) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.geminiApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(18000),
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { inlineData: { mimeType, data: base64 } },
                    {
                      text: 'استمع إلى التسجيل الصوتي واكتب الكلام المنطوق فيه بدقة وحرفية بنفس اللغة المنطوقة فقط بدون أي مقدمات أو شروحات. إذا لم يوجد كلام واضح في الصوت فاكتب: (لم يتم رصد كلام واضح في التسجيل).',
                    },
                  ],
                },
              ],
            }),
          }
        );
        if (resp.ok) {
          const data = (await resp.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const out = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
          if (out) {
            transcript = out;
            modelUsed = model;
            break;
          }
        }
      } catch {
        // try next model
      }
    }
  }

  // 2. Fallback: OpenAI or Groq Whisper
  if (!transcript && (cfg.openaiApiKey || cfg.groqApiKey)) {
    const useGroq = !cfg.openaiApiKey && Boolean(cfg.groqApiKey);
    const endpoint = useGroq
      ? 'https://api.groq.com/openai/v1/audio/transcriptions'
      : 'https://api.openai.com/v1/audio/transcriptions';
    const apiKey = useGroq ? cfg.groqApiKey : cfg.openaiApiKey;
    const whisperModel = useGroq ? 'whisper-large-v3-turbo' : 'whisper-1';
    try {
      const form = new FormData();
      form.append('file', new Blob([audioBuffer], { type: mimeType }), path.basename(resolved));
      form.append('model', whisperModel);
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(18000),
      });
      if (resp.ok) {
        const d = (await resp.json()) as { text?: string };
        if (d.text?.trim()) {
          transcript = d.text.trim();
          modelUsed = whisperModel;
        }
      }
    } catch {
      // handled below
    }
  }

  if (!transcript) {
    return res.status(503).json({
      ok: false,
      error: 'تعذر تحويل الصوت إلى نص الآن. تأكد من إضافة مفتاح Gemini أو OpenAI أو Groq في الإعدادات.',
    });
  }

  // Persist real transcript to SQLite so future clicks are instantaneous
  if (recordId && (table === 'messages' || table === 'post_comments' || table === 'video_comments')) {
    try {
      db.prepare(`UPDATE ${table} SET transcript = ? WHERE id = ?`).run(transcript, recordId);
    } catch {
      // ignore if record not found
    }
  }

  return res.json({ ok: true, transcript, modelUsed });
});

// ============================================================
// AUTH & USERS
// ============================================================
app.get('/api/auth/users', (_req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY followers_count DESC').all() as Array<Record<string, unknown>>;
  res.json({ ok: true, users: rows.map(mapUserRow) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username) return res.status(400).json({ ok: false, error: 'أدخل اسم المستخدم.' });
  const clean = username.trim().replace(/^@/, '').toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(clean) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'الحساب غير موجود.' });
  if (password && String(row.password) !== password) {
    return res.status(401).json({ ok: false, error: 'كلمة المرور غير صحيحة (123456).' });
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
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('') || 'LM';

  db.prepare(`
    INSERT INTO users (id, username, password, display_name, display_name_en, bio, avatar_color, avatar_initials, country, demo_balance_egp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, cleanUser, password || '123456', displayName.trim(), displayName.trim(), 'عضو في LM', '#27272A', initials, country || 'EG', 10000);

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
    SELECT p.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.content LIKE ? OR u.display_name LIKE ?
    ORDER BY p.rowid DESC LIMIT 8
  `).all(like, like);

  const videos = db.prepare(`
    SELECT v.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url
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
// COMMUNITY FEED (Instagram Clean Flow + Voice & @LM AI Comments)
// ============================================================
app.get('/api/stories', (_req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url
    FROM stories s JOIN users u ON s.user_id = u.id
    ORDER BY s.rowid DESC
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
      mediaUrl: r.media_url,
      caption: r.caption,
      createdAt: r.created_at,
    })),
  });
});

app.get('/api/posts', (req, res) => {
  const viewerId = String(req.query.userId || '');
  const rows = db.prepare(`
    SELECT p.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.rowid DESC
  `).all() as Array<Record<string, unknown>>;

  const voteMap = new Map<string, -1 | 0 | 1>();
  const pollVoteMap = new Map<string, string>();
  const likedSet = new Set<string>();
  const reactionsByPost = new Map<string, Record<string, number>>();
  const myReactionMap = new Map<string, string>();

  const allRx = db.prepare('SELECT post_id, user_id, reaction FROM post_reactions').all() as Array<{
    post_id: string;
    user_id: string;
    reaction: string;
  }>;
  for (const rx of allRx) {
    const bucket = reactionsByPost.get(rx.post_id) || {};
    bucket[rx.reaction] = (bucket[rx.reaction] || 0) + 1;
    reactionsByPost.set(rx.post_id, bucket);
    if (viewerId && rx.user_id === viewerId) myReactionMap.set(rx.post_id, rx.reaction);
  }

  if (viewerId) {
    const vRows = db.prepare('SELECT post_id, vote FROM post_votes WHERE user_id = ?').all(viewerId) as Array<{ post_id: string; vote: number }>;
    for (const vr of vRows) voteMap.set(vr.post_id, vr.vote > 0 ? 1 : -1);

    const pvRows = db.prepare('SELECT post_id, option_id FROM post_poll_votes WHERE user_id = ?').all(viewerId) as Array<{ post_id: string; option_id: string }>;
    for (const pvr of pvRows) pollVoteMap.set(pvr.post_id, pvr.option_id);

    const lRows = db.prepare('SELECT post_id FROM post_likes WHERE user_id = ?').all(viewerId) as Array<{ post_id: string }>;
    for (const lr of lRows) likedSet.add(lr.post_id);
  }

  const posts = rows.map(r => {
    let mediaUrls: string[] = [];
    try { mediaUrls = JSON.parse(String(r.media_urls_json || '[]')); } catch { mediaUrls = []; }
    if (mediaUrls.length === 0 && r.media_url) mediaUrls = [String(r.media_url)];

    let poll = null;
    if (r.poll_json) {
      try {
        const parsed = JSON.parse(String(r.poll_json));
        poll = { ...parsed, votedOptionId: pollVoteMap.get(String(r.id)) || null };
      } catch {
        poll = null;
      }
    }

    return {
      id: r.id,
      userId: r.user_id,
      displayName: r.display_name,
      username: r.username,
      avatarColor: r.avatar_color,
      avatarInitials: r.avatar_initials,
      avatarUrl: r.avatar_url,
      verified: Boolean(r.verified),
      topic: r.topic || 'عام',
      content: r.content,
      mediaUrl: r.media_url,
      mediaUrls,
      location: r.location || 'القاهرة',
      poll,
      score: Number(r.score ?? r.likes_count ?? 0),
      myVote: voteMap.get(String(r.id)) || 0,
      reactions: reactionsByPost.get(String(r.id)) || {},
      myReaction: myReactionMap.get(String(r.id)) || null,
      likesCount: Number(r.likes_count || 0),
      commentsCount: Number(r.comments_count || 0),
      sharesCount: Number(r.shares_count || 0),
      likedByMe: likedSet.has(String(r.id)) || myReactionMap.has(String(r.id)),
      createdAt: r.created_at,
    };
  });

  res.json({ ok: true, posts });
});

app.post('/api/posts', (req, res) => {
  const { userId, content, mediaUrl, mediaUrls, poll } = req.body as {
    userId: string;
    content: string;
    mediaUrl?: string;
    mediaUrls?: string[];
    poll?: { question: string; options: string[] } | null;
  };
  const cleanMedia = Array.isArray(mediaUrls)
    ? mediaUrls.filter(Boolean).slice(0, 4)
    : mediaUrl
    ? [mediaUrl]
    : [];

  if (!userId || (!content?.trim() && cleanMedia.length === 0)) {
    return res.status(400).json({ ok: false, error: 'محتوى المنشور مطلوب.' });
  }
  const id = `p_${uuid().slice(0, 8)}`;
  const urlsJson = JSON.stringify(cleanMedia);
  const firstMedia = cleanMedia[0] || null;

  let pollJson: string | null = null;
  if (poll && poll.question?.trim() && Array.isArray(poll.options)) {
    const cleanOpts = poll.options.map(o => o.trim()).filter(Boolean).slice(0, 4);
    if (cleanOpts.length >= 2) {
      pollJson = JSON.stringify({
        question: poll.question.trim(),
        options: cleanOpts.map((text, idx) => ({ id: `opt_${idx + 1}`, text, votes: 0 })),
      });
    }
  }

  db.prepare(`
    INSERT INTO posts (id, user_id, topic, content, media_url, media_urls_json, poll_json, score, likes_count, created_at)
    VALUES (?, ?, 'عام', ?, ?, ?, ?, 1, 1, 'الآن')
  `).run(id, userId, (content || '').trim(), firstMedia, urlsJson, pollJson);

  db.prepare('INSERT OR REPLACE INTO post_votes (post_id, user_id, vote) VALUES (?, ?, 1)').run(id, userId);
  broadcast('social:new_post', { id });
  res.json({ ok: true, id });
});

app.post('/api/posts/:id/vote', (req, res) => {
  const { userId, direction } = req.body as { userId: string; direction: 1 | -1 };
  const postId = req.params.id;
  if (!userId || (direction !== 1 && direction !== -1)) return res.status(400).json({ ok: false });

  const existing = db.prepare('SELECT vote FROM post_votes WHERE post_id = ? AND user_id = ?').get(postId, userId) as { vote: number } | undefined;
  let delta = 0;
  let myVote: -1 | 0 | 1 = 0;

  if (existing && existing.vote === direction) {
    db.prepare('DELETE FROM post_votes WHERE post_id = ? AND user_id = ?').run(postId, userId);
    delta = -direction;
    myVote = 0;
  } else if (existing) {
    db.prepare('UPDATE post_votes SET vote = ? WHERE post_id = ? AND user_id = ?').run(direction, postId, userId);
    delta = direction - existing.vote;
    myVote = direction;
  } else {
    db.prepare('INSERT INTO post_votes (post_id, user_id, vote) VALUES (?, ?, ?)').run(postId, userId, direction);
    delta = direction;
    myVote = direction;
  }

  db.prepare('UPDATE posts SET score = score + ? WHERE id = ?').run(delta, postId);
  const updated = db.prepare('SELECT score FROM posts WHERE id = ?').get(postId) as { score: number } | undefined;
  res.json({ ok: true, score: Number(updated?.score || 0), myVote });
});

app.post('/api/posts/:id/react', (req, res) => {
  const { userId, reaction, forceSet } = req.body as { userId: string; reaction: string; forceSet?: boolean };
  const postId = req.params.id;
  if (!userId || !reaction) return res.status(400).json({ ok: false });

  const existing = db.prepare('SELECT reaction FROM post_reactions WHERE post_id = ? AND user_id = ?').get(postId, userId) as
    | { reaction: string }
    | undefined;

  let myReaction: string | null = reaction;
  let scoreDelta = 0;

  if (existing && existing.reaction === reaction && !forceSet) {
    db.prepare('DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?').run(postId, userId);
    myReaction = null;
    scoreDelta = -1;
  } else if (existing) {
    db.prepare('UPDATE post_reactions SET reaction = ? WHERE post_id = ? AND user_id = ?').run(reaction, postId, userId);
    myReaction = reaction;
  } else {
    db.prepare('INSERT INTO post_reactions (post_id, user_id, reaction) VALUES (?, ?, ?)').run(postId, userId, reaction);
    myReaction = reaction;
    scoreDelta = 1;
  }

  if (scoreDelta !== 0) {
    db.prepare('UPDATE posts SET score = MAX(0, score + ?), likes_count = MAX(0, likes_count + ?) WHERE id = ?').run(
      scoreDelta,
      scoreDelta,
      postId
    );
  }

  const rxRows = db.prepare('SELECT reaction FROM post_reactions WHERE post_id = ?').all(postId) as Array<{ reaction: string }>;
  const reactions: Record<string, number> = {};
  for (const r of rxRows) reactions[r.reaction] = (reactions[r.reaction] || 0) + 1;
  const postRow = db.prepare('SELECT score, likes_count FROM posts WHERE id = ?').get(postId) as
    | { score: number; likes_count: number }
    | undefined;

  res.json({
    ok: true,
    reactions,
    myReaction,
    score: Number(postRow?.score || 0),
    likesCount: Number(postRow?.likes_count || 0),
  });
});

app.post('/api/posts/:id/poll-vote', (req, res) => {
  const { userId, optionId } = req.body as { userId: string; optionId: string };
  const postId = req.params.id;
  const row = db.prepare('SELECT poll_json FROM posts WHERE id = ?').get(postId) as { poll_json: string | null } | undefined;
  if (!row || !row.poll_json) return res.status(404).json({ ok: false });

  const existing = db.prepare('SELECT option_id FROM post_poll_votes WHERE post_id = ? AND user_id = ?').get(postId, userId) as { option_id: string } | undefined;
  const poll = JSON.parse(row.poll_json) as { question: string; options: Array<{ id: string; text: string; votes: number }> };

  if (existing) {
    for (const opt of poll.options) {
      if (opt.id === existing.option_id) opt.votes = Math.max(0, opt.votes - 1);
    }
  }
  for (const opt of poll.options) {
    if (opt.id === optionId) opt.votes += 1;
  }

  db.prepare('INSERT OR REPLACE INTO post_poll_votes (post_id, user_id, option_id) VALUES (?, ?, ?)').run(postId, userId, optionId);
  db.prepare('UPDATE posts SET poll_json = ? WHERE id = ?').run(JSON.stringify(poll), postId);
  res.json({ ok: true, poll: { ...poll, votedOptionId: optionId } });
});

app.post('/api/posts/:id/repost', (req, res) => {
  db.prepare('UPDATE posts SET shares_count = shares_count + 1 WHERE id = ?').run(req.params.id);
  const row = db.prepare('SELECT shares_count FROM posts WHERE id = ?').get(req.params.id) as { shares_count: number } | undefined;
  res.json({ ok: true, sharesCount: Number(row?.shares_count || 0) });
});

app.get('/api/posts/:id/comments', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM post_comments c LEFT JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ? ORDER BY c.rowid ASC
  `).all(req.params.id) as Array<Record<string, unknown>>;

  res.json({
    ok: true,
    comments: rows.map(r => {
      const isAi = r.user_id === 'lm_ai';
      return {
        id: r.id,
        postId: r.post_id,
        userId: r.user_id,
        parentId: r.parent_id ? String(r.parent_id) : null,
        displayName: isAi ? 'LM AI' : (r.display_name || 'مستخدم'),
        username: isAi ? 'lm_ai' : (r.username || 'user'),
        avatarColor: '#27272A',
        avatarInitials: isAi ? 'AI' : (r.avatar_initials || 'LM'),
        avatarUrl: isAi ? null : (r.avatar_url ? String(r.avatar_url) : null),
        verified: isAi ? true : Boolean(r.verified),
        isAi,
        content: r.content || '',
        audioUrl: r.audio_url ? String(r.audio_url) : null,
        audioDurationSec: Number(r.audio_duration_sec || 6),
        transcript: r.transcript ? String(r.transcript) : null,
        createdAt: r.created_at,
      };
    }),
  });
});

app.post('/api/posts/:id/comments', async (req, res) => {
  const { userId, content, parentId, audioUrl, audioDurationSec, transcript, invokeAi } = req.body as {
    userId: string;
    content?: string;
    parentId?: string | null;
    audioUrl?: string | null;
    audioDurationSec?: number;
    transcript?: string | null;
    invokeAi?: boolean;
  };
  if (!content?.trim() && !audioUrl) return res.status(400).json({ ok: false, error: 'أضف ردًا.' });

  const id = `pc_${uuid().slice(0, 8)}`;
  const cleanTranscript = transcript && transcript.trim() ? transcript.trim() : null;
  db.prepare(`
    INSERT INTO post_comments (id, post_id, user_id, parent_id, content, audio_url, audio_duration_sec, transcript, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.params.id, userId, parentId || null, (content || '').trim(),
    audioUrl || null, Number(audioDurationSec || 5), cleanTranscript, 'الآن'
  );
  db.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);

  // Summon LM AI directly inside community comments when invoked or tagged with @LM AI
  let aiReply = null;
  const shouldCallAi = Boolean(invokeAi) || (content && /@(lm\s*ai|ai)/i.test(content));
  if (shouldCallAi && content?.trim()) {
    const postRow = db.prepare('SELECT content FROM posts WHERE id = ?').get(req.params.id) as { content?: string } | undefined;
    const cleanQuestion = content.replace(/@(lm\s*ai|ai)/gi, '').trim() || 'اشرح هذا المنشور باختصار';
    const aiOut = await runLmAi({
      userId,
      prompt: cleanQuestion,
      source: 'social',
      explicitUserConsent: true,
      sharedContext: postRow?.content || undefined,
    });
    const aiId = `pc_${uuid().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO post_comments (id, post_id, user_id, parent_id, content, created_at)
      VALUES (?, ?, 'lm_ai', ?, ?, 'الآن')
    `).run(aiId, req.params.id, id, aiOut.reply);
    db.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);
    aiReply = { id: aiId, ...aiOut };
  }

  res.json({ ok: true, id, aiReply });
});

// ============================================================
// SHORT VIDEOS (TikTok Full-Screen Feed + Voice/Nested Replies)
// ============================================================
app.get('/api/videos', (req, res) => {
  const viewerId = String(req.query.userId || '');
  const rows = db.prepare(`
    SELECT v.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM short_videos v JOIN users u ON v.user_id = u.id
    ORDER BY v.rowid ASC
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
      title: r.title,
      description: r.description,
      tags: r.tags,
      audioTitle: r.audio_title || 'الصوت الأصلي',
      videoUrl: r.video_url,
      posterUrl: r.poster_url,
      scenePreset: r.scene_preset,
      durationSec: Number(r.duration_sec),
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
  const { userId, title, description, tags, videoUrl } = req.body as {
    userId: string;
    title: string;
    description: string;
    tags?: string;
    videoUrl?: string;
  };
  if (!userId || !title?.trim()) return res.status(400).json({ ok: false, error: 'عنوان الفيديو مطلوب.' });
  const id = `v_${uuid().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO short_videos (id, user_id, title, description, tags, video_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, title.trim(), (description || '').trim(), tags || '#LM', videoUrl || '/uploads/seed/reel1.mp4');
  res.json({ ok: true, id });
});

app.post('/api/videos/:id/like', (req, res) => {
  const { userId, forceLike } = req.body as { userId: string; forceLike?: boolean };
  const exists = db.prepare('SELECT 1 FROM video_likes WHERE video_id = ? AND user_id = ?').get(req.params.id, userId);
  if (exists && !forceLike) {
    db.prepare('DELETE FROM video_likes WHERE video_id = ? AND user_id = ?').run(req.params.id, userId);
    db.prepare('UPDATE short_videos SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(req.params.id);
    res.json({ ok: true, liked: false });
  } else if (!exists) {
    db.prepare('INSERT INTO video_likes (video_id, user_id) VALUES (?, ?)').run(req.params.id, userId);
    db.prepare('UPDATE short_videos SET likes_count = likes_count + 1 WHERE id = ?').run(req.params.id);
    res.json({ ok: true, liked: true });
  } else {
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
    SELECT c.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url
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
  if (!content?.trim() && !audioUrl) return res.status(400).json({ ok: false, error: 'أضف تعليقًا.' });
  const id = `vc_${uuid().slice(0, 8)}`;
  const cleanTranscript = transcript && transcript.trim() ? transcript.trim() : null;
  db.prepare(`
    INSERT INTO video_comments (id, video_id, user_id, parent_id, content, audio_url, audio_duration_sec, transcript, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.params.id, userId, parentId || null, (content || '').trim(),
    audioUrl || null, Number(audioDurationSec || 5), cleanTranscript, 'الآن'
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

// ============================================================
// MONOCHROME MESSAGING
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
      isEncrypted: Boolean(c.is_encrypted),
      memberCount: Number(c.member_count),
      aiEnabled: Boolean(c.ai_enabled),
      creatorId: String(c.creator_id || 'u_youssef'),
      lastMessage: last ? String(last.content) : '',
      lastMessageAt: last ? String(last.created_at) : 'الآن',
    };
  });
  res.json({ ok: true, conversations: enriched });
});

app.post('/api/conversations', (req, res) => {
  const { title, type, description, creatorId, aiEnabled } = req.body as {
    title: string;
    type?: 'dm' | 'group' | 'community';
    description?: string;
    creatorId?: string;
    aiEnabled?: boolean;
  };
  if (!title?.trim()) return res.status(400).json({ ok: false, error: 'اسم المحادثة مطلوب.' });
  const id = `c_${uuid().slice(0, 8)}`;
  const convType = type || 'group';
  const folder = convType === 'community' ? 'channels' : convType === 'group' ? 'groups' : 'personal';
  db.prepare(`
    INSERT INTO conversations (id, type, folder, title, description, avatar_color, is_encrypted, member_count, ai_enabled, creator_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    convType,
    folder,
    title.trim(),
    description || 'مساحة جديدة',
    '#27272A',
    1,
    convType === 'community' ? 120 : 5,
    convType !== 'dm' && aiEnabled ? 1 : 0,
    creatorId || 'u_youssef'
  );
  res.json({ ok: true, id });
});

app.post('/api/conversations/:id/ai-mode', (req, res) => {
  const { userId, aiEnabled } = req.body as { userId?: string; aiEnabled?: boolean };
  const conv = db.prepare('SELECT id, type, creator_id FROM conversations WHERE id = ?').get(req.params.id) as
    | { id: string; type: string; creator_id?: string }
    | undefined;
  if (!conv) return res.status(404).json({ ok: false, error: 'المحادثة غير موجودة.' });
  if (conv.type === 'dm') {
    return res.status(403).json({ ok: false, error: 'وضع العضو التلقائي متاح فقط للمجموعات والمجتمعات.' });
  }
  if (userId && conv.creator_id && conv.creator_id !== userId) {
    return res.status(403).json({ ok: false, error: 'منشئ المجموعة فقط يمكنه تفعيل أو تعطيل AI كعضو أساسي.' });
  }
  const nextVal = aiEnabled ? 1 : 0;
  db.prepare('UPDATE conversations SET ai_enabled = ? WHERE id = ?').run(nextVal, req.params.id);
  broadcast('chat:message', { conversationId: req.params.id, aiEnabled: Boolean(nextVal) });
  res.json({ ok: true, aiEnabled: Boolean(nextVal) });
});

app.get('/api/conversations/:id/messages', (req, res) => {
  db.prepare('UPDATE conversations SET unread_count = 0 WHERE id = ?').run(req.params.id);
  const rows = db.prepare(`
    SELECT m.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.rowid ASC
  `).all(req.params.id) as Array<Record<string, unknown>>;

  res.json({
    ok: true,
    messages: rows.map(r => {
      let reactions: Record<string, string[]> = {};
      try { reactions = JSON.parse(String(r.reactions_json || '{}')); } catch { reactions = {}; }
      return {
        id: r.id,
        conversationId: r.conversation_id,
        senderId: r.sender_id,
        displayName: r.sender_id === 'lm_ai' ? 'LM AI' : (r.display_name || 'مستخدم'),
        username: r.sender_id === 'lm_ai' ? 'lm_ai' : (r.username || 'user'),
        avatarColor: '#27272A',
        avatarInitials: r.sender_id === 'lm_ai' ? 'AI' : (r.avatar_initials || 'LM'),
        avatarUrl: r.sender_id === 'lm_ai' ? null : (r.avatar_url ? String(r.avatar_url) : null),
        content: r.content,
        msgType: r.msg_type,
        mediaUrl: r.media_url,
        transcript: r.transcript ? String(r.transcript) : null,
        isSpoiler: Boolean(r.is_spoiler),
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
    senderId, content, msgType, mediaUrl, transcript,
    isSpoiler, replyToId, replySender, replyText, invokeAi, sharedSnippet,
  } = req.body as {
    senderId: string;
    content: string;
    msgType?: string;
    mediaUrl?: string;
    transcript?: string;
    isSpoiler?: boolean;
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

  const cleanTranscript = transcript && transcript.trim() ? transcript.trim() : null;
  db.prepare(`
    INSERT INTO messages (
      id, conversation_id, sender_id, content, msg_type, media_url, transcript,
      is_spoiler, reply_to_id, reply_sender, reply_text, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    msgId, req.params.id, senderId, (content || '').trim(), msgType || 'text', mediaUrl || null,
    cleanTranscript,
    isSpoiler ? 1 : 0,
    replyToId || null, replySender || null, replyText || null, nowStr
  );

  broadcast('chat:message', { conversationId: req.params.id, msgId });

  let aiReply = null;
  const shouldInvokeAi = Boolean(invokeAi) || /@(lm\s*ai|ai)\b/i.test(content || '');
  if (shouldInvokeAi) {
    const conv = db.prepare('SELECT type, ai_enabled FROM conversations WHERE id = ?').get(req.params.id) as
      | { type?: string; ai_enabled?: number }
      | undefined;

    let groupHistoryContext: string | undefined;
    if (conv && conv.type !== 'dm' && Number(conv.ai_enabled) === 1) {
      const recent = db.prepare(`
        SELECT m.sender_id, m.content, u.display_name
        FROM messages m LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ? AND m.id != ? AND m.msg_type IN ('text', 'ai_reply')
        ORDER BY m.rowid DESC LIMIT 14
      `).all(req.params.id, msgId) as Array<{ sender_id: string; content: string; display_name?: string }>;
      if (recent.length > 0) {
        groupHistoryContext = recent
          .reverse()
          .map(r => `${r.sender_id === 'lm_ai' ? 'LM AI' : r.display_name || 'عضو'}: ${r.content}`)
          .join('\n');
      }
    }

    const cleanPrompt = (content || '')
      .replace(/^(\/ai|-ai|\/|-)\s*/i, '')
      .replace(/@(lm\s*ai|ai)/gi, '')
      .trim() || 'مرحبًا، كيف يمكنك مساعدتي؟';

    const aiResult = await runLmAi({
      userId: senderId,
      prompt: cleanPrompt,
      source: 'chat',
      explicitUserConsent: Boolean(sharedSnippet) || Boolean(groupHistoryContext),
      sharedContext: sharedSnippet || undefined,
      groupHistoryContext,
    });
    const aiMsgId = `m_${uuid().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, content, msg_type, reply_to_id, reply_sender, reply_text, ai_consent_ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      aiMsgId,
      req.params.id,
      'lm_ai',
      aiResult.reply,
      'ai_reply',
      msgId,
      'LM AI',
      sharedSnippet ? sharedSnippet.slice(0, 50) : null,
      aiResult.securityAuditId,
      nowStr
    );
    broadcast('chat:message', { conversationId: req.params.id, msgId: aiMsgId });
    aiReply = aiResult;
  }

  res.json({ ok: true, id: msgId, aiReply });
});

app.post('/api/messages/:id/react', (req, res) => {
  const { userId, emoji } = req.body as { userId: string; emoji: string };
  const row = db.prepare('SELECT conversation_id, reactions_json FROM messages WHERE id = ?').get(req.params.id) as { conversation_id: string; reactions_json: string } | undefined;
  if (!row) return res.status(404).json({ ok: false });

  let reactions: Record<string, string[]> = {};
  try { reactions = JSON.parse(row.reactions_json || '{}'); } catch { reactions = {}; }
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
// TIKTOK LIVE STREAMING ENGINE
// ============================================================
app.get('/api/live/rooms', (_req, res) => {
  const rows = db.prepare(`
    SELECT r.*, u.display_name as host_name, u.username as host_username, u.avatar_color as host_color, u.avatar_initials as host_initials, u.avatar_url as host_avatar
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
        title: r.title,
        category: r.category,
        videoUrl: r.video_url,
        scenePreset: r.scene_preset,
        viewersCount: runtime.viewersCount,
        totalGiftsEgp: runtime.totalGiftsEgp,
        highlightsEnabled: runtime.highlightsEnabled,
        cooldownSec: runtime.cooldownSec,
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
// LM AI MULTI-PROVIDER GATEWAY & PERSISTENT CONVERSATIONS
// ============================================================
app.get('/api/ai/sessions', (req, res) => {
  const userId = String(req.query.userId || '');
  const rows = db.prepare(
    'SELECT * FROM ai_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 40'
  ).all(userId);
  res.json({ ok: true, sessions: rows });
});

app.get('/api/ai/sessions/:id/messages', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM ai_messages WHERE session_id = ? ORDER BY rowid ASC'
  ).all(req.params.id);
  res.json({ ok: true, messages: rows });
});

app.delete('/api/ai/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM ai_sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/ai/chat', async (req, res) => {
  const { userId, prompt, provider, model, sessionId } = req.body as {
    userId: string;
    prompt: string;
    provider?: string;
    model?: string;
    sessionId?: string | null;
  };
  const result = await runLmAi(req.body);

  // Persist AI conversation history automatically for ai_tab sessions
  let activeSessionId = sessionId || null;
  if (req.body.source === 'ai_tab' && userId && prompt?.trim()) {
    const nowIso = new Date().toISOString();
    if (!activeSessionId) {
      activeSessionId = `ais_${uuid().slice(0, 8)}`;
      const title = prompt.trim().slice(0, 48);
      db.prepare(
        'INSERT INTO ai_sessions (id, user_id, title, company_id, model_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(activeSessionId, userId, title, provider || 'gemini', model || '', nowIso);
    } else {
      db.prepare(
        'UPDATE ai_sessions SET company_id = ?, model_id = ?, updated_at = ? WHERE id = ?'
      ).run(provider || 'gemini', model || '', nowIso, activeSessionId);
    }

    db.prepare(
      'INSERT INTO ai_messages (id, session_id, role, content, company_id, model_label) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(`aim_${uuid().slice(0, 8)}`, activeSessionId, 'user', prompt.trim(), provider || 'gemini', model || '');

    db.prepare(
      'INSERT INTO ai_messages (id, session_id, role, content, company_id, model_label) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(`aim_${uuid().slice(0, 8)}`, activeSessionId, 'assistant', result.reply, provider || 'gemini', result.modelUsed || model || '');
  }

  res.json({ ...result, sessionId: activeSessionId });
});

// ============================================================
// LIVE AUTO-UPDATING MODELS DISCOVERY PER COMPANY
// ============================================================
const modelCache = new Map<string, { ts: number; models: Array<{ id: string; label: string; tag?: string }> }>();

function prettifyModelId(raw: string): string {
  const clean = raw.replace(/^models\//, '').split('/').pop() || raw;
  return clean
    .replace(/-latest$/, '')
    .replace(/-\d{8}$/, '')
    .split('-')
    .map(part => {
      if (/^(gpt|o\d|r\d|v\d|xl|pro|mini|lite|nano|flash|ultra|turbo|sonar|grok|qwen)$/i.test(part)) {
        return part.toUpperCase().replace(/^PRO$/, 'Pro').replace(/^MINI$/, 'Mini').replace(/^LITE$/, 'Lite').replace(/^FLASH$/, 'Flash').replace(/^TURBO$/, 'Turbo').replace(/^SONAR$/, 'Sonar').replace(/^GROK$/, 'Grok').replace(/^QWEN$/, 'Qwen');
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

const NON_CHAT_MODEL_RX =
  /image|imagen|banana|tts|lyria|robotics|computer-use|omni|transcribe|embed|whisper|dall-e|moderation|audio|realtime|sora|veo|aqa|bison|gecko|learnlm|vision-only|deep-research/i;

function scoreTextModelPriority(providerId: string, id: string): number {
  const low = id.toLowerCase();
  if (providerId === 'gemini') {
    const exactRank: Record<string, number> = {
      'gemini-2.5-flash': 1010,
      'gemini-3-flash-preview': 1005,
      'gemini-3.8-flash': 1000,
      'gemini-3.5-flash-lite': 990,
      'gemini-4-neon': 980,
      'gemini-4-hydrogen': 970,
      'gemini-4-carbon': 960,
      'gemini-4-argon': 950,
      'gemini-3.7-flash': 940,
      'gemini-3.6-flash': 930,
      'gemini-3.5-flash': 920,
      'gemini-3.1-pro-preview': 900,
      'gemini-3-pro-preview': 890,
      'gemini-2.5-pro': 860,
      'gemini-2.5-flash-lite': 840,
      'gemma-4-31b-it': 810,
      'gemma-4-26b-a4b-it': 800,
      'gemma-3-27b-it': 780,
    };
    if (exactRank[low] !== undefined) return exactRank[low];
    if (low.startsWith('gemini-4')) return 945;
    if (low.startsWith('gemini-3.')) return 870;
    if (low.startsWith('gemini-2.5')) return 830;
    if (low.startsWith('gemma-4')) return 790;
    if (low.startsWith('gemini-2.0')) return 600;
    if (low.startsWith('gemini-1.5')) return 400;
    return 500;
  }
  if (providerId === 'openai') {
    if (/^gpt-5\b/.test(low)) return 1000;
    if (/^gpt-4\.1\b/.test(low)) return 960;
    if (/^o4\b/.test(low)) return 940;
    if (/^o3\b/.test(low)) return 920;
    if (/^gpt-4o\b/.test(low)) return 900;
    if (/^o1\b/.test(low)) return 820;
    return 500;
  }
  if (providerId === 'anthropic') {
    if (low.includes('opus-4')) return 1000;
    if (low.includes('sonnet-4')) return 980;
    if (low.includes('3-7-sonnet')) return 940;
    if (low.includes('3-5-sonnet')) return 900;
    if (low.includes('3-5-haiku')) return 880;
    return 500;
  }
  if (providerId === 'deepseek') {
    if (low.includes('reasoner') || low.includes('r1')) return 1000;
    if (low.includes('chat') || low.includes('v3')) return 960;
    return 500;
  }
  if (providerId === 'xai') {
    if (low.includes('grok-3')) return 1000;
    if (low.includes('grok-2')) return 900;
    return 500;
  }
  return 500;
}

function tagForModel(id: string): string | undefined {
  const low = id.toLowerCase();
  if (/3\.8-flash|gpt-5\b|opus-4|grok-3\b|reasoner|sonar-pro/i.test(low)) return 'Latest';
  if (/pro|large|max|4-neon|4-hydrogen/i.test(low)) return 'Flagship';
  if (/flash|mini|lite|haiku|fast|turbo|instant/i.test(low)) return 'Fast';
  if (/o3|o4|r1|thinking/i.test(low)) return 'Reasoning';
  return undefined;
}

app.get('/api/providers/:providerId/models', async (req, res) => {
  const providerId = String(req.params.providerId || '').toLowerCase();
  const force = req.query.refresh === '1';
  const cached = modelCache.get(providerId);
  if (!force && cached && Date.now() - cached.ts < 5 * 60 * 1000) {
    return res.json({ ok: true, live: true, models: cached.models });
  }

  const cfg = loadProviderConfig();
  try {
    let models: Array<{ id: string; label: string; tag?: string }> = [];

    if (providerId === 'gemini' && cfg.geminiApiKey) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cfg.geminiApiKey)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (r.ok) {
        const d = (await r.json()) as { models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }> };
        models = (d.models || [])
          .filter(m => {
            const id = m.name.replace(/^models\//, '');
            if (NON_CHAT_MODEL_RX.test(id)) return false;
            if (!/^(gemini|gemma)/i.test(id)) return false;
            if (/-(001|002|exp|latest|preview-\d{2}-\d{2})$/i.test(id) && !/3\.1-pro-preview|3-pro-preview|3-flash-preview/i.test(id)) return false;
            return !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent');
          })
          .map(m => {
            const id = m.name.replace(/^models\//, '');
            return { id, label: m.displayName || prettifyModelId(id), tag: tagForModel(id) };
          })
          .sort((a, b) => scoreTextModelPriority('gemini', b.id) - scoreTextModelPriority('gemini', a.id))
          .slice(0, 18);
      }
    } else if (providerId === 'openrouter') {
      const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(5500) });
      if (r.ok) {
        const d = (await r.json()) as { data?: Array<{ id: string; name?: string; created?: number; pricing?: { prompt?: string } }> };
        models = (d.data || [])
          .filter(m => m.id && !NON_CHAT_MODEL_RX.test(m.id))
          .sort((a, b) => Number(b.created || 0) - Number(a.created || 0))
          .slice(0, 60)
          .map(m => ({
            id: m.id,
            label: (m.name || prettifyModelId(m.id)).replace(/^[^:]+:\s*/, ''),
            tag: m.pricing?.prompt === '0' ? 'Free' : tagForModel(m.id),
          }));
      }
    } else if (providerId === 'anthropic' && cfg.anthropicApiKey) {
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': cfg.anthropicApiKey, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const d = (await r.json()) as { data?: Array<{ id: string; display_name?: string }> };
        models = (d.data || [])
          .filter(m => !NON_CHAT_MODEL_RX.test(m.id))
          .map(m => ({ id: m.id, label: m.display_name || prettifyModelId(m.id), tag: tagForModel(m.id) }))
          .sort((a, b) => scoreTextModelPriority('anthropic', b.id) - scoreTextModelPriority('anthropic', a.id))
          .slice(0, 20);
      }
    } else if (providerId === 'ollama' && cfg.ollamaUrl) {
      const r = await fetch(`${cfg.ollamaUrl.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const d = (await r.json()) as { models?: Array<{ name: string }> };
        models = (d.models || []).map(m => ({ id: m.name, label: prettifyModelId(m.name), tag: 'Local' }));
      }
    } else if (providerId === 'cohere' && cfg.cohereApiKey) {
      const r = await fetch('https://api.cohere.com/v1/models?endpoint=chat', {
        headers: { Authorization: `Bearer ${cfg.cohereApiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const d = (await r.json()) as { models?: Array<{ name: string }> };
        models = (d.models || [])
          .filter(m => !NON_CHAT_MODEL_RX.test(m.name))
          .map(m => ({ id: m.name, label: prettifyModelId(m.name), tag: tagForModel(m.name) }))
          .slice(0, 15);
      }
    } else {
      const compatList: Record<string, { url: string; key: string }> = {
        openai: { url: 'https://api.openai.com/v1/models', key: cfg.openaiApiKey },
        deepseek: { url: 'https://api.deepseek.com/models', key: cfg.deepseekApiKey },
        xai: { url: 'https://api.x.ai/v1/models', key: cfg.xaiApiKey },
        mistral: { url: 'https://api.mistral.ai/v1/models', key: cfg.mistralApiKey },
        groq: { url: 'https://api.groq.com/openai/v1/models', key: cfg.groqApiKey },
        together: { url: 'https://api.together.xyz/v1/models', key: cfg.togetherApiKey },
      };
      const entry = compatList[providerId];
      if (entry && entry.key) {
        const r = await fetch(entry.url, {
          headers: { Authorization: `Bearer ${entry.key}` },
          signal: AbortSignal.timeout(5000),
        });
        if (r.ok) {
          const d = (await r.json()) as { data?: Array<{ id: string; created?: number }> } | Array<{ id: string; created?: number }>;
          const arr = Array.isArray(d) ? d : (d.data || []);
          models = arr
            .filter(m => m.id && !NON_CHAT_MODEL_RX.test(m.id) && !/ft:|davinci|babbage|curie|ada/i.test(m.id))
            .sort((a, b) => {
              const diff = scoreTextModelPriority(providerId, b.id) - scoreTextModelPriority(providerId, a.id);
              if (diff !== 0) return diff;
              return Number(b.created || 0) - Number(a.created || 0);
            })
            .slice(0, 24)
            .map(m => ({ id: m.id, label: prettifyModelId(m.id), tag: tagForModel(m.id) }));
        }
      }
    }

    if (models.length > 0) {
      modelCache.set(providerId, { ts: Date.now(), models });
      return res.json({ ok: true, live: true, models });
    }
  } catch {
    // gracefully return empty -> frontend falls back to complete curated catalog
  }
  return res.json({ ok: true, live: false, models: [] });
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
      deepseekConfigured: Boolean(cfg.deepseekApiKey),
      deepseekMasked: maskKey(cfg.deepseekApiKey),
      xaiConfigured: Boolean(cfg.xaiApiKey),
      xaiMasked: maskKey(cfg.xaiApiKey),
      mistralConfigured: Boolean(cfg.mistralApiKey),
      mistralMasked: maskKey(cfg.mistralApiKey),
      groqConfigured: Boolean(cfg.groqApiKey),
      groqMasked: maskKey(cfg.groqApiKey),
      openrouterConfigured: Boolean(cfg.openrouterApiKey),
      openrouterMasked: maskKey(cfg.openrouterApiKey),
      perplexityConfigured: Boolean(cfg.perplexityApiKey),
      perplexityMasked: maskKey(cfg.perplexityApiKey),
      togetherConfigured: Boolean(cfg.togetherApiKey),
      togetherMasked: maskKey(cfg.togetherApiKey),
      cohereConfigured: Boolean(cfg.cohereApiKey),
      cohereMasked: maskKey(cfg.cohereApiKey),
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
    'geminiApiKey', 'openaiApiKey', 'anthropicApiKey', 'deepseekApiKey', 'xaiApiKey',
    'mistralApiKey', 'groqApiKey', 'openrouterApiKey', 'perplexityApiKey', 'togetherApiKey', 'cohereApiKey',
    'ollamaUrl', 'livekitUrl', 'livekitApiKey', 'livekitApiSecret',
    'meilisearchUrl', 'blnkUrl', 'matrixUrl', 'defaultProvider', 'defaultModel',
  ];
  for (const key of allowed) {
    if (body[key] !== undefined && !String(body[key]).includes('••••')) {
      patch[key] = String(body[key]).trim();
    }
  }
  saveProviderConfig(patch);
  modelCache.clear();
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
      return res.json({ ok: r.ok, latencyMs: Date.now() - start, detail: `Ollama متصل (${data.models?.length || 0} نماذج)` });
    }
    if (target === 'gemini') {
      if (!cfg.geminiApiKey) return res.json({ ok: false, detail: 'أدخل مفتاح Gemini API أولًا.' });
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(cfg.geminiApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply OK' }] }] }),
        }
      );
      const d = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
      if (!r.ok) return res.json({ ok: false, latencyMs: Date.now() - start, detail: d.error?.message || `HTTP ${r.status}` });
      const txt = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim() || 'OK';
      return res.json({ ok: true, latencyMs: Date.now() - start, detail: `Gemini متصل (${txt.slice(0, 20)})` });
    }
    if (target === 'openai') {
      if (!cfg.openaiApiKey) return res.json({ ok: false, detail: 'أدخل مفتاح OpenAI API أولًا.' });
      const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${cfg.openaiApiKey}` }, signal: AbortSignal.timeout(3500) });
      return res.json({ ok: r.ok, latencyMs: Date.now() - start, detail: r.ok ? 'OpenAI متصل بنجاح' : `HTTP ${r.status}` });
    }
    if (target === 'openrouter') {
      if (!cfg.openrouterApiKey) return res.json({ ok: false, detail: 'أدخل مفتاح OpenRouter API أولًا.' });
      const r = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${cfg.openrouterApiKey}` }, signal: AbortSignal.timeout(3500) });
      return res.json({ ok: r.ok, latencyMs: Date.now() - start, detail: r.ok ? 'OpenRouter متصل بنجاح' : `HTTP ${r.status}` });
    }
    if (target === 'groq') {
      if (!cfg.groqApiKey) return res.json({ ok: false, detail: 'أدخل مفتاح Groq API أولًا.' });
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${cfg.groqApiKey}` }, signal: AbortSignal.timeout(3500) });
      return res.json({ ok: r.ok, latencyMs: Date.now() - start, detail: r.ok ? 'Groq متصل بنجاح' : `HTTP ${r.status}` });
    }
    if (target === 'meilisearch' && cfg.meilisearchUrl) {
      const r = await fetch(`${cfg.meilisearchUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(3000) });
      return res.json({ ok: r.ok, latencyMs: Date.now() - start, detail: r.ok ? 'Meilisearch متصل' : `HTTP ${r.status}` });
    }
    if (target === 'matrix' && cfg.matrixUrl) {
      const r = await fetch(`${cfg.matrixUrl.replace(/\/$/, '')}/_matrix/client/versions`, { signal: AbortSignal.timeout(3000) });
      return res.json({ ok: r.ok, latencyMs: Date.now() - start, detail: r.ok ? 'Matrix متصل' : `HTTP ${r.status}` });
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
  console.log(`\n  ✦ LM Core v6 running at http://localhost:${PORT}\n`);
});
