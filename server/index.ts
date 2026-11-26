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
import { runLmAi, streamLmAi } from './aiGateway.ts';
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
const wsMeta = new Map<WebSocket, { clientId: string; userId?: string }>();

function broadcast(event: string, payload: unknown) {
  const frame = JSON.stringify({ event, payload, ts: Date.now() });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(frame);
    }
  }
}

function relayWsSignal(
  sender: WebSocket,
  event: string,
  payload: Record<string, unknown>
) {
  const senderInfo = wsMeta.get(sender);
  const enriched = {
    ...payload,
    fromClientId: senderInfo?.clientId,
    fromUserId: payload.fromUserId || senderInfo?.userId,
  };
  const frame = JSON.stringify({ event, payload: enriched, ts: Date.now() });
  const targetClientId = typeof payload.targetClientId === 'string' ? payload.targetClientId : '';
  const targetUserId = typeof payload.targetUserId === 'string' ? payload.targetUserId : '';

  for (const client of wsClients) {
    if (client === sender || client.readyState !== WebSocket.OPEN) continue;
    const meta = wsMeta.get(client);
    if (targetClientId) {
      if (meta?.clientId === targetClientId) client.send(frame);
    } else if (targetUserId) {
      if (meta?.userId === targetUserId) client.send(frame);
    } else {
      client.send(frame);
    }
  }
}

wss.on('connection', (ws) => {
  const clientId = `ws_${uuid().slice(0, 8)}`;
  wsClients.add(ws);
  wsMeta.set(ws, { clientId });
  ws.send(JSON.stringify({ event: 'system:connected', payload: { status: 'online', clientId }, ts: Date.now() }));

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(String(raw)) as { type?: string; payload?: Record<string, unknown>; userId?: string };
      if (!msg?.type) return;
      if (msg.type === 'ws:register') {
        const uid = msg.userId || (msg.payload?.userId as string | undefined);
        const cur = wsMeta.get(ws);
        if (cur && uid) cur.userId = uid;
        return;
      }
      if (msg.type.startsWith('rtc:')) {
        relayWsSignal(ws, msg.type, msg.payload || {});
      }
    } catch {
      // ignore malformed signal frame
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    wsMeta.delete(ws);
  });
});

liveEngine.setBroadcaster(broadcast);
liveEngine.startTicker();

function getUserOrNull(id: string) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapUserRow(row) : null;
}

function createNotification(params: {
  userId: string;
  actorId: string;
  type: 'follow' | 'react' | 'comment' | 'message';
  text: string;
  refTab: 'social' | 'videos' | 'chat' | 'profile';
  refId?: string | null;
}) {
  if (!params.userId || !params.actorId || params.userId === params.actorId) return;
  const id = `n_${uuid().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO notifications (id, user_id, actor_id, type, text, ref_tab, ref_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'الآن')
  `).run(id, params.userId, params.actorId, params.type, params.text, params.refTab, params.refId || null);
  broadcast('notification:new', { id, userId: params.userId, type: params.type });
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

async function transcribeAudioFile(audioUrl: string): Promise<{ transcript: string; modelUsed: string } | null> {
  if (!audioUrl || !audioUrl.startsWith('/uploads/')) return null;
  const rel = audioUrl.replace(/^\/uploads\//, '');
  const resolved = path.resolve(UPLOADS_DIR, rel);
  if (!resolved.startsWith(path.resolve(UPLOADS_DIR)) || !fs.existsSync(resolved)) return null;

  const cfg = loadProviderConfig();
  const audioBuffer = fs.readFileSync(resolved);
  const mimeType = detectAudioMime(resolved);

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
          if (out) return { transcript: out, modelUsed: model };
        }
      } catch {
        // try next model
      }
    }
  }

  // 2. Fallback: OpenAI or Groq Whisper
  if (cfg.openaiApiKey || cfg.groqApiKey) {
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
        if (d.text?.trim()) return { transcript: d.text.trim(), modelUsed: whisperModel };
      }
    } catch {
      // handled below
    }
  }

  return null;
}

app.post('/api/transcribe', async (req, res) => {
  const { audioUrl, table, recordId } = req.body as {
    audioUrl?: string;
    table?: 'messages' | 'post_comments' | 'video_comments' | 'ai_messages';
    recordId?: string;
  };

  if (!audioUrl || !audioUrl.startsWith('/uploads/')) {
    return res.status(400).json({ ok: false, error: 'رابط الملف الصوتي غير صالح.' });
  }

  const out = await transcribeAudioFile(audioUrl);
  if (!out) {
    return res.status(503).json({
      ok: false,
      error: 'تعذر تحويل الصوت إلى نص الآن. تأكد من إضافة مفتاح Gemini أو OpenAI أو Groq في الإعدادات.',
    });
  }

  if (
    recordId &&
    (table === 'messages' || table === 'post_comments' || table === 'video_comments' || table === 'ai_messages')
  ) {
    try {
      db.prepare(`UPDATE ${table} SET transcript = ? WHERE id = ?`).run(out.transcript, recordId);
    } catch {
      // ignore if record not found
    }
  }

  return res.json({ ok: true, transcript: out.transcript, modelUsed: out.modelUsed });
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

app.get('/api/users/by-username/:username', (req, res) => {
  const handle = String(req.params.username || '').replace(/^@/, '').trim().toLowerCase();
  if (!handle) return res.status(400).json({ ok: false, error: 'اسم المستخدم مطلوب.' });
  const row = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(handle) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });
  res.json({ ok: true, user: mapUserRow(row) });
});

app.get('/api/users/:id', (req, res) => {
  const user = getUserOrNull(req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });
  res.json({ ok: true, user });
});

app.get('/api/users/:id/profile', (req, res) => {
  const targetId = req.params.id;
  const viewerId = String(req.query.viewerId || '');
  const user = getUserOrNull(targetId);
  if (!user) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });

  const isFollowing = viewerId
    ? Boolean(db.prepare('SELECT 1 FROM user_follows WHERE follower_id = ? AND following_id = ?').get(viewerId, targetId))
    : false;

  const postRows = db.prepare(`
    SELECT p.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ? ORDER BY p.rowid DESC
  `).all(targetId) as Array<Record<string, unknown>>;

  const posts = postRows.map(r => {
    let mediaUrls: string[] = [];
    try { mediaUrls = JSON.parse(String(r.media_urls_json || '[]')); } catch { mediaUrls = []; }
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
      topic: r.topic || 'عام',
      content: r.content,
      mediaUrl: r.media_url,
      mediaUrls,
      location: r.location || 'القاهرة',
      poll: null,
      score: Number(r.score ?? r.likes_count ?? 0),
      myVote: 0,
      reactions: {},
      myReaction: null,
      likesCount: Number(r.likes_count || 0),
      commentsCount: Number(r.comments_count || 0),
      sharesCount: Number(r.shares_count || 0),
      likedByMe: false,
      isEdited: Boolean(r.is_edited),
      createdAt: r.created_at,
    };
  });

  const videoRows = db.prepare(`
    SELECT v.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM short_videos v JOIN users u ON v.user_id = u.id
    WHERE v.user_id = ? ORDER BY v.rowid DESC
  `).all(targetId) as Array<Record<string, unknown>>;

  const videos = videoRows.map(r => ({
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
    likedByMe: false,
    savedByMe: false,
    createdAt: r.created_at,
  }));

  const savedRows = db.prepare(`
    SELECT v.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM video_saves vs
    JOIN short_videos v ON vs.video_id = v.id
    JOIN users u ON v.user_id = u.id
    WHERE vs.user_id = ? ORDER BY vs.rowid DESC
  `).all(targetId) as Array<Record<string, unknown>>;

  const savedVideos = savedRows.map(r => ({
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
    likedByMe: false,
    savedByMe: true,
    createdAt: r.created_at,
  }));

  const savedPostRows = db.prepare(`
    SELECT p.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM post_saves ps
    JOIN posts p ON ps.post_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE ps.user_id = ? ORDER BY ps.rowid DESC
  `).all(targetId) as Array<Record<string, unknown>>;

  const savedPosts = savedPostRows.map(r => {
    let mediaUrls: string[] = [];
    try { mediaUrls = JSON.parse(String(r.media_urls_json || '[]')); } catch { mediaUrls = []; }
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
      topic: r.topic || 'عام',
      content: r.content,
      mediaUrl: r.media_url,
      mediaUrls,
      location: r.location || 'القاهرة',
      poll: null,
      score: Number(r.score ?? r.likes_count ?? 0),
      myVote: 0,
      reactions: {},
      myReaction: null,
      likesCount: Number(r.likes_count || 0),
      commentsCount: Number(r.comments_count || 0),
      sharesCount: Number(r.shares_count || 0),
      likedByMe: false,
      savedByMe: true,
      isEdited: Boolean(r.is_edited),
      createdAt: r.created_at,
    };
  });

  const followersList = (db.prepare(`
    SELECT u.* FROM user_follows f JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = ? LIMIT 40
  `).all(targetId) as Array<Record<string, unknown>>).map(mapUserRow);

  const followingList = (db.prepare(`
    SELECT u.* FROM user_follows f JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = ? LIMIT 40
  `).all(targetId) as Array<Record<string, unknown>>).map(mapUserRow);

  res.json({ ok: true, user, isFollowing, posts, videos, savedPosts, savedVideos, followersList, followingList });
});

app.patch('/api/users/:id', (req, res) => {
  const targetId = req.params.id;
  const { displayName, bio, avatarUrl, coverUrl, location, website } = req.body as {
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    location?: string;
    website?: string;
  };
  const existing = getUserOrNull(targetId);
  if (!existing) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });

  const nextName = (displayName ?? existing.displayName).trim() || existing.displayName;
  const nextBio = (bio ?? existing.bio).trim();
  const nextAvatar = avatarUrl !== undefined ? avatarUrl : existing.avatarUrl;
  const nextCover = coverUrl !== undefined ? coverUrl : (existing.coverUrl ?? null);
  const nextLocation = (location ?? existing.location ?? '').trim();
  const nextWebsite = (website ?? existing.website ?? '').trim();
  const nextInitials =
    nextName
      .split(/\s+/)
      .slice(0, 2)
      .map(p => p[0])
      .join('') || existing.avatarInitials;

  db.prepare(`
    UPDATE users
    SET display_name = ?, bio = ?, avatar_url = ?, cover_url = ?, location = ?, website = ?, avatar_initials = ?
    WHERE id = ?
  `).run(nextName, nextBio, nextAvatar, nextCover, nextLocation, nextWebsite, nextInitials, targetId);

  // Keep DM conversation display names/avatars synced if user updated their profile
  db.prepare(`
    UPDATE conversations SET title = ?, avatar_url = ?
    WHERE type = 'dm' AND peer_user_id = ?
  `).run(nextName, nextAvatar, targetId);

  res.json({ ok: true, user: getUserOrNull(targetId) });
});

app.post('/api/users/:id/follow', (req, res) => {
  const targetId = req.params.id;
  const { followerId } = req.body as { followerId?: string };
  if (!followerId || followerId === targetId) {
    return res.status(400).json({ ok: false, error: 'عملية متابعة غير صالحة.' });
  }
  const target = getUserOrNull(targetId);
  if (!target) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });

  const exists = db.prepare('SELECT 1 FROM user_follows WHERE follower_id = ? AND following_id = ?').get(followerId, targetId);
  let following = false;
  if (exists) {
    db.prepare('DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?').run(followerId, targetId);
    db.prepare('UPDATE users SET followers_count = MAX(0, followers_count - 1) WHERE id = ?').run(targetId);
    db.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').run(followerId);
    following = false;
  } else {
    db.prepare('INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)').run(followerId, targetId);
    db.prepare('UPDATE users SET followers_count = followers_count + 1 WHERE id = ?').run(targetId);
    db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(followerId);
    following = true;
    createNotification({
      userId: targetId,
      actorId: followerId,
      type: 'follow',
      text: 'بدأ بمتابعتك الآن',
      refTab: 'profile',
      refId: followerId,
    });
  }

  const updated = getUserOrNull(targetId);
  res.json({ ok: true, following, followersCount: updated?.followersCount || 0 });
});

// ============================================================
// SIMPLE REAL-TIME NOTIFICATIONS
// ============================================================
app.get('/api/notifications', (req, res) => {
  const userId = String(req.query.userId || '');
  if (!userId) return res.json({ ok: true, notifications: [], unreadCount: 0 });
  const rows = db.prepare(`
    SELECT n.*, u.display_name as actor_name, u.avatar_initials as actor_initials, u.avatar_url as actor_avatar
    FROM notifications n LEFT JOIN users u ON n.actor_id = u.id
    WHERE n.user_id = ?
    ORDER BY n.rowid DESC LIMIT 40
  `).all(userId) as Array<Record<string, unknown>>;

  const notifications = rows.map(r => ({
    id: String(r.id),
    userId: String(r.user_id),
    actorId: String(r.actor_id),
    actorName: r.actor_id === 'lm_ai' ? 'LM AI' : String(r.actor_name || 'مستخدم'),
    actorInitials: r.actor_id === 'lm_ai' ? 'AI' : String(r.actor_initials || 'LM'),
    actorAvatarUrl: r.actor_avatar ? String(r.actor_avatar) : null,
    type: String(r.type) as 'follow' | 'react' | 'comment' | 'message',
    text: String(r.text),
    refTab: String(r.ref_tab || 'social'),
    refId: r.ref_id ? String(r.ref_id) : null,
    isRead: Boolean(r.is_read),
    createdAt: String(r.created_at || 'الآن'),
  }));
  const unreadCount = notifications.filter(n => !n.isRead).length;
  res.json({ ok: true, notifications, unreadCount });
});

app.post('/api/notifications/read', (req, res) => {
  const { userId, id } = req.body as { userId?: string; id?: string };
  if (!userId) return res.status(400).json({ ok: false });
  if (id) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  }
  res.json({ ok: true });
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

app.post('/api/stories', (req, res) => {
  const { userId, mediaUrl, caption } = req.body as {
    userId?: string;
    mediaUrl?: string;
    caption?: string;
  };
  if (!userId || !mediaUrl) return res.status(400).json({ ok: false, error: 'الوسائط مطلوبة لنشر القصة.' });
  const id = `st_${uuid().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO stories (id, user_id, media_url, caption, created_at)
    VALUES (?, ?, ?, ?, 'الآن')
  `).run(id, userId, mediaUrl, (caption || '').trim());
  broadcast('story:new', { id, userId });
  res.json({ ok: true, id });
});

app.delete('/api/stories/:id', (req, res) => {
  const userId = String(req.query.userId || '');
  const row = db.prepare('SELECT user_id FROM stories WHERE id = ?').get(req.params.id) as { user_id: string } | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'القصة غير موجودة.' });
  if (userId && row.user_id !== userId) return res.status(403).json({ ok: false, error: 'يمكنك إزالة قصصك فقط.' });
  db.prepare('DELETE FROM stories WHERE id = ?').run(req.params.id);
  broadcast('story:new', { id: req.params.id, deleted: true });
  res.json({ ok: true });
});

app.get('/api/posts', (req, res) => {
  const viewerId = String(req.query.userId || '');
  const rawTag = String(req.query.tag || '').trim().replace(/^#/, '');
  const rows = (
    rawTag
      ? db.prepare(`
          SELECT p.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
          FROM posts p
          JOIN users u ON p.user_id = u.id
          WHERE LOWER(p.content) LIKE ?
          ORDER BY p.rowid DESC
        `).all(`%#${rawTag.toLowerCase()}%`)
      : db.prepare(`
          SELECT p.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
          FROM posts p
          JOIN users u ON p.user_id = u.id
          ORDER BY p.rowid DESC
        `).all()
  ) as Array<Record<string, unknown>>;

  const voteMap = new Map<string, -1 | 0 | 1>();
  const pollVoteMap = new Map<string, string>();
  const likedSet = new Set<string>();
  const savedSet = new Set<string>();
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

    const sRows = db.prepare('SELECT post_id FROM post_saves WHERE user_id = ?').all(viewerId) as Array<{ post_id: string }>;
    for (const sr of sRows) savedSet.add(sr.post_id);
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
      savedByMe: savedSet.has(String(r.id)),
      isEdited: Boolean(r.is_edited),
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

app.patch('/api/posts/:id', (req, res) => {
  const { userId, content } = req.body as { userId?: string; content?: string };
  const row = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id) as { user_id: string } | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
  if (userId && row.user_id !== userId) return res.status(403).json({ ok: false, error: 'لا يمكنك تعديل منشور شخص آخر.' });
  if (!content?.trim()) return res.status(400).json({ ok: false, error: 'المحتوى مطلوب.' });
  db.prepare('UPDATE posts SET content = ?, is_edited = 1 WHERE id = ?').run(content.trim(), req.params.id);
  broadcast('social:new_post', { id: req.params.id });
  res.json({ ok: true });
});

app.delete('/api/posts/:id', (req, res) => {
  const userId = String(req.query.userId || (req.body as { userId?: string })?.userId || '');
  const row = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id) as { user_id: string } | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
  if (userId && row.user_id !== userId) return res.status(403).json({ ok: false, error: 'لا يمكنك حذف منشور شخص آخر.' });
  db.prepare('DELETE FROM post_saves WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  broadcast('social:new_post', { id: req.params.id, deleted: true });
  res.json({ ok: true });
});

app.post('/api/posts/:id/save', (req, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) return res.status(400).json({ ok: false });
  const exists = db.prepare('SELECT 1 FROM post_saves WHERE post_id = ? AND user_id = ?').get(req.params.id, userId);
  if (exists) {
    db.prepare('DELETE FROM post_saves WHERE post_id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ ok: true, saved: false });
  } else {
    db.prepare('INSERT OR IGNORE INTO post_saves (post_id, user_id) VALUES (?, ?)').run(req.params.id, userId);
    res.json({ ok: true, saved: true });
  }
});

app.delete('/api/post-comments/:id', (req, res) => {
  const userId = String(req.query.userId || '');
  const row = db.prepare('SELECT post_id, user_id FROM post_comments WHERE id = ?').get(req.params.id) as
    | { post_id: string; user_id: string }
    | undefined;
  if (!row) return res.status(404).json({ ok: false });
  if (userId && row.user_id !== userId) return res.status(403).json({ ok: false });
  db.prepare('DELETE FROM post_comments WHERE id = ? OR parent_id = ?').run(req.params.id, req.params.id);
  db.prepare('UPDATE posts SET comments_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = posts.id) WHERE id = ?').run(row.post_id);
  res.json({ ok: true });
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
  const postRow = db.prepare('SELECT user_id, score, likes_count FROM posts WHERE id = ?').get(postId) as
    | { user_id: string; score: number; likes_count: number }
    | undefined;

  if (myReaction && postRow?.user_id) {
    createNotification({
      userId: postRow.user_id,
      actorId: userId,
      type: 'react',
      text: 'تفاعل مع منشورك في المجتمع',
      refTab: 'social',
      refId: postId,
    });
  }

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
        aiSummoned: Boolean(r.ai_summoned),
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
  let cleanTranscript = transcript && transcript.trim() ? transcript.trim() : null;

  // Check if replying directly to LM AI comment -> automatically summon AI to continue conversation!
  let parentRow: { id: string; user_id: string; parent_id?: string | null; content?: string; transcript?: string | null; display_name?: string } | undefined;
  if (parentId) {
    parentRow = db.prepare(`
      SELECT c.id, c.user_id, c.parent_id, c.content, c.transcript, u.display_name
      FROM post_comments c LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(parentId) as typeof parentRow;
  }

  const shouldCallAi =
    Boolean(invokeAi) ||
    Boolean(content && /@(lm\s*ai|ai)\b/i.test(content)) ||
    parentRow?.user_id === 'lm_ai';

  // If voice note summons AI and doesn't have a transcript yet, transcribe it automatically first!
  if (shouldCallAi && audioUrl && !cleanTranscript) {
    const tr = await transcribeAudioFile(audioUrl);
    if (tr?.transcript) cleanTranscript = tr.transcript;
  }

  // Keep nested replies flat under root thread parent if replying to a sub-reply
  const effectiveParentId = parentRow?.parent_id ? parentRow.parent_id : parentId || null;

  db.prepare(`
    INSERT INTO post_comments (id, post_id, user_id, parent_id, content, audio_url, audio_duration_sec, transcript, ai_summoned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.params.id,
    userId,
    effectiveParentId,
    (content || '').trim(),
    audioUrl || null,
    Number(audioDurationSec || 5),
    cleanTranscript,
    shouldCallAi ? 1 : 0,
    'الآن'
  );
  db.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);

  // Notify post owner (and parent comment author if replying)
  const postOwnerRow = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id) as { user_id: string } | undefined;
  if (postOwnerRow?.user_id) {
    createNotification({
      userId: postOwnerRow.user_id,
      actorId: userId,
      type: 'comment',
      text: audioUrl ? 'أضاف ردًا صوتيًا على منشورك' : `علّق على منشورك: ${(content || '').trim().slice(0, 40)}`,
      refTab: 'social',
      refId: req.params.id,
    });
  }
  if (parentRow && parentRow.user_id !== 'lm_ai' && parentRow.user_id !== postOwnerRow?.user_id) {
    createNotification({
      userId: parentRow.user_id,
      actorId: userId,
      type: 'comment',
      text: 'ردّ على تعليقك في المجتمع',
      refTab: 'social',
      refId: req.params.id,
    });
  }

  let aiReply = null;
  if (shouldCallAi) {
    const postRow = db.prepare('SELECT content FROM posts WHERE id = ?').get(req.params.id) as { content?: string } | undefined;
    const rawQuestion = (content || '').trim() || cleanTranscript || '';
    const cleanQuestion = rawQuestion.replace(/@(lm\s*ai|ai)/gi, '').trim() || 'اشرح هذا المنشور باختصار';

    const ctxParts: string[] = [];
    if (postRow?.content) ctxParts.push(`محتوى المنشور: ${postRow.content}`);
    if (parentRow) {
      const pName = parentRow.user_id === 'lm_ai' ? 'LM AI (ردك السابق)' : (parentRow.display_name || 'مستخدم');
      const pBody = parentRow.content || parentRow.transcript || '';
      if (pBody) ctxParts.push(`التعليق الذي يرد عليه المستخدم (${pName}): ${pBody}`);
    }

    const aiOut = await runLmAi({
      userId,
      prompt: cleanQuestion,
      source: 'social',
      explicitUserConsent: true,
      sharedContext: ctxParts.join('\n') || undefined,
    });
    const aiId = `pc_${uuid().slice(0, 8)}`;
    const aiReplyParent = effectiveParentId || id;
    db.prepare(`
      INSERT INTO post_comments (id, post_id, user_id, parent_id, content, ai_summoned, created_at)
      VALUES (?, ?, 'lm_ai', ?, ?, 0, 'الآن')
    `).run(aiId, req.params.id, aiReplyParent, aiOut.reply);
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
  const { userId, title, description, tags, videoUrl, posterUrl } = req.body as {
    userId: string;
    title: string;
    description: string;
    tags?: string;
    videoUrl?: string;
    posterUrl?: string | null;
  };
  if (!userId || !title?.trim()) return res.status(400).json({ ok: false, error: 'عنوان الفيديو مطلوب.' });
  const id = `v_${uuid().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO short_videos (id, user_id, title, description, tags, video_url, poster_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title.trim(), (description || '').trim(), tags || '#LM', videoUrl || '/uploads/seed/reel1.mp4', posterUrl || null);
  res.json({ ok: true, id, posterUrl: posterUrl || null });
});

app.patch('/api/videos/:id', (req, res) => {
  const { userId, title, description, tags } = req.body as {
    userId?: string;
    title?: string;
    description?: string;
    tags?: string;
  };
  const row = db.prepare('SELECT user_id, title, description, tags FROM short_videos WHERE id = ?').get(req.params.id) as
    | { user_id: string; title: string; description: string; tags: string }
    | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'الفيديو غير موجود.' });
  if (userId && row.user_id !== userId) {
    return res.status(403).json({ ok: false, error: 'يمكنك تعديل فيديوهاتك فقط.' });
  }
  const nextTitle = (title ?? row.title).trim() || row.title;
  const nextDesc = (description ?? row.description).trim();
  const nextTags = (tags ?? row.tags).trim();
  db.prepare('UPDATE short_videos SET title = ?, description = ?, tags = ? WHERE id = ?').run(
    nextTitle,
    nextDesc,
    nextTags,
    req.params.id
  );
  res.json({
    ok: true,
    title: nextTitle,
    description: nextDesc,
    tags: nextTags,
    video: { id: req.params.id, title: nextTitle, description: nextDesc, tags: nextTags },
  });
});

app.delete('/api/videos/:id', (req, res) => {
  const userId = String(req.query.userId || '');
  const row = db.prepare('SELECT user_id FROM short_videos WHERE id = ?').get(req.params.id) as { user_id: string } | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'الفيديو غير موجود.' });
  if (userId && row.user_id !== userId) {
    return res.status(403).json({ ok: false, error: 'يمكنك حذف فيديوهاتك فقط.' });
  }
  db.prepare('DELETE FROM video_comments WHERE video_id = ?').run(req.params.id);
  db.prepare('DELETE FROM video_likes WHERE video_id = ?').run(req.params.id);
  db.prepare('DELETE FROM video_saves WHERE video_id = ?').run(req.params.id);
  db.prepare('DELETE FROM short_videos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
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
    SELECT c.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM video_comments c LEFT JOIN users u ON c.user_id = u.id
    WHERE c.video_id = ? ORDER BY c.rowid ASC
  `).all(req.params.id) as Array<Record<string, unknown>>;

  const comments = rows.map(r => {
    const isAi = r.user_id === 'lm_ai';
    let likedBy: string[] = [];
    try { likedBy = JSON.parse(String(r.liked_by_json || '[]')); } catch { likedBy = []; }
    return {
      id: r.id,
      videoId: r.video_id,
      userId: r.user_id,
      parentId: r.parent_id ? String(r.parent_id) : null,
      displayName: isAi ? 'LM AI' : (r.display_name || 'مستخدم'),
      username: isAi ? 'lm_ai' : (r.username || 'user'),
      avatarColor: '#27272A',
      avatarInitials: isAi ? 'AI' : (r.avatar_initials || 'LM'),
      avatarUrl: isAi ? null : (r.avatar_url ? String(r.avatar_url) : null),
      verified: isAi ? true : Boolean(r.verified),
      isAi,
      aiSummoned: Boolean(r.ai_summoned),
      content: r.content || '',
      audioUrl: r.audio_url ? String(r.audio_url) : null,
      audioDurationSec: Number(r.audio_duration_sec || 6),
      transcript: r.transcript ? String(r.transcript) : null,
      likesCount: Number(r.likes_count || 0),
      likedByMe: viewerId ? likedBy.includes(viewerId) : false,
      isEdited: Boolean(r.is_edited),
      createdAt: r.created_at || 'الآن',
    };
  });
  res.json({ ok: true, comments });
});

app.post('/api/videos/:id/comments', async (req, res) => {
  const { userId, content, parentId, audioUrl, audioDurationSec, transcript, invokeAi } = req.body as {
    userId: string;
    content?: string;
    parentId?: string | null;
    audioUrl?: string | null;
    audioDurationSec?: number;
    transcript?: string | null;
    invokeAi?: boolean;
  };
  if (!content?.trim() && !audioUrl) return res.status(400).json({ ok: false, error: 'أضف تعليقًا.' });

  const id = `vc_${uuid().slice(0, 8)}`;
  let cleanTranscript = transcript && transcript.trim() ? transcript.trim() : null;

  let parentRow: { id: string; user_id: string; parent_id?: string | null; content?: string; transcript?: string | null; display_name?: string } | undefined;
  if (parentId) {
    parentRow = db.prepare(`
      SELECT c.id, c.user_id, c.parent_id, c.content, c.transcript, u.display_name
      FROM video_comments c LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(parentId) as typeof parentRow;
  }

  const shouldCallAi =
    Boolean(invokeAi) ||
    Boolean(content && /@(lm\s*ai|ai)\b/i.test(content)) ||
    parentRow?.user_id === 'lm_ai';

  if (shouldCallAi && audioUrl && !cleanTranscript) {
    const tr = await transcribeAudioFile(audioUrl);
    if (tr?.transcript) cleanTranscript = tr.transcript;
  }

  const effectiveParentId = parentRow?.parent_id ? parentRow.parent_id : parentId || null;

  db.prepare(`
    INSERT INTO video_comments (id, video_id, user_id, parent_id, content, audio_url, audio_duration_sec, transcript, ai_summoned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.params.id,
    userId,
    effectiveParentId,
    (content || '').trim(),
    audioUrl || null,
    Number(audioDurationSec || 5),
    cleanTranscript,
    shouldCallAi ? 1 : 0,
    'الآن'
  );
  db.prepare('UPDATE short_videos SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);

  let aiReply = null;
  if (shouldCallAi) {
    const vidRow = db.prepare('SELECT title, description, tags FROM short_videos WHERE id = ?').get(req.params.id) as
      | { title?: string; description?: string; tags?: string }
      | undefined;
    const rawQ = (content || '').trim() || cleanTranscript || '';
    const cleanQ = rawQ.replace(/@(lm\s*ai|ai)/gi, '').trim() || 'اشرح محتوى هذا الفيديو باختصار';

    const ctxParts: string[] = [];
    if (vidRow?.title) ctxParts.push(`فيديو نبض: ${vidRow.title} ${vidRow.description || ''}`.trim());
    if (parentRow) {
      const pName = parentRow.user_id === 'lm_ai' ? 'LM AI (ردك السابق)' : (parentRow.display_name || 'مستخدم');
      const pBody = parentRow.content || parentRow.transcript || '';
      if (pBody) ctxParts.push(`التعليق الذي يرد عليه المستخدم (${pName}): ${pBody}`);
    }

    const aiOut = await runLmAi({
      userId,
      prompt: cleanQ,
      source: 'video_summary',
      explicitUserConsent: true,
      sharedContext: ctxParts.join('\n') || undefined,
    });
    const aiId = `vc_${uuid().slice(0, 8)}`;
    const aiReplyParent = effectiveParentId || id;
    db.prepare(`
      INSERT INTO video_comments (id, video_id, user_id, parent_id, content, ai_summoned, created_at)
      VALUES (?, ?, 'lm_ai', ?, ?, 0, 'الآن')
    `).run(aiId, req.params.id, aiReplyParent, aiOut.reply);
    db.prepare('UPDATE short_videos SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);
    aiReply = { id: aiId, ...aiOut };
  }

  res.json({ ok: true, id, aiReply });
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

app.patch('/api/video-comments/:id', (req, res) => {
  const { userId, content } = req.body as { userId?: string; content?: string };
  const row = db.prepare('SELECT user_id FROM video_comments WHERE id = ?').get(req.params.id) as { user_id: string } | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'التعليق غير موجود.' });
  if (userId && row.user_id !== userId) return res.status(403).json({ ok: false, error: 'يمكنك تعديل تعليقاتك فقط.' });
  if (!content?.trim()) return res.status(400).json({ ok: false, error: 'نص التعليق مطلوب.' });
  db.prepare('UPDATE video_comments SET content = ?, is_edited = 1 WHERE id = ?').run(content.trim(), req.params.id);
  res.json({ ok: true, content: content.trim(), isEdited: true });
});

app.delete('/api/video-comments/:id', (req, res) => {
  const userId = String(req.query.userId || '');
  const row = db.prepare('SELECT video_id, user_id FROM video_comments WHERE id = ?').get(req.params.id) as
    | { video_id: string; user_id: string }
    | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'التعليق غير موجود.' });
  if (userId && row.user_id !== userId) return res.status(403).json({ ok: false, error: 'يمكنك حذف تعليقاتك فقط.' });
  db.prepare('DELETE FROM video_comments WHERE id = ? OR parent_id = ?').run(req.params.id, req.params.id);
  db.prepare('UPDATE short_videos SET comments_count = (SELECT COUNT(*) FROM video_comments WHERE video_id = short_videos.id) WHERE id = ?').run(row.video_id);
  res.json({ ok: true });
});

// ============================================================
// MONOCHROME MESSAGING
// ============================================================
app.get('/api/conversations', (req, res) => {
  const viewerId = String(req.query.userId || '');
  const convs = db.prepare('SELECT * FROM conversations ORDER BY is_pinned DESC, created_at DESC').all() as Array<Record<string, unknown>>;
  const enriched = convs.map(c => {
    const last = db.prepare('SELECT content, created_at, msg_type FROM messages WHERE conversation_id = ? ORDER BY rowid DESC LIMIT 1').get(String(c.id)) as Record<string, unknown> | undefined;

    // For 1-on-1 DMs, dynamically resolve the OTHER participant's live name & avatar when viewerId is provided!
    let title = String(c.title);
    let avatarUrl = c.avatar_url ? String(c.avatar_url) : null;
    let peerUserId = c.peer_user_id ? String(c.peer_user_id) : null;
    if (c.type === 'dm' && c.dm_key && viewerId) {
      const pair = String(c.dm_key).split('::');
      const otherId = pair.find(uid => uid !== viewerId);
      if (otherId) {
        const peer = getUserOrNull(otherId);
        if (peer) {
          title = peer.displayName;
          avatarUrl = peer.avatarUrl;
          peerUserId = peer.id;
        }
      }
    }

    return {
      id: c.id,
      type: c.type,
      folder: c.folder || 'personal',
      title,
      description: c.description,
      avatarColor: c.avatar_color,
      avatarUrl,
      onlineText: c.online_text || 'متصل الآن',
      pinnedMessage: c.pinned_message,
      isPinned: Boolean(c.is_pinned),
      unreadCount: Number(c.unread_count || 0),
      isEncrypted: Boolean(c.is_encrypted),
      memberCount: Number(c.member_count),
      aiEnabled: Boolean(c.ai_enabled),
      creatorId: String(c.creator_id || 'u_youssef'),
      peerUserId,
      lastMessage: last ? String(last.content) : '',
      lastMessageAt: last ? String(last.created_at) : 'الآن',
    };
  });
  res.json({ ok: true, conversations: enriched });
});

app.post('/api/conversations/dm', (req, res) => {
  const { userId, targetUserId } = req.body as { userId?: string; targetUserId?: string };
  if (!userId || !targetUserId || userId === targetUserId) {
    return res.status(400).json({ ok: false, error: 'اختر مستخدمًا آخر لبدء المحادثة.' });
  }
  const target = getUserOrNull(targetUserId);
  if (!target) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });

  const dmKey = [userId, targetUserId].sort().join('::');
  const existing = db.prepare("SELECT id FROM conversations WHERE type = 'dm' AND dm_key = ?").get(dmKey) as { id: string } | undefined;
  if (existing) {
    return res.json({ ok: true, id: existing.id, created: false });
  }

  const id = `c_dm_${uuid().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO conversations (
      id, type, folder, title, description, avatar_color, avatar_url,
      online_text, is_pinned, unread_count, is_encrypted, member_count, ai_enabled, creator_id, dm_key, peer_user_id
    ) VALUES (?, 'dm', 'personal', ?, ?, '#27272A', ?, 'متصل الآن', 0, 0, 1, 2, 0, ?, ?, ?)
  `).run(id, target.displayName, target.bio || `@${target.username}`, target.avatarUrl, userId, dmKey, target.id);

  broadcast('chat:message', { conversationId: id, created: true });
  res.json({ ok: true, id, created: true });
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
        isEdited: Boolean(r.is_edited),
        aiSummoned: Boolean(r.ai_summoned),
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

app.post('/api/conversations/:id/typing', (req, res) => {
  const { userId, displayName } = req.body as { userId?: string; displayName?: string };
  if (!userId) return res.status(400).json({ ok: false });
  broadcast('chat:typing', {
    conversationId: req.params.id,
    userId,
    displayName: displayName || 'مستخدم',
  });
  res.json({ ok: true });
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

  // Check if user is replying to an existing message (including replying directly to LM AI!)
  let repliedMsg: { sender_id: string; content: string; transcript?: string | null; display_name?: string } | undefined;
  if (replyToId) {
    repliedMsg = db.prepare(`
      SELECT m.sender_id, m.content, m.transcript, u.display_name
      FROM messages m LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(replyToId) as typeof repliedMsg;
  }

  const shouldInvokeAi =
    Boolean(invokeAi) ||
    /@(lm\s*ai|ai)\b/i.test(content || '') ||
    repliedMsg?.sender_id === 'lm_ai';

  let cleanTranscript = transcript && transcript.trim() ? transcript.trim() : null;
  if (shouldInvokeAi && msgType === 'audio' && mediaUrl && !cleanTranscript) {
    const tr = await transcribeAudioFile(mediaUrl);
    if (tr?.transcript) cleanTranscript = tr.transcript;
  }

  db.prepare(`
    INSERT INTO messages (
      id, conversation_id, sender_id, content, msg_type, media_url, transcript,
      is_spoiler, ai_summoned, reply_to_id, reply_sender, reply_text, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    msgId,
    req.params.id,
    senderId,
    (content || '').trim(),
    msgType || 'text',
    mediaUrl || null,
    cleanTranscript,
    isSpoiler ? 1 : 0,
    shouldInvokeAi ? 1 : 0,
    replyToId || null,
    replySender || null,
    replyText || null,
    nowStr
  );

  broadcast('chat:message', { conversationId: req.params.id, msgId });

  // Notify DM recipient immediately when a new direct message arrives
  const dmConvRow = db.prepare('SELECT type, dm_key FROM conversations WHERE id = ?').get(req.params.id) as
    | { type?: string; dm_key?: string | null }
    | undefined;
  if (dmConvRow?.type === 'dm' && dmConvRow.dm_key) {
    const recipientId = dmConvRow.dm_key.split('::').find(uid => uid !== senderId);
    if (recipientId) {
      createNotification({
        userId: recipientId,
        actorId: senderId,
        type: 'message',
        text:
          msgType === 'audio'
            ? 'أرسل لك رسالة صوتية في الدردشة'
            : msgType === 'video_note'
            ? 'أرسل لك رسالة فيديو دائرية'
            : `أرسل لك رسالة: ${(content || '').trim().slice(0, 42)}`,
        refTab: 'chat',
        refId: req.params.id,
      });
    }
  }

  let aiReply = null;
  if (shouldInvokeAi) {
    const conv = db.prepare('SELECT type, ai_enabled FROM conversations WHERE id = ?').get(req.params.id) as
      | { type?: string; ai_enabled?: number }
      | undefined;

    let groupHistoryContext: string | undefined;
    if (conv && conv.type !== 'dm' && Number(conv.ai_enabled) === 1) {
      const recent = db.prepare(`
        SELECT m.sender_id, m.content, m.transcript, u.display_name
        FROM messages m LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ? AND m.id != ? AND m.msg_type IN ('text', 'ai_reply', 'audio')
        ORDER BY m.rowid DESC LIMIT 14
      `).all(req.params.id, msgId) as Array<{ sender_id: string; content: string; transcript?: string | null; display_name?: string }>;
      if (recent.length > 0) {
        groupHistoryContext = recent
          .reverse()
          .map(r => `${r.sender_id === 'lm_ai' ? 'LM AI' : r.display_name || 'عضو'}: ${r.transcript || r.content}`)
          .join('\n');
      }
    }

    // Build shared context from either explicitly shared snippet OR the replied message (person OR previous LM AI message!)
    let effectiveShared = sharedSnippet || undefined;
    if (!effectiveShared && repliedMsg) {
      const rSender = repliedMsg.sender_id === 'lm_ai' ? 'LM AI (ردك السابق)' : (repliedMsg.display_name || replySender || 'شخص في المحادثة');
      const rBody = repliedMsg.transcript || repliedMsg.content || replyText || '';
      if (rBody) effectiveShared = `${rSender}: ${rBody}`;
    }

    const rawPrompt =
      msgType === 'audio'
        ? (cleanTranscript || 'أجب على الرسالة الصوتية.')
        : (content || '');

    const cleanPrompt = rawPrompt
      .replace(/^(\/ai|-ai|\/|-)\s*/i, '')
      .replace(/@(lm\s*ai|ai)/gi, '')
      .trim() || 'مرحبًا، كيف يمكنك مساعدتي؟';

    const aiResult = await runLmAi({
      userId: senderId,
      prompt: cleanPrompt,
      source: 'chat',
      explicitUserConsent: Boolean(effectiveShared) || Boolean(groupHistoryContext),
      sharedContext: effectiveShared,
      groupHistoryContext,
    });
    const aiMsgId = `m_${uuid().slice(0, 8)}`;
    const senderRow = getUserOrNull(senderId);
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
      senderRow?.displayName || 'المستخدم',
      cleanPrompt.slice(0, 60),
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

app.patch('/api/messages/:id', (req, res) => {
  const { userId, content } = req.body as { userId?: string; content?: string };
  const row = db.prepare('SELECT conversation_id, sender_id FROM messages WHERE id = ?').get(req.params.id) as
    | { conversation_id: string; sender_id: string }
    | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'الرسالة غير موجودة.' });
  if (userId && row.sender_id !== userId) return res.status(403).json({ ok: false, error: 'لا يمكنك تعديل رسالة شخص آخر.' });
  if (!content?.trim()) return res.status(400).json({ ok: false, error: 'النص فارغ.' });
  db.prepare('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?').run(content.trim(), req.params.id);
  broadcast('chat:message', { conversationId: row.conversation_id, msgId: req.params.id });
  res.json({ ok: true });
});

app.delete('/api/messages/:id', (req, res) => {
  const userId = String(req.query.userId || '');
  const row = db.prepare('SELECT conversation_id, sender_id FROM messages WHERE id = ?').get(req.params.id) as
    | { conversation_id: string; sender_id: string }
    | undefined;
  if (!row) return res.status(404).json({ ok: false });
  if (userId && row.sender_id !== userId) return res.status(403).json({ ok: false });
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  broadcast('chat:message', { conversationId: row.conversation_id, msgId: req.params.id, deleted: true });
  res.json({ ok: true });
});

// ============================================================
// TIKTOK LIVE STREAMING ENGINE
// ============================================================
app.get('/api/live/rooms', (_req, res) => {
  const rows = db.prepare(`
    SELECT r.*, u.display_name as host_name, u.username as host_username, u.avatar_color as host_color, u.avatar_initials as host_initials, u.avatar_url as host_avatar
    FROM live_rooms r JOIN users u ON r.host_id = u.id
    WHERE r.is_active = 1
    ORDER BY CASE WHEN r.video_url IS NULL THEN 0 ELSE 1 END, r.rowid DESC
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

app.post('/api/live/rooms', (req, res) => {
  const { hostId, title, category } = req.body as {
    hostId?: string;
    title?: string;
    category?: string;
  };
  if (!hostId || !title?.trim()) {
    return res.status(400).json({ ok: false, error: 'عنوان البث المباشر مطلوب.' });
  }
  const host = getUserOrNull(hostId);
  if (!host) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });

  // End any previous user-created WebRTC room hosted by this user cleanly
  db.prepare("UPDATE live_rooms SET is_active = 0 WHERE host_id = ? AND scene_preset = 'webrtc_live'").run(hostId);

  const id = `live_u_${uuid().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO live_rooms (id, host_id, title, category, video_url, scene_preset, viewers_count, is_active)
    VALUES (?, ?, ?, ?, NULL, 'webrtc_live', 1, 1)
  `).run(id, hostId, title.trim(), (category || 'عام').trim());

  const runtime = liveEngine.getPublicState(id);
  const room = {
    id,
    hostId: host.id,
    hostName: host.displayName,
    hostUsername: host.username,
    hostColor: host.avatarColor,
    hostInitials: host.avatarInitials,
    hostAvatarUrl: host.avatarUrl,
    title: title.trim(),
    category: (category || 'عام').trim(),
    videoUrl: null,
    scenePreset: 'webrtc_live',
    viewersCount: runtime.viewersCount,
    totalGiftsEgp: 0,
    highlightsEnabled: true,
    cooldownSec: 10,
  };
  broadcast('live:rooms_updated', { roomId: id, action: 'created' });
  res.json({ ok: true, room });
});

app.delete('/api/live/rooms/:id', (req, res) => {
  const hostId = String(req.query.hostId || '');
  const row = db.prepare('SELECT host_id FROM live_rooms WHERE id = ?').get(req.params.id) as { host_id: string } | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'غرفة البث غير موجودة.' });
  if (hostId && row.host_id !== hostId) {
    return res.status(403).json({ ok: false, error: 'يمكن للمذيع فقط إنهاء البث.' });
  }
  db.prepare('UPDATE live_rooms SET is_active = 0 WHERE id = ?').run(req.params.id);
  broadcast('live:room_ended', { roomId: req.params.id });
  broadcast('live:rooms_updated', { roomId: req.params.id, action: 'ended' });
  res.json({ ok: true });
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
  const { userId, prompt, provider, model, sessionId, audioUrl, transcript } = req.body as {
    userId: string;
    prompt?: string;
    provider?: string;
    model?: string;
    sessionId?: string | null;
    audioUrl?: string | null;
    transcript?: string | null;
  };

  let resolvedTranscript = transcript && transcript.trim() ? transcript.trim() : null;
  if (audioUrl && !resolvedTranscript) {
    const tr = await transcribeAudioFile(audioUrl);
    if (tr?.transcript) resolvedTranscript = tr.transcript;
  }

  const effectivePrompt = (prompt || '').trim() || resolvedTranscript || 'مرحبًا';

  // Include recent turns from the active AI session so LM AI remembers conversation history!
  let sessionHistoryContext: string | undefined;
  if (sessionId) {
    const prevRows = db.prepare(
      'SELECT role, content, transcript FROM ai_messages WHERE session_id = ? ORDER BY rowid DESC LIMIT 10'
    ).all(sessionId) as Array<{ role: string; content: string; transcript?: string | null }>;
    if (prevRows.length > 0) {
      sessionHistoryContext = prevRows
        .reverse()
        .map(r => `${r.role === 'user' ? 'المستخدم' : 'LM AI'}: ${r.transcript || r.content}`)
        .join('\n');
    }
  }

  const result = await runLmAi({
    ...req.body,
    prompt: effectivePrompt,
    sharedContext: sessionHistoryContext || req.body.sharedContext,
  });

  // Persist AI conversation history automatically for ai_tab sessions (including voice turns!)
  let activeSessionId = sessionId || null;
  let userMsgId: string | null = null;
  if (req.body.source === 'ai_tab' && userId && (effectivePrompt || audioUrl)) {
    const nowIso = new Date().toISOString();
    if (!activeSessionId) {
      activeSessionId = `ais_${uuid().slice(0, 8)}`;
      const title = (resolvedTranscript || effectivePrompt || 'رسالة صوتية').trim().slice(0, 48);
      db.prepare(
        'INSERT INTO ai_sessions (id, user_id, title, company_id, model_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(activeSessionId, userId, title, provider || 'gemini', model || '', nowIso);
    } else {
      db.prepare(
        'UPDATE ai_sessions SET company_id = ?, model_id = ?, updated_at = ? WHERE id = ?'
      ).run(provider || 'gemini', model || '', nowIso, activeSessionId);
    }

    userMsgId = `aim_${uuid().slice(0, 8)}`;
    db.prepare(
      'INSERT INTO ai_messages (id, session_id, role, content, audio_url, transcript, company_id, model_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      userMsgId,
      activeSessionId,
      'user',
      (prompt || '').trim() || (audioUrl ? 'رسالة صوتية' : effectivePrompt),
      audioUrl || null,
      resolvedTranscript,
      provider || 'gemini',
      model || ''
    );

    db.prepare(
      'INSERT INTO ai_messages (id, session_id, role, content, company_id, model_label) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(`aim_${uuid().slice(0, 8)}`, activeSessionId, 'assistant', result.reply, provider || 'gemini', result.modelUsed || model || '');
  }

  res.json({ ...result, sessionId: activeSessionId, userMsgId, transcribedPrompt: resolvedTranscript });
});

app.post('/api/ai/chat/stream', async (req, res) => {
  const { userId, prompt, provider, model, sessionId, audioUrl, transcript, attachmentUrl, attachmentName } = req.body as {
    userId: string;
    prompt?: string;
    provider?: string;
    model?: string;
    sessionId?: string | null;
    audioUrl?: string | null;
    transcript?: string | null;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
  };

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (obj: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    let resolvedTranscript = transcript && transcript.trim() ? transcript.trim() : null;
    if (audioUrl && !resolvedTranscript) {
      const tr = await transcribeAudioFile(audioUrl);
      if (tr?.transcript) resolvedTranscript = tr.transcript;
    }

    const effectivePrompt = (prompt || '').trim() || resolvedTranscript || (attachmentName ? `حلّل الملف المرفق: ${attachmentName}` : 'مرحبًا');

    let sessionHistoryContext: string | undefined;
    if (sessionId) {
      const prevRows = db.prepare(
        'SELECT role, content, transcript FROM ai_messages WHERE session_id = ? ORDER BY rowid DESC LIMIT 10'
      ).all(sessionId) as Array<{ role: string; content: string; transcript?: string | null }>;
      if (prevRows.length > 0) {
        sessionHistoryContext = prevRows
          .reverse()
          .map(r => `${r.role === 'user' ? 'المستخدم' : 'LM AI'}: ${r.transcript || r.content}`)
          .join('\n');
      }
    }

    const result = await streamLmAi(
      {
        ...req.body,
        prompt: effectivePrompt,
        attachmentUrl,
        attachmentName,
        sharedContext: sessionHistoryContext || req.body.sharedContext,
      },
      delta => {
        sendEvent({ type: 'delta', text: delta });
      }
    );

    let activeSessionId = sessionId || null;
    let userMsgId: string | null = null;
    if (req.body.source === 'ai_tab' && userId && (effectivePrompt || audioUrl)) {
      const nowIso = new Date().toISOString();
      if (!activeSessionId) {
        activeSessionId = `ais_${uuid().slice(0, 8)}`;
        const title = (resolvedTranscript || effectivePrompt || 'رسالة صوتية').trim().slice(0, 48);
        db.prepare(
          'INSERT INTO ai_sessions (id, user_id, title, company_id, model_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(activeSessionId, userId, title, provider || 'gemini', model || '', nowIso);
      } else {
        db.prepare(
          'UPDATE ai_sessions SET company_id = ?, model_id = ?, updated_at = ? WHERE id = ?'
        ).run(provider || 'gemini', model || '', nowIso, activeSessionId);
      }

      userMsgId = `aim_${uuid().slice(0, 8)}`;
      db.prepare(
        'INSERT INTO ai_messages (id, session_id, role, content, audio_url, transcript, company_id, model_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        userMsgId,
        activeSessionId,
        'user',
        (prompt || '').trim() || (audioUrl ? 'رسالة صوتية' : effectivePrompt),
        audioUrl || null,
        resolvedTranscript,
        provider || 'gemini',
        model || ''
      );

      db.prepare(
        'INSERT INTO ai_messages (id, session_id, role, content, company_id, model_label) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(`aim_${uuid().slice(0, 8)}`, activeSessionId, 'assistant', result.reply, provider || 'gemini', result.modelUsed || model || '');
    }

    sendEvent({
      type: 'done',
      ok: result.ok,
      reply: result.reply,
      providerUsed: result.providerUsed,
      modelUsed: result.modelUsed,
      needsApiKey: result.needsApiKey,
      missingProvider: result.missingProvider,
      sessionId: activeSessionId,
      userMsgId,
      transcribedPrompt: resolvedTranscript,
    });
  } catch (err) {
    sendEvent({
      type: 'error',
      message: err instanceof Error ? err.message : 'تعذر البث المباشر للرد.',
    });
  } finally {
    res.end();
  }
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

function escapeHtmlAttr(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildDynamicOgMeta(req: express.Request): {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
} {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || 'localhost:4000');
  const origin = `${proto}://${host}`;
  const fullUrl = `${origin}${req.originalUrl}`;
  const toAbs = (p?: string | null) => {
    if (!p) return `${origin}/lm-icon-512.png`;
    if (/^https?:\/\//i.test(p)) return p;
    return `${origin}${p.startsWith('/') ? p : `/${p}`}`;
  };

  let title = 'LM — المنصة الرقمية المتكاملة';
  let description = 'المجتمع، نبض، بث مباشر، دردشة فورية، وLM AI في تطبيق واحد.';
  let image = `${origin}/lm-icon-512.png`;
  let type = 'website';

  const postMatch = req.path.match(/^\/post\/([^/]+)$/);
  const postId = postMatch ? decodeURIComponent(postMatch[1]) : String(req.query.post || '').trim();
  if (postId) {
    const r = db.prepare(`
      SELECT p.content, p.media_url, p.media_urls_json, u.display_name, u.username, u.avatar_url
      FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?
    `).get(postId) as Record<string, unknown> | undefined;
    if (r) {
      let mediaUrls: string[] = [];
      try { mediaUrls = JSON.parse(String(r.media_urls_json || '[]')); } catch { mediaUrls = []; }
      const firstImg = mediaUrls[0] || (r.media_url ? String(r.media_url) : null) || (r.avatar_url ? String(r.avatar_url) : null);
      title = `${String(r.display_name)} (@${String(r.username)}) على LM`;
      const snippet = String(r.content || '').replace(/\s+/g, ' ').trim();
      description = snippet ? (snippet.length > 165 ? `${snippet.slice(0, 162)}...` : snippet) : 'منشور مشارَك على منصة LM';
      image = toAbs(firstImg);
      type = 'article';
      return { title, description, image, url: fullUrl, type };
    }
  }

  const userMatch = req.path.match(/^\/u\/([^/]+)$/);
  const handle = userMatch ? decodeURIComponent(userMatch[1]) : String(req.query.user || '').trim();
  if (handle) {
    const clean = handle.replace(/^@/, '').toLowerCase();
    const u = db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR id = ?').get(clean, handle) as Record<string, unknown> | undefined;
    if (u) {
      title = `${String(u.display_name)} (@${String(u.username)}) • LM`;
      const bio = String(u.bio || '').replace(/\s+/g, ' ').trim();
      const loc = u.location ? ` • ${String(u.location)}` : '';
      description = bio ? `${bio.slice(0, 150)}${loc}` : `الملف الشخصي لـ ${String(u.display_name)} على LM`;
      image = toAbs((u.cover_url as string | null) || (u.avatar_url as string | null));
      type = 'profile';
      return { title, description, image, url: fullUrl, type };
    }
  }

  const videoMatch = req.path.match(/^\/pulse\/([^/]+)$/);
  const videoId = videoMatch ? decodeURIComponent(videoMatch[1]) : String(req.query.video || '').trim();
  if (videoId) {
    const v = db.prepare(`
      SELECT v.title, v.description, v.tags, v.poster_url, u.display_name, u.username, u.avatar_url
      FROM short_videos v JOIN users u ON v.user_id = u.id WHERE v.id = ?
    `).get(videoId) as Record<string, unknown> | undefined;
    if (v) {
      title = `${String(v.title)} — ${String(v.display_name)} على نبض LM`;
      const desc = String(v.description || v.tags || '').trim();
      description = desc || `شاهد هذا الفيديو القصير من @${String(v.username)} على LM`;
      image = toAbs((v.poster_url as string | null) || (v.avatar_url as string | null));
      type = 'video.other';
      return { title, description, image, url: fullUrl, type };
    }
  }

  const liveMatch = req.path.match(/^\/live\/([^/]+)$/);
  const liveId = liveMatch ? decodeURIComponent(liveMatch[1]) : String(req.query.live || '').trim();
  if (liveId) {
    const lr = db.prepare(`
      SELECT r.title, r.category, u.display_name, u.avatar_url
      FROM live_rooms r JOIN users u ON r.host_id = u.id WHERE r.id = ?
    `).get(liveId) as Record<string, unknown> | undefined;
    if (lr) {
      title = `🔴 بث مباشر: ${String(lr.title)} • ${String(lr.display_name)}`;
      description = `شاهد البث المباشر الآن على LM (${String(lr.category || 'عام')})`;
      image = toAbs(lr.avatar_url as string | null);
      type = 'video.other';
      return { title, description, image, url: fullUrl, type };
    }
  }

  return { title, description, image, url: fullUrl, type };
}

const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  app.get('*', (req, res) => {
    const indexPath = path.join(distDir, 'index.html');
    try {
      let html = fs.readFileSync(indexPath, 'utf-8');
      const og = buildDynamicOgMeta(req);
      const ogTags = `
    <meta property="og:site_name" content="LM" />
    <meta property="og:type" content="${escapeHtmlAttr(og.type)}" />
    <meta property="og:title" content="${escapeHtmlAttr(og.title)}" />
    <meta property="og:description" content="${escapeHtmlAttr(og.description)}" />
    <meta property="og:image" content="${escapeHtmlAttr(og.image)}" />
    <meta property="og:url" content="${escapeHtmlAttr(og.url)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(og.title)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(og.description)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(og.image)}" />`;
      html = html
        .replace(/<title>.*?<\/title>/i, `<title>${escapeHtmlAttr(og.title)}</title>`)
        .replace(/<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escapeHtmlAttr(og.description)}" />`)
        .replace('</head>', `${ogTags}\n  </head>`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch {
      res.sendFile(indexPath);
    }
  });
}

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`\n  ✦ LM Core v6 running at http://localhost:${PORT}\n`);
});
