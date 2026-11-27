import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import { v4 as uuid } from 'uuid';

import { db, DB_PATH, initDatabase, mapUserRow, loadProviderConfig, saveProviderConfig, UPLOADS_DIR } from './db.ts';
import {
  getCloudStorageStatus,
  isTrustedMediaUrl,
  loadTrustedMediaBytes,
  storeVerifiedMedia,
} from './cloudStorage.ts';
import { flushCloudDbBeforeExit, getCloudDbSyncMeta, scheduleCloudDbSync } from './cloudPersistence.ts';
import { liveEngine } from './liveEngine.ts';
import { runLmAi, streamLmAi } from './aiGateway.ts';
import {
  buildUserInterestProfile,
  LICENSED_MUSIC_LIBRARY,
  rankFeedItems,
  recordUserInteraction,
} from './recommendEngine.ts';
import { enforceCanonicalExtension, verifyUploadedFile } from './uploadSecurity.ts';
import {
  clearSessionCookie,
  createRateLimiter,
  extractDeviceId,
  extractRequestToken,
  hashPassword,
  isHashedPassword,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './authSecurity.ts';
import {
  computePostPositiveEngagement,
  computeSensitiveReportThreshold,
  isContentSensitive,
} from './moderation.ts';
import { CountryCode } from './types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
initDatabase();

const app = express();
app.set('trust proxy', 1);
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: allowedOrigin === '*' ? true : allowedOrigin.split(',').map(s => s.trim()),
    credentials: true,
  })
);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Allow embedding cleanly inside Hugging Face Spaces iframe while preventing clickjacking elsewhere
  if (process.env.SPACE_ID) {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://huggingface.co https://*.hf.space");
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  // Lightweight zero-dependency gzip for JSON API responses (> 1 KB)
  const acceptsGzip = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
  if (acceptsGzip && req.method !== 'HEAD' && req.path.startsWith('/api/') && !req.path.includes('stream')) {
    const origJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.headersSent) return origJson(body);
      try {
        const raw = Buffer.from(JSON.stringify(body), 'utf8');
        if (raw.length >= 1024) {
          const gz = zlib.gzipSync(raw, { level: 6 });
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Vary', 'Accept-Encoding');
          res.setHeader('Content-Length', String(gz.length));
          return res.end(gz);
        }
      } catch {
        // fallback to normal JSON response
      }
      return origJson(body);
    }) as typeof res.json;
  }
  next();
});
app.use(express.json({ limit: '16mb' }));

// Trigger debounced encrypted-in-transit SQLite cloud snapshot on Supabase after any mutating API call
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/') &&
    (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') &&
    req.path !== '/api/upload' &&
    req.path !== '/api/translate'
  ) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        scheduleCloudDbSync(db, DB_PATH);
      }
    });
  }
  next();
});

// Phase 1 Zero-Cost Sliding-Window Rate Limiters
const authLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 40, message: 'محاولات دخول كثيرة، حاول بعد دقائق.' });
const uploadLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 60, message: 'تجاوزت حد رفع الملفات المؤقت، انتظر قليلًا.' });
const reportLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 35, message: 'يرجى الانتظار قبل إرسال إبلاغات إضافية.' });
const aiLimiter = createRateLimiter({ windowMs: 60_000, max: 30, message: 'طلبات الذكاء الاصطناعي سريعة جدًا، انتظر بضع ثوانٍ.' });
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
    res.setHeader('Cache-Control', 'public, max-age=86400');
    next();
  },
  express.static(UPLOADS_DIR, { maxAge: '1d', acceptRanges: true })
);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, _file, cb) => {
    // Never trust user extension prior to binary magic-byte inspection!
    cb(null, `${Date.now()}-${uuid().slice(0, 10)}.tmp`);
  },
});
const upload = multer({ storage, limits: { fileSize: 65 * 1024 * 1024, files: 1 } });

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

function loadQuotedPostMap(quotedIds: string[]) {
  const unique = Array.from(new Set(quotedIds.filter(Boolean)));
  const map = new Map<string, {
    id: string;
    userId: string;
    displayName: string;
    username: string;
    avatarInitials: string;
    avatarUrl: string | null;
    verified: boolean;
    content: string;
    mediaUrl: string | null;
    createdAt: string;
  }>();
  if (unique.length === 0) return map;
  const placeholders = unique.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT p.id, p.user_id, p.content, p.media_url, p.media_urls_json, p.created_at,
           u.display_name, u.username, u.avatar_initials, u.avatar_url, u.verified
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.id IN (${placeholders})
  `).all(...unique) as Array<Record<string, unknown>>;
  for (const r of rows) {
    let mediaUrl: string | null = r.media_url ? String(r.media_url) : null;
    if (!mediaUrl && r.media_urls_json) {
      try {
        const arr = JSON.parse(String(r.media_urls_json));
        if (Array.isArray(arr) && arr[0]) mediaUrl = String(arr[0]);
      } catch {
        // ignore
      }
    }
    map.set(String(r.id), {
      id: String(r.id),
      userId: String(r.user_id),
      displayName: String(r.display_name || 'مستخدم'),
      username: String(r.username || 'user'),
      avatarInitials: String(r.avatar_initials || 'LM'),
      avatarUrl: r.avatar_url ? String(r.avatar_url) : null,
      verified: Boolean(r.verified),
      content: String(r.content || ''),
      mediaUrl,
      createdAt: String(r.created_at || ''),
    });
  }
  return map;
}

function getReportCountsMap(targetType: string): Map<string, number> {
  const map = new Map<string, number>();
  const rows = db.prepare(
    'SELECT target_id, COUNT(*) as c FROM content_reports WHERE target_type = ? GROUP BY target_id'
  ).all(targetType) as Array<{ target_id: string; c: number }>;
  for (const r of rows) map.set(r.target_id, Number(r.c || 0));
  return map;
}

function getActiveStoryUserSet(): Set<string> {
  const rows = db.prepare('SELECT DISTINCT user_id FROM stories').all() as Array<{ user_id: string }>;
  return new Set(rows.map(r => r.user_id));
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
  res.json({
    ok: true,
    service: 'LM Core v6',
    mode: 'phase1-free',
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    wsClients: wsClients.size,
    cloud: {
      ...getCloudStorageStatus(),
      dbSync: getCloudDbSyncMeta(),
    },
  });
});

app.post('/api/upload', uploadLimiter, (req, res) => {
  upload.single('file')(req, res, async err => {
    if (err) {
      const code = (err as { code?: string }).code;
      if (code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ ok: false, error: 'حجم الملف يتجاوز الحد الأقصى المسموح على المنصة (65MB).' });
      }
      return res.status(400).json({ ok: false, error: 'تعذر استلام الملف المرفوع.' });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: 'لم يتم إرسال أي ملف.' });

    const uploadContext = String(req.query.context || req.body?.context || 'general');
    const verdict = verifyUploadedFile(req.file.path, req.file.mimetype, uploadContext);
    if (!verdict.ok) {
      try {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch {
        // ignore cleanup error
      }
      return res.status(400).json({ ok: false, error: verdict.error, code: verdict.code });
    }

    let finalPath = req.file.path;
    try {
      finalPath = enforceCanonicalExtension(req.file.path, verdict.extension);
    } catch {
      try {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch {
        // ignore
      }
      return res.status(500).json({ ok: false, error: 'تعذر حفظ الملف بعد فحصه أمنيًا.' });
    }

    const safeFilename = path.basename(finalPath);
    const stored = await storeVerifiedMedia({
      filePath: finalPath,
      safeFilename,
      mimeType: verdict.mimeType,
    });
    res.json({
      ok: true,
      url: stored.url,
      storage: stored.storage,
      originalName: path.basename(req.file.originalname || safeFilename).slice(0, 120),
      mimeType: verdict.mimeType,
      category: verdict.category,
      size: verdict.size,
      width: verdict.width,
      height: verdict.height,
    });
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
  if (!isTrustedMediaUrl(audioUrl)) return null;
  const loaded = await loadTrustedMediaBytes(audioUrl, UPLOADS_DIR, 20 * 1024 * 1024);
  if (!loaded) return null;

  const cfg = loadProviderConfig();
  const audioBuffer = loaded.buffer;
  const mimeType = loaded.mimeType.startsWith('audio/') ? loaded.mimeType : detectAudioMime(loaded.filename);
  const audioFilename = loaded.filename;

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
      form.append('file', new Blob([new Uint8Array(audioBuffer)], { type: mimeType }), audioFilename);
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

  if (!isTrustedMediaUrl(audioUrl)) {
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
// AUTH, DEVICE-BOUND IDENTITY & ANTI-IMPERSONATION SECURITY
// ============================================================
function getClientIp(req: express.Request): string {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (fwd || req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '').slice(0, 64);
}

function parseDeviceProfileHeader(req: express.Request): {
  deviceName: string;
  platform: string;
  browser: string;
  screenInfo: string;
  timezone: string;
  userAgent: string;
} {
  const ua = String(req.headers['user-agent'] || '').slice(0, 220);
  let platform = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'iOS'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Macintosh|Mac OS/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Web';
  let browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\//i.test(ua)
      ? 'Opera'
      : /Chrome\//i.test(ua)
        ? 'Chrome'
        : /Safari\//i.test(ua)
          ? 'Safari'
          : /Firefox\//i.test(ua)
            ? 'Firefox'
            : 'Browser';
  let screenInfo = '';
  let timezone = '';
  try {
    const raw = String(req.headers['x-lm-device-profile'] || '');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.platform) platform = String(parsed.platform).slice(0, 32);
      if (parsed.browser) browser = String(parsed.browser).slice(0, 32);
      if (parsed.screen) screenInfo = String(parsed.screen).slice(0, 32);
      if (parsed.tz) timezone = String(parsed.tz).slice(0, 48);
    }
  } catch {
    // ignore malformed header
  }
  return {
    deviceName: `${platform} · ${browser}`,
    platform,
    browser,
    screenInfo,
    timezone,
    userAgent: ua,
  };
}

function bindDeviceToUser(req: express.Request, res: express.Response, userId: string): string {
  const deviceId = extractDeviceId(req) || `dev_${crypto.randomBytes(12).toString('hex')}`;
  const info = parseDeviceProfileHeader(req);
  const ip = getClientIp(req);

  // Deactivate any other account previously marked active on this exact physical device
  db.prepare('UPDATE user_devices SET is_active = 0 WHERE device_id = ? AND user_id != ?').run(deviceId, userId);

  db.prepare(`
    INSERT INTO user_devices (device_id, user_id, device_name, platform, browser, screen_info, timezone, last_ip, user_agent, is_active, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    ON CONFLICT(device_id, user_id) DO UPDATE SET
      device_name = excluded.device_name,
      platform = excluded.platform,
      browser = excluded.browser,
      screen_info = excluded.screen_info,
      timezone = excluded.timezone,
      last_ip = excluded.last_ip,
      user_agent = excluded.user_agent,
      is_active = 1,
      last_seen_at = datetime('now')
  `).run(deviceId, userId, info.deviceName, info.platform, info.browser, info.screenInfo, info.timezone, ip, info.userAgent);

  const token = signSessionToken(userId);
  setSessionCookie(res, token, deviceId);
  return token;
}

app.get('/api/auth/users', (_req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY followers_count DESC').all() as Array<Record<string, unknown>>;
  res.json({ ok: true, users: rows.map(mapUserRow) });
});

app.get('/api/auth/me', (req, res) => {
  const deviceId = extractDeviceId(req);
  const token = extractRequestToken(req);
  const verified = verifySessionToken(token);

  if (verified) {
    const user = getUserOrNull(verified.userId);
    if (user) {
      if (deviceId) {
        const info = parseDeviceProfileHeader(req);
        const ip = getClientIp(req);
        db.prepare(`
          INSERT INTO user_devices (device_id, user_id, device_name, platform, browser, screen_info, timezone, last_ip, user_agent, is_active, last_seen_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
          ON CONFLICT(device_id, user_id) DO UPDATE SET
            last_ip = excluded.last_ip,
            last_seen_at = datetime('now'),
            is_active = 1
        `).run(deviceId, user.id, info.deviceName, info.platform, info.browser, info.screenInfo, info.timezone, ip, info.userAgent);
      }
      return res.json({ ok: true, user, deviceBound: Boolean(deviceId) });
    }
  }

  // Seamless Device-Bound Auto-Login: If user's device is already bound & active, resume automatically (ZERO re-typing!)
  if (deviceId) {
    const bound = db
      .prepare('SELECT user_id FROM user_devices WHERE device_id = ? AND is_active = 1 ORDER BY last_seen_at DESC LIMIT 1')
      .get(deviceId) as { user_id: string } | undefined;
    if (bound?.user_id) {
      const user = getUserOrNull(bound.user_id);
      if (user) {
        const freshToken = bindDeviceToUser(req, res, user.id);
        return res.json({ ok: true, user, token: freshToken, autoResumed: true, deviceBound: true });
      }
    }
  }

  return res.json({ ok: true, user: null });
});

// Returns ONLY accounts previously created/signed-in on THIS exact physical device (ZERO exposure of other people's accounts!)
app.get('/api/auth/device-accounts', (req, res) => {
  const deviceId = extractDeviceId(req);
  if (!deviceId) return res.json({ ok: true, accounts: [] });
  const rows = db
    .prepare(`
      SELECT u.*, d.last_seen_at
      FROM user_devices d
      JOIN users u ON d.user_id = u.id
      WHERE d.device_id = ?
      ORDER BY d.last_seen_at DESC
      LIMIT 4
    `)
    .all(deviceId) as Array<Record<string, unknown>>;
  return res.json({ ok: true, accounts: rows.map(mapUserRow) });
});

// Resume ONLY an account cryptographically verified to belong to THIS exact physical device
app.post('/api/auth/device-resume', authLimiter, (req, res) => {
  const deviceId = extractDeviceId(req);
  const { userId } = req.body as { userId?: string };
  if (!deviceId || !userId) {
    return res.status(403).json({ ok: false, error: 'هذا الجهاز غير مرتبط بهذا الحساب.' });
  }
  const bound = db
    .prepare('SELECT 1 FROM user_devices WHERE device_id = ? AND user_id = ?')
    .get(deviceId, userId);
  if (!bound) {
    return res.status(403).json({ ok: false, error: 'لا يمكنك الدخول لحساب غير مرتبط بجهازك.' });
  }
  const user = getUserOrNull(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'الحساب غير موجود.' });
  const token = bindDeviceToUser(req, res, user.id);
  return res.json({ ok: true, user, token });
});

// List trusted devices for the currently signed-in account
app.get('/api/auth/devices', (req, res) => {
  const token = extractRequestToken(req);
  const verified = verifySessionToken(token);
  if (!verified) return res.status(401).json({ ok: false, error: 'غير مصرح.' });
  const currentDeviceId = extractDeviceId(req);
  const rows = db
    .prepare('SELECT device_id, device_name, platform, browser, screen_info, timezone, last_ip, is_active, created_at, last_seen_at FROM user_devices WHERE user_id = ? ORDER BY last_seen_at DESC')
    .all(verified.userId) as Array<Record<string, unknown>>;
  res.json({
    ok: true,
    devices: rows.map(r => ({
      deviceId: String(r.device_id),
      deviceName: String(r.device_name || 'Unknown Device'),
      platform: String(r.platform || ''),
      browser: String(r.browser || ''),
      screenInfo: String(r.screen_info || ''),
      timezone: String(r.timezone || ''),
      lastIp: String(r.last_ip || ''),
      isActive: Boolean(r.is_active),
      isCurrent: Boolean(currentDeviceId && String(r.device_id) === currentDeviceId),
      createdAt: String(r.created_at || ''),
      lastSeenAt: String(r.last_seen_at || ''),
    })),
  });
});

// Optional: Let quick-registered users set a personal password to log in from another device
app.post('/api/auth/set-password', authLimiter, (req, res) => {
  const token = extractRequestToken(req);
  const verified = verifySessionToken(token);
  if (!verified) return res.status(401).json({ ok: false, error: 'يجب تسجيل الدخول أولًا.' });
  const { password } = req.body as { password?: string };
  const clean = String(password || '').trim();
  if (clean.length < 4) return res.status(400).json({ ok: false, error: 'كلمة المرور 4 أحرف على الأقل.' });
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(clean), verified.userId);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  const deviceId = extractDeviceId(req);
  if (deviceId) {
    db.prepare('UPDATE user_devices SET is_active = 0 WHERE device_id = ?').run(deviceId);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username) return res.status(400).json({ ok: false, error: 'Enter your username.' });
  const clean = username.trim().replace(/^@/, '').toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(clean) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'Account not found.' });
  const storedPassword = String(row.password || '');
  // STRICT anti-impersonation check: password is ALWAYS required (ZERO empty-password bypass!)
  if (!password || !verifyPassword(password, storedPassword)) {
    return res.status(401).json({ ok: false, error: 'Incorrect password.' });
  }
  // Transparently upgrade legacy plaintext passwords to Scrypt hash on successful login!
  if (!isHashedPassword(storedPassword)) {
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(password), String(row.id));
  }
  const user = mapUserRow(row);
  const token = bindDeviceToUser(req, res, user.id);
  res.json({ ok: true, user, token });
});

app.post('/api/auth/register', authLimiter, (req, res) => {
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
  const hashedPw = hashPassword((password || '123456').trim() || '123456');

  db.prepare(`
    INSERT INTO users (id, username, password, display_name, display_name_en, bio, avatar_color, avatar_initials, country, demo_balance_egp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, cleanUser, hashedPw, displayName.trim(), displayName.trim(), 'عضو في LM', '#27272A', initials, country || 'EG', 10000);

  const user = getUserOrNull(id);
  const token = bindDeviceToUser(req, res, id);
  res.json({ ok: true, user, token });
});

function randomAlphaNum(len: number): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Frictionless Name-Only Registration (Strict 3-word max, bound permanently to THIS device!)
app.post('/api/auth/quick-register', authLimiter, (req, res) => {
  const { displayName, country } = req.body as { displayName?: string; country?: CountryCode };
  const cleanName = String(displayName || '').trim().replace(/\s+/g, ' ');
  if (cleanName.length < 2) {
    return res.status(400).json({ ok: false, error: 'Please enter your name.' });
  }
  if (cleanName.length > 48) {
    return res.status(400).json({ ok: false, error: 'Name is too long.' });
  }
  const words = cleanName.split(' ').filter(Boolean);
  if (words.length > 3) {
    return res.status(400).json({ ok: false, error: 'Maximum 3 words allowed.' });
  }

  const asciiBase = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 12);
  let cleanUser = asciiBase.length >= 3 ? `${asciiBase}_${randomAlphaNum(4)}` : `lm_${randomAlphaNum(7)}`;
  while (db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUser)) {
    cleanUser = `lm_${randomAlphaNum(8)}`;
  }

  const id = `u_${uuid().slice(0, 8)}`;
  const initials = words.slice(0, 2).map(w => w[0]).join('') || 'LM';
  const hashedPw = hashPassword(uuid());

  db.prepare(`
    INSERT INTO users (id, username, password, display_name, display_name_en, bio, avatar_color, avatar_initials, avatar_url, country, demo_balance_egp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, cleanUser, hashedPw, cleanName, cleanName, 'عضو جديد في منصة LM', '#27272A', initials, 'lm:neutral', country || 'EG', 10000);

  const user = getUserOrNull(id);
  const token = bindDeviceToUser(req, res, id);
  res.json({ ok: true, user, token });
});

// TikTok-Style Instant Guest / Trial Account (Bound permanently to THIS device so guest stays signed in!)
app.post('/api/auth/guest', authLimiter, (req, res) => {
  let guestHandle = `user_${randomAlphaNum(8)}`;
  while (db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(guestHandle)) {
    guestHandle = `user_${randomAlphaNum(9)}`;
  }
  const id = `u_g_${uuid().slice(0, 7)}`;
  const hashedPw = hashPassword(uuid());

  db.prepare(`
    INSERT INTO users (id, username, password, display_name, display_name_en, bio, avatar_color, avatar_initials, avatar_url, country, demo_balance_egp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, guestHandle, hashedPw, guestHandle, guestHandle, 'حساب تجريبي على منصة LM', '#27272A', 'LM', 'lm:neutral', 'EG', 10000);

  const user = getUserOrNull(id);
  const token = bindDeviceToUser(req, res, id);
  res.json({ ok: true, user, token, isGuest: true });
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
    SELECT p.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified, 0 as is_repost, p.rowid as sort_ord
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ?
    UNION ALL
    SELECT p.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified, 1 as is_repost, (pr.rowid + 1000000) as sort_ord
    FROM post_reposts pr
    JOIN posts p ON pr.post_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE pr.user_id = ? AND p.user_id != ?
    ORDER BY sort_ord DESC
  `).all(targetId, targetId, targetId) as Array<Record<string, unknown>>;

  const viewerRepostSet = new Set(
    (viewerId
      ? (db.prepare('SELECT post_id FROM post_reposts WHERE user_id = ?').all(viewerId) as Array<{ post_id: string }>)
      : []
    ).map(r => r.post_id)
  );

  const profileQuotedMap = loadQuotedPostMap(postRows.map(r => String(r.quoted_post_id || '')));

  const posts = postRows.map(r => {
    let mediaUrls: string[] = [];
    try { mediaUrls = JSON.parse(String(r.media_urls_json || '[]')); } catch { mediaUrls = []; }
    if (mediaUrls.length === 0 && r.media_url) mediaUrls = [String(r.media_url)];
    const isRepost = Number(r.is_repost || 0) === 1;
    const quotedId = r.quoted_post_id ? String(r.quoted_post_id) : '';
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
      musicUrl: r.music_url ? String(r.music_url) : null,
      musicTitle: r.music_title ? String(r.music_title) : null,
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
      repostedByMe: viewerRepostSet.has(String(r.id)),
      repostedBy: isRepost
        ? { userId: user.id, displayName: user.displayName, username: user.username }
        : null,
      quotedPost: quotedId ? profileQuotedMap.get(quotedId) || null : null,
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

  const hasActiveStory = getActiveStoryUserSet().has(targetId);

  res.json({ ok: true, user, isFollowing, hasActiveStory, posts, videos, savedPosts, savedVideos, followersList, followingList });
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
    recordUserInteraction({
      userId: followerId,
      targetType: 'user',
      targetId,
      authorId: targetId,
      text: `${target.displayName} ${target.bio || ''}`,
      action: 'follow',
      weight: 7,
    });
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
// LICENSED ROYALTY-FREE MUSIC, AI RECOMMENDATIONS, REPORTS & UNIFIED HASHTAGS
// ============================================================
app.get('/api/music/library', (req, res) => {
  const userId = String(req.query.userId || '');
  const userRows = (
    userId
      ? db.prepare(`
          SELECT t.*, u.display_name
          FROM user_audio_tracks t LEFT JOIN users u ON t.user_id = u.id
          WHERE t.user_id = ?
          ORDER BY t.rowid DESC LIMIT 40
        `).all(userId)
      : []
  ) as Array<Record<string, unknown>>;

  const userTracks = userRows.map(r => ({
    id: String(r.id),
    title: String(r.title),
    artist: `${String(r.display_name || 'مستخدم')} · LM`,
    mood: String(r.kind) === 'voice' ? 'صوتي' : 'مرفوعاتي',
    durationSec: Number(r.duration_sec || 15),
    license: 'LM Audio',
    accent: String(r.kind) === 'voice' ? '#FB7185' : '#34D399',
    isUserTrack: true,
    kind: (String(r.kind) === 'voice' ? 'voice' : 'upload') as 'voice' | 'upload',
    url: String(r.url),
  }));

  const studioTracks = LICENSED_MUSIC_LIBRARY.map(t => ({
    ...t,
    isUserTrack: false,
    kind: 'studio' as const,
  }));

  res.json({ ok: true, userTracks, tracks: [...userTracks, ...studioTracks] });
});

app.post('/api/music/user-tracks', (req, res) => {
  const { userId, url, title, durationSec, kind } = req.body as {
    userId?: string;
    url?: string;
    title?: string;
    durationSec?: number;
    kind?: 'upload' | 'voice';
  };
  if (!userId || !url) return res.status(400).json({ ok: false, error: 'بيانات المقطع الصوتي غير مكتملة.' });
  const u = getUserOrNull(userId);
  if (!u) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });

  const trackKind = kind === 'voice' ? 'voice' : 'upload';
  const dur = Math.max(1, Math.min(trackKind === 'voice' ? 60 : 300, Math.round(Number(durationSec || 15))));
  if (trackKind === 'voice' && Number(durationSec || 0) > 61) {
    return res.status(400).json({ ok: false, error: 'الحد الأقصى للتسجيل الصوتي هو 60 ثانية (دقيقة واحدة).' });
  }

  // Always brand user voice/uploads cleanly with user name + LM signature!
  const cleanCustom = (title || '').trim();
  const brandedTitle =
    trackKind === 'voice'
      ? `${u.displayName} · LM`
      : cleanCustom
        ? `${cleanCustom.slice(0, 38)} · ${u.displayName} · LM`
        : `${u.displayName} · LM`;

  const id = `utrk_${uuid().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO user_audio_tracks (id, user_id, title, url, duration_sec, kind)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, brandedTitle, url, dur, trackKind);

  res.json({
    ok: true,
    track: {
      id,
      title: brandedTitle,
      artist: `${u.displayName} · LM`,
      mood: trackKind === 'voice' ? 'صوتي' : 'مرفوعاتي',
      durationSec: dur,
      license: 'LM Audio',
      accent: trackKind === 'voice' ? '#FB7185' : '#34D399',
      isUserTrack: true,
      kind: trackKind,
      url,
    },
  });
});

app.delete('/api/music/user-tracks/:id', (req, res) => {
  const userId = String(req.query.userId || '');
  const row = db.prepare('SELECT user_id FROM user_audio_tracks WHERE id = ?').get(req.params.id) as { user_id: string } | undefined;
  if (!row) return res.status(404).json({ ok: false });
  if (userId && row.user_id !== userId) return res.status(403).json({ ok: false });
  db.prepare('DELETE FROM user_audio_tracks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/recommendations/profile', (req, res) => {
  const userId = String(req.query.userId || '');
  const profile = buildUserInterestProfile(userId);
  res.json({
    ok: true,
    followingCount: profile.followingSet.size,
    topTopics: profile.topTopics,
  });
});

app.post('/api/reports', reportLimiter, (req, res) => {
  const { targetType, targetId, reporterId, reason } = req.body as {
    targetType?: 'post' | 'post_comment' | 'video' | 'video_comment' | 'live';
    targetId?: string;
    reporterId?: string;
    reason?: string;
  };
  if (!targetType || !targetId || !reporterId) {
    return res.status(400).json({ ok: false, error: 'بيانات الإبلاغ غير مكتملة.' });
  }
  // Never allow reporting your own content!
  const ownerRow =
    targetType === 'post'
      ? (db.prepare('SELECT user_id as owner_id FROM posts WHERE id = ?').get(targetId) as { owner_id?: string } | undefined)
      : targetType === 'post_comment'
        ? (db.prepare('SELECT user_id as owner_id FROM post_comments WHERE id = ?').get(targetId) as { owner_id?: string } | undefined)
        : targetType === 'video'
          ? (db.prepare('SELECT user_id as owner_id FROM short_videos WHERE id = ?').get(targetId) as { owner_id?: string } | undefined)
          : targetType === 'video_comment'
            ? (db.prepare('SELECT user_id as owner_id FROM video_comments WHERE id = ?').get(targetId) as { owner_id?: string } | undefined)
            : (db.prepare('SELECT host_id as owner_id FROM live_rooms WHERE id = ?').get(targetId) as { owner_id?: string } | undefined);
  if (ownerRow?.owner_id && ownerRow.owner_id === reporterId) {
    return res.status(400).json({ ok: false, error: 'لا يمكنك الإبلاغ عن المحتوى الخاص بك.' });
  }
  const cleanReason = (reason || 'sensitive').trim();
  db.prepare(`
    INSERT OR IGNORE INTO content_reports (id, target_type, target_id, reporter_id, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(`rep_${uuid().slice(0, 8)}`, targetType, targetId, reporterId, cleanReason);

  const cntRow = db.prepare(
    'SELECT COUNT(*) as c FROM content_reports WHERE target_type = ? AND target_id = ?'
  ).get(targetType, targetId) as { c: number };
  const reportsCount = Number(cntRow?.c || 0);
  // Proportional anti-brigading check: scales automatically with positive engagement!
  const isSensitive = isContentSensitive(targetType, targetId, reportsCount);

  // Teach recommendation engine to show less of this reported item/author to reporter
  if (targetType === 'post') {
    const r = db.prepare('SELECT user_id, content FROM posts WHERE id = ?').get(targetId) as { user_id?: string; content?: string } | undefined;
    recordUserInteraction({ userId: reporterId, targetType: 'post', targetId, authorId: r?.user_id, action: 'report', text: r?.content || '' });
  } else if (targetType === 'video') {
    const r = db.prepare('SELECT user_id, title, description, tags FROM short_videos WHERE id = ?').get(targetId) as { user_id?: string; title?: string; description?: string; tags?: string } | undefined;
    recordUserInteraction({ userId: reporterId, targetType: 'video', targetId, authorId: r?.user_id, action: 'report', text: `${r?.title || ''} ${r?.description || ''} ${r?.tags || ''}` });
  } else if (targetType === 'live') {
    const r = db.prepare('SELECT host_id, title, category FROM live_rooms WHERE id = ?').get(targetId) as { host_id?: string; title?: string; category?: string } | undefined;
    recordUserInteraction({ userId: reporterId, targetType: 'live', targetId, authorId: r?.host_id, action: 'report', text: `${r?.title || ''} ${r?.category || ''}` });
  }

  broadcast('content:reported', { targetType, targetId, reportsCount, isSensitive });
  // Discreet response: never leak internal threshold!
  res.json({ ok: true, reportsCount, isSensitive });
});

app.get('/api/hashtags/:tag', (req, res) => {
  const viewerId = String(req.query.userId || '');
  const cleanTag = decodeURIComponent(req.params.tag || '').replace(/^#/, '').trim();
  const likeTag = `%#${cleanTag.toLowerCase()}%`;
  const likePlain = `%${cleanTag.toLowerCase()}%`;

  const postReports = getReportCountsMap('post');
  const videoReports = getReportCountsMap('video');
  const storyUsers = getActiveStoryUserSet();

  const savedSet = new Set(
    (viewerId ? (db.prepare('SELECT post_id FROM post_saves WHERE user_id = ?').all(viewerId) as Array<{ post_id: string }>) : []).map(r => r.post_id)
  );
  const allRx = db.prepare('SELECT post_id, user_id, reaction FROM post_reactions').all() as Array<{ post_id: string; user_id: string; reaction: string }>;
  const rxByPost = new Map<string, Record<string, number>>();
  const myRxMap = new Map<string, string>();
  for (const rx of allRx) {
    const b = rxByPost.get(rx.post_id) || {};
    b[rx.reaction] = (b[rx.reaction] || 0) + 1;
    rxByPost.set(rx.post_id, b);
    if (viewerId && rx.user_id === viewerId) myRxMap.set(rx.post_id, rx.reaction);
  }

  const postRows = db.prepare(`
    SELECT p.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE LOWER(p.content) LIKE ?
    ORDER BY p.rowid DESC
  `).all(likeTag) as Array<Record<string, unknown>>;

  const tagQuotedMap = loadQuotedPostMap(postRows.map(r => String(r.quoted_post_id || '')));

  const posts = postRows.map(r => {
    let mediaUrls: string[] = [];
    try { mediaUrls = JSON.parse(String(r.media_urls_json || '[]')); } catch { mediaUrls = []; }
    if (mediaUrls.length === 0 && r.media_url) mediaUrls = [String(r.media_url)];
    const rCnt = postReports.get(String(r.id)) || 0;
    const rxMap = rxByPost.get(String(r.id)) || {};
    const eng = computePostPositiveEngagement({
      reactions: rxMap,
      likesCount: Number(r.likes_count || 0),
      score: Number(r.score ?? r.likes_count ?? 0),
      commentsCount: Number(r.comments_count || 0),
      sharesCount: Number(r.shares_count || 0),
    });
    const quotedId = r.quoted_post_id ? String(r.quoted_post_id) : '';
    return {
      id: r.id,
      userId: r.user_id,
      displayName: r.display_name,
      username: r.username,
      avatarColor: r.avatar_color,
      avatarInitials: r.avatar_initials,
      avatarUrl: r.avatar_url,
      verified: Boolean(r.verified),
      hasActiveStory: storyUsers.has(String(r.user_id)),
      topic: r.topic || 'عام',
      content: r.content,
      mediaUrl: r.media_url,
      mediaUrls,
      musicUrl: r.music_url ? String(r.music_url) : null,
      musicTitle: r.music_title ? String(r.music_title) : null,
      location: r.location || 'القاهرة',
      poll: null,
      score: Number(r.score ?? r.likes_count ?? 0),
      myVote: 0,
      reactions: rxMap,
      myReaction: myRxMap.get(String(r.id)) || null,
      likesCount: Number(r.likes_count || 0),
      commentsCount: Number(r.comments_count || 0),
      sharesCount: Number(r.shares_count || 0),
      likedByMe: myRxMap.has(String(r.id)),
      savedByMe: savedSet.has(String(r.id)),
      quotedPost: quotedId ? tagQuotedMap.get(quotedId) || null : null,
      isEdited: Boolean(r.is_edited),
      reportsCount: rCnt,
      isSensitive: rCnt >= computeSensitiveReportThreshold(eng),
      createdAt: r.created_at,
    };
  });

  const videoRows = db.prepare(`
    SELECT v.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM short_videos v JOIN users u ON v.user_id = u.id
    WHERE LOWER(v.tags) LIKE ? OR LOWER(v.title) LIKE ? OR LOWER(v.description) LIKE ?
    ORDER BY v.likes_count DESC, v.rowid DESC
  `).all(likePlain, likeTag, likeTag) as Array<Record<string, unknown>>;

  const videos = videoRows.map(r => {
    const rCnt = videoReports.get(String(r.id)) || 0;
    const vidEng = Math.floor(
      Number(r.likes_count || 0) +
        Number(r.comments_count || 0) * 0.5 +
        Number(r.saves_count || 0) * 0.5 +
        Number(r.shares_count || 0) * 0.5
    );
    return {
      id: r.id,
      userId: r.user_id,
      displayName: r.display_name,
      username: r.username,
      avatarColor: r.avatar_color,
      avatarInitials: r.avatar_initials,
      avatarUrl: r.avatar_url,
      verified: Boolean(r.verified),
      hasActiveStory: storyUsers.has(String(r.user_id)),
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
      reportsCount: rCnt,
      isSensitive: rCnt >= computeSensitiveReportThreshold(vidEng),
      createdAt: r.created_at,
    };
  });

  res.json({ ok: true, tag: cleanTag, posts, videos, totalCount: posts.length + videos.length });
});

// ============================================================
// COMMUNITY FEED (Instagram Clean Flow + Voice & @LM AI Comments)
// ============================================================
app.get('/api/stories', (req, res) => {
  const viewerId = String(req.query.userId || '');
  const rows = (
    viewerId
      ? db.prepare(`
          SELECT s.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url
          FROM stories s JOIN users u ON s.user_id = u.id
          WHERE s.user_id = ?
             OR s.user_id IN (SELECT following_id FROM user_follows WHERE follower_id = ?)
          ORDER BY CASE WHEN s.user_id = ? THEN 0 ELSE 1 END, s.rowid DESC
        `).all(viewerId, viewerId, viewerId)
      : db.prepare(`
          SELECT s.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url
          FROM stories s JOIN users u ON s.user_id = u.id
          ORDER BY s.rowid DESC
        `).all()
  ) as Array<Record<string, unknown>>;

  const myActiveStory = viewerId ? rows.some(r => String(r.user_id) === viewerId) : false;

  const allStoryRx = db.prepare('SELECT story_id, user_id, reaction FROM story_reactions').all() as Array<{
    story_id: string;
    user_id: string;
    reaction: string;
  }>;
  const rxByStory = new Map<string, Record<string, number>>();
  const myStoryRx = new Map<string, string>();
  for (const rx of allStoryRx) {
    const bucket = rxByStory.get(rx.story_id) || {};
    bucket[rx.reaction] = (bucket[rx.reaction] || 0) + 1;
    rxByStory.set(rx.story_id, bucket);
    if (viewerId && rx.user_id === viewerId) myStoryRx.set(rx.story_id, rx.reaction);
  }

  res.json({
    ok: true,
    myActiveStory,
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
      reactions: rxByStory.get(String(r.id)) || {},
      myReaction: myStoryRx.get(String(r.id)) || null,
      createdAt: r.created_at,
    })),
  });
});

app.post('/api/stories/:id/react', (req, res) => {
  const storyId = req.params.id;
  const { userId, reaction } = req.body as { userId?: string; reaction?: string };
  if (!userId || !reaction) return res.status(400).json({ ok: false, error: 'بيانات التفاعل غير مكتملة.' });
  const story = db.prepare('SELECT id, user_id, caption FROM stories WHERE id = ?').get(storyId) as
    | { id: string; user_id: string; caption?: string }
    | undefined;
  if (!story) return res.status(404).json({ ok: false, error: 'القصة غير موجودة.' });

  const existing = db.prepare('SELECT id, reaction FROM story_reactions WHERE story_id = ? AND user_id = ?').get(storyId, userId) as
    | { id: string; reaction: string }
    | undefined;

  let myReaction: string | null = reaction;
  if (existing && existing.reaction === reaction) {
    db.prepare('DELETE FROM story_reactions WHERE id = ?').run(existing.id);
    myReaction = null;
  } else if (existing) {
    db.prepare('UPDATE story_reactions SET reaction = ? WHERE id = ?').run(reaction, existing.id);
  } else {
    db.prepare('INSERT INTO story_reactions (id, story_id, user_id, reaction) VALUES (?, ?, ?, ?)').run(
      `srx_${uuid().slice(0, 8)}`,
      storyId,
      userId,
      reaction
    );
  }

  const rxRows = db.prepare('SELECT reaction FROM story_reactions WHERE story_id = ?').all(storyId) as Array<{ reaction: string }>;
  const reactions: Record<string, number> = {};
  for (const r of rxRows) reactions[r.reaction] = (reactions[r.reaction] || 0) + 1;

  if (myReaction) {
    createNotification({
      userId: story.user_id,
      actorId: userId,
      type: 'react',
      text: 'تفاعل مع قصتك الآن',
      refTab: 'social',
      refId: storyId,
    });
    recordUserInteraction({
      userId,
      targetType: 'story',
      targetId: storyId,
      authorId: story.user_id,
      text: story.caption || '',
      action: 'react',
      weight: 3,
    });
  }

  broadcast('story:new', { id: storyId, reaction: myReaction });
  res.json({ ok: true, reactions, myReaction });
});

app.post('/api/stories/:id/reply', (req, res) => {
  const storyId = req.params.id;
  const { userId, text } = req.body as { userId?: string; text?: string };
  const cleanText = (text || '').trim();
  if (!userId || !cleanText) return res.status(400).json({ ok: false, error: 'اكتب رسالتك للرد على القصة.' });

  const story = db.prepare('SELECT id, user_id, media_url, caption FROM stories WHERE id = ?').get(storyId) as
    | { id: string; user_id: string; media_url: string; caption?: string }
    | undefined;
  if (!story) return res.status(404).json({ ok: false, error: 'القصة غير موجودة.' });
  if (story.user_id === userId) {
    return res.status(400).json({ ok: false, error: 'لا يمكنك مراسلة نفسك من قصتك.' });
  }
  const author = getUserOrNull(story.user_id);
  if (!author) return res.status(404).json({ ok: false, error: 'صاحب القصة غير موجود.' });

  // Find or create real 1-on-1 DM conversation between viewer and story author
  const dmKey = [userId, story.user_id].sort().join('::');
  let conv = db.prepare("SELECT id FROM conversations WHERE type = 'dm' AND dm_key = ?").get(dmKey) as { id: string } | undefined;
  if (!conv) {
    const convId = `c_dm_${uuid().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO conversations (
        id, type, folder, title, description, avatar_color, avatar_url,
        online_text, is_pinned, unread_count, is_encrypted, member_count, ai_enabled, creator_id, dm_key, peer_user_id
      ) VALUES (?, 'dm', 'personal', ?, ?, '#27272A', ?, 'متصل الآن', 0, 0, 1, 2, 0, ?, ?, ?)
    `).run(convId, author.displayName, author.bio || `@${author.username}`, author.avatarUrl, userId, dmKey, author.id);
    conv = { id: convId };
  }

  const msgId = `m_${uuid().slice(0, 8)}`;
  const storyPreviewText = story.caption ? `رد على قصتك (${story.caption.slice(0, 40)})` : 'رد على قصتك';
  const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  db.prepare(`
    INSERT INTO messages (
      id, conversation_id, sender_id, content, msg_type, media_url, reply_sender, reply_text, created_at
    ) VALUES (?, ?, ?, ?, 'text', NULL, ?, ?, ?)
  `).run(msgId, conv.id, userId, cleanText, author.displayName, storyPreviewText, timeStr);

  db.prepare('UPDATE conversations SET unread_count = unread_count + 1 WHERE id = ?').run(conv.id);

  createNotification({
    userId: story.user_id,
    actorId: userId,
    type: 'message',
    text: `ردّ على قصتك: ${cleanText.slice(0, 45)}`,
    refTab: 'chat',
    refId: conv.id,
  });
  recordUserInteraction({
    userId,
    targetType: 'story',
    targetId: storyId,
    authorId: story.user_id,
    text: `${story.caption || ''} ${cleanText}`,
    action: 'comment',
    weight: 6,
  });

  broadcast('chat:message', { conversationId: conv.id, msgId });
  res.json({ ok: true, conversationId: conv.id, messageId: msgId });
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

  const postReports = getReportCountsMap('post');
  const storyUsers = getActiveStoryUserSet();
  const myRepostSet = new Set(
    (viewerId
      ? (db.prepare('SELECT post_id FROM post_reposts WHERE user_id = ?').all(viewerId) as Array<{ post_id: string }>)
      : []
    ).map(r => r.post_id)
  );
  // Latest reposter per post (preferring viewer or someone the viewer follows) for X-style attribution
  const latestRepostMap = new Map<string, { userId: string; displayName: string; username: string }>();
  const allReposts = db.prepare(`
    SELECT pr.post_id, pr.user_id, u.display_name, u.username
    FROM post_reposts pr JOIN users u ON pr.user_id = u.id
    ORDER BY pr.rowid DESC
  `).all() as Array<{ post_id: string; user_id: string; display_name: string; username: string }>;
  for (const rp of allReposts) {
    if (!latestRepostMap.has(rp.post_id) || rp.user_id === viewerId) {
      latestRepostMap.set(rp.post_id, {
        userId: rp.user_id,
        displayName: rp.display_name,
        username: rp.username,
      });
    }
  }

  const quotedPostMap = loadQuotedPostMap(rows.map(r => String(r.quoted_post_id || '')));

  const rawPosts = rows.map((r, idx) => {
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

    const rCnt = postReports.get(String(r.id)) || 0;
    const rxMap = reactionsByPost.get(String(r.id)) || {};
    const postEng = computePostPositiveEngagement({
      reactions: rxMap,
      likesCount: Number(r.likes_count || 0),
      score: Number(r.score ?? r.likes_count ?? 0),
      commentsCount: Number(r.comments_count || 0),
      sharesCount: Number(r.shares_count || 0),
    });
    const isSensitive = rCnt >= computeSensitiveReportThreshold(postEng);
    const reposter = latestRepostMap.get(String(r.id)) || null;
    const quotedId = r.quoted_post_id ? String(r.quoted_post_id) : '';

    return {
      id: String(r.id),
      userId: String(r.user_id),
      displayName: r.display_name,
      username: r.username,
      avatarColor: r.avatar_color,
      avatarInitials: r.avatar_initials,
      avatarUrl: r.avatar_url,
      verified: Boolean(r.verified),
      hasActiveStory: storyUsers.has(String(r.user_id)),
      topic: r.topic || 'عام',
      content: String(r.content || ''),
      mediaUrl: r.media_url,
      mediaUrls,
      musicUrl: r.music_url ? String(r.music_url) : null,
      musicTitle: r.music_title ? String(r.music_title) : null,
      location: r.location || 'القاهرة',
      poll,
      score: Number(r.score ?? r.likes_count ?? 0),
      myVote: voteMap.get(String(r.id)) || 0,
      reactions: rxMap,
      myReaction: myReactionMap.get(String(r.id)) || null,
      likesCount: Number(r.likes_count || 0),
      commentsCount: Number(r.comments_count || 0),
      sharesCount: Number(r.shares_count || 0),
      likedByMe: likedSet.has(String(r.id)) || myReactionMap.has(String(r.id)),
      savedByMe: savedSet.has(String(r.id)),
      repostedByMe: myRepostSet.has(String(r.id)),
      repostedBy: reposter && reposter.userId !== String(r.user_id) ? reposter : null,
      quotedPost: quotedId ? quotedPostMap.get(quotedId) || null : null,
      isEdited: Boolean(r.is_edited),
      reportsCount: rCnt,
      isSensitive,
      createdAt: r.created_at,
      // fields for ranking engine
      authorId: String(r.user_id),
      text: `${String(r.content || '')} ${String(r.topic || '')}`,
      likes: Number(r.score ?? r.likes_count ?? 0),
      comments: Number(r.comments_count || 0),
      shares: Number(r.shares_count || 0),
      recencyIndex: idx,
      isOwnFresh: viewerId === String(r.user_id) && String(r.created_at) === 'الآن',
    };
  });

  const ranked = rawTag ? rawPosts : rankFeedItems(rawPosts, viewerId);
  const posts = ranked.map(({ authorId: _a, text: _t, likes: _l, comments: _c, shares: _s, recencyIndex: _ri, isOwnFresh: _iof, ...pub }) => pub);

  res.json({ ok: true, posts });
});

app.post('/api/posts', (req, res) => {
  const { userId, content, mediaUrl, mediaUrls, musicUrl, musicTitle, poll, quotedPostId } = req.body as {
    userId: string;
    content: string;
    mediaUrl?: string;
    mediaUrls?: string[];
    musicUrl?: string | null;
    musicTitle?: string | null;
    poll?: { question: string; options: string[] } | null;
    quotedPostId?: string | null;
  };
  const cleanMedia = Array.isArray(mediaUrls)
    ? mediaUrls.filter(Boolean).slice(0, 4)
    : mediaUrl
    ? [mediaUrl]
    : [];

  let validQuotedId: string | null = null;
  let quotedOwnerId: string | null = null;
  if (quotedPostId) {
    const qRow = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(quotedPostId) as
      | { id: string; user_id: string }
      | undefined;
    if (qRow) {
      validQuotedId = qRow.id;
      quotedOwnerId = qRow.user_id;
    }
  }

  if (!userId || (!content?.trim() && cleanMedia.length === 0 && !validQuotedId)) {
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
    INSERT INTO posts (id, user_id, topic, content, media_url, media_urls_json, music_url, music_title, quoted_post_id, poll_json, score, likes_count, created_at)
    VALUES (?, ?, 'عام', ?, ?, ?, ?, ?, ?, ?, 1, 1, 'الآن')
  `).run(id, userId, (content || '').trim(), firstMedia, urlsJson, musicUrl || null, musicTitle || null, validQuotedId, pollJson);

  if (validQuotedId) {
    db.prepare('UPDATE posts SET shares_count = shares_count + 1 WHERE id = ?').run(validQuotedId);
    if (quotedOwnerId && quotedOwnerId !== userId) {
      createNotification({
        userId: quotedOwnerId,
        actorId: userId,
        type: 'react',
        text: 'اقتبس منشورك وعلّق عليه',
        refTab: 'social',
        refId: id,
      });
    }
  }

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
    const pRow = db.prepare('SELECT user_id, content FROM posts WHERE id = ?').get(req.params.id) as
      | { user_id: string; content: string }
      | undefined;
    if (pRow?.user_id) {
      recordUserInteraction({
        userId,
        targetType: 'post',
        targetId: req.params.id,
        authorId: pRow.user_id,
        text: pRow.content || '',
        action: 'save',
        weight: 5,
      });
    }
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
  const postRow = db.prepare('SELECT user_id, content, score, likes_count FROM posts WHERE id = ?').get(postId) as
    | { user_id: string; content: string; score: number; likes_count: number }
    | undefined;

  if (myReaction && postRow?.user_id) {
    recordUserInteraction({
      userId,
      targetType: 'post',
      targetId: postId,
      authorId: postRow.user_id,
      action: 'react',
      text: postRow.content,
    });
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
  const { userId } = req.body as { userId?: string };
  const postId = req.params.id;
  if (!userId) return res.status(400).json({ ok: false, error: 'المستخدم مطلوب.' });

  const postRow = db.prepare('SELECT id, user_id, content, shares_count FROM posts WHERE id = ?').get(postId) as
    | { id: string; user_id: string; content: string; shares_count: number }
    | undefined;
  if (!postRow) return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });

  const existing = db.prepare('SELECT id FROM post_reposts WHERE post_id = ? AND user_id = ?').get(postId, userId) as
    | { id: string }
    | undefined;

  let reposted = false;
  if (existing) {
    db.prepare('DELETE FROM post_reposts WHERE id = ?').run(existing.id);
    db.prepare('UPDATE posts SET shares_count = MAX(0, shares_count - 1) WHERE id = ?').run(postId);
    reposted = false;
  } else {
    db.prepare('INSERT INTO post_reposts (id, post_id, user_id) VALUES (?, ?, ?)').run(
      `rp_${uuid().slice(0, 8)}`,
      postId,
      userId
    );
    db.prepare('UPDATE posts SET shares_count = shares_count + 1 WHERE id = ?').run(postId);
    reposted = true;
    recordUserInteraction({
      userId,
      targetType: 'post',
      targetId: postId,
      authorId: postRow.user_id,
      text: postRow.content || '',
      action: 'share',
      weight: 5,
    });
    createNotification({
      userId: postRow.user_id,
      actorId: userId,
      type: 'react',
      text: 'أعاد نشر منشورك على حسابه',
      refTab: 'social',
      refId: postId,
    });
  }

  const updated = db.prepare('SELECT shares_count FROM posts WHERE id = ?').get(postId) as { shares_count: number } | undefined;
  const actor = getUserOrNull(userId);
  broadcast('social:new_post', { id: postId, reposted });
  res.json({
    ok: true,
    reposted,
    sharesCount: Number(updated?.shares_count || 0),
    repostedBy: reposted && actor ? { userId: actor.id, displayName: actor.displayName, username: actor.username } : null,
  });
});

app.get('/api/posts/:id/comments', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, u.display_name, u.username, u.avatar_color, u.avatar_initials, u.avatar_url, u.verified
    FROM post_comments c LEFT JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ? ORDER BY c.rowid ASC
  `).all(req.params.id) as Array<Record<string, unknown>>;

  const commentReports = getReportCountsMap('post_comment');
  res.json({
    ok: true,
    comments: rows.map(r => {
      const isAi = r.user_id === 'lm_ai';
      const rCnt = commentReports.get(String(r.id)) || 0;
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
        reportsCount: rCnt,
        isSensitive: rCnt > 0 && isContentSensitive('post_comment', String(r.id), rCnt),
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
    ORDER BY v.rowid DESC
  `).all() as Array<Record<string, unknown>>;

  const likes = new Set((viewerId ? db.prepare('SELECT video_id FROM video_likes WHERE user_id = ?').all(viewerId) as Array<{ video_id: string }> : []).map(r => r.video_id));
  const saves = new Set((viewerId ? db.prepare('SELECT video_id FROM video_saves WHERE user_id = ?').all(viewerId) as Array<{ video_id: string }> : []).map(r => r.video_id));
  const following = new Set((viewerId ? db.prepare('SELECT following_id FROM user_follows WHERE follower_id = ?').all(viewerId) as Array<{ following_id: string }> : []).map(r => r.following_id));
  const storyUsers = getActiveStoryUserSet();
  const videoReports = getReportCountsMap('video');

  const rawVideos = rows.map((r, idx) => {
    const rCnt = videoReports.get(String(r.id)) || 0;
    const vidEng = Math.floor(
      Number(r.likes_count || 0) +
        Number(r.comments_count || 0) * 0.5 +
        Number(r.saves_count || 0) * 0.5 +
        Number(r.shares_count || 0) * 0.5
    );
    const isSensitive = rCnt >= computeSensitiveReportThreshold(vidEng);
    return {
      id: String(r.id),
      userId: String(r.user_id),
      displayName: r.display_name,
      username: r.username,
      avatarColor: r.avatar_color,
      avatarInitials: r.avatar_initials,
      avatarUrl: r.avatar_url,
      verified: Boolean(r.verified),
      hasActiveStory: storyUsers.has(String(r.user_id)),
      isFollowingAuthor: following.has(String(r.user_id)),
      title: String(r.title || ''),
      description: String(r.description || ''),
      tags: String(r.tags || ''),
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
      reportsCount: rCnt,
      isSensitive,
      createdAt: r.created_at,
      // ranking metadata
      authorId: String(r.user_id),
      text: `${String(r.title || '')} ${String(r.description || '')} ${String(r.tags || '')}`,
      likes: Number(r.likes_count || 0),
      comments: Number(r.comments_count || 0),
      saves: Number(r.saves_count || 0),
      shares: Number(r.shares_count || 0),
      views: Number(r.views_count || 0),
      recencyIndex: idx,
    };
  });

  const ranked = rankFeedItems(rawVideos, viewerId);
  const videos = ranked.map(({ authorId: _a, text: _t, likes: _l, comments: _c, saves: _sv, shares: _sh, views: _v, recencyIndex: _ri, ...pub }) => pub);
  res.json({ ok: true, videos });
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
  if (!userId) return res.status(400).json({ ok: false, error: 'userId مطلوب.' });
  const exists = db.prepare('SELECT 1 FROM video_likes WHERE video_id = ? AND user_id = ?').get(req.params.id, userId);
  const vMeta = db.prepare('SELECT user_id, title, description, tags, likes_count FROM short_videos WHERE id = ?').get(req.params.id) as
    | { user_id: string; title: string; description: string; tags: string; likes_count: number }
    | undefined;
  if (!vMeta) return res.status(404).json({ ok: false, error: 'الفيديو غير موجود.' });

  if (exists && !forceLike) {
    const del = db.prepare('DELETE FROM video_likes WHERE video_id = ? AND user_id = ?').run(req.params.id, userId);
    if (del.changes > 0) {
      db.prepare('UPDATE short_videos SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(req.params.id);
    }
    const fresh = db.prepare('SELECT likes_count FROM short_videos WHERE id = ?').get(req.params.id) as { likes_count: number };
    return res.json({ ok: true, liked: false, likesCount: Number(fresh?.likes_count || 0) });
  }

  if (!exists) {
    const ins = db.prepare('INSERT OR IGNORE INTO video_likes (video_id, user_id) VALUES (?, ?)').run(req.params.id, userId);
    if (ins.changes > 0) {
      db.prepare('UPDATE short_videos SET likes_count = likes_count + 1 WHERE id = ?').run(req.params.id);
      recordUserInteraction({
        userId,
        targetType: 'video',
        targetId: req.params.id,
        authorId: vMeta.user_id,
        action: 'like',
        text: `${vMeta.title} ${vMeta.description} ${vMeta.tags}`,
      });
    }
    const fresh = db.prepare('SELECT likes_count FROM short_videos WHERE id = ?').get(req.params.id) as { likes_count: number };
    return res.json({ ok: true, liked: true, likesCount: Number(fresh?.likes_count || 0) });
  }

  // Already liked & forceLike=true (e.g. repeated double-tap): strictly 1 like per user account!
  return res.json({ ok: true, liked: true, likesCount: Number(vMeta.likes_count || 0) });
});

app.post('/api/shares/track', (req, res) => {
  const { targetType, targetId, userId, channel } = req.body as {
    targetType: 'post' | 'video' | 'live' | 'profile';
    targetId: string;
    userId: string;
    channel?: string;
  };
  if (!targetType || !targetId || !userId) {
    return res.status(400).json({ ok: false, error: 'بيانات المشاركة غير مكتملة.' });
  }
  const cleanType = ['post', 'video', 'live', 'profile'].includes(targetType) ? targetType : 'post';
  const cleanChannel = String(channel || 'link').slice(0, 32);

  // Strictly 1 counted share per user account per target item (copying/sharing repeatedly does NOT inflate count!)
  const ins = db
    .prepare('INSERT OR IGNORE INTO content_shares (target_type, target_id, user_id, channel) VALUES (?, ?, ?, ?)')
    .run(cleanType, targetId, userId, cleanChannel);
  const counted = ins.changes > 0;

  let sharesCount = 0;
  if (cleanType === 'video') {
    if (counted) {
      db.prepare('UPDATE short_videos SET shares_count = shares_count + 1 WHERE id = ?').run(targetId);
      const vMeta = db.prepare('SELECT user_id, title, description, tags FROM short_videos WHERE id = ?').get(targetId) as
        | { user_id: string; title: string; description: string; tags: string }
        | undefined;
      if (vMeta) {
        recordUserInteraction({
          userId,
          targetType: 'video',
          targetId,
          authorId: vMeta.user_id,
          action: 'share',
          text: `${vMeta.title} ${vMeta.description} ${vMeta.tags}`,
        });
      }
    }
    const row = db.prepare('SELECT shares_count FROM short_videos WHERE id = ?').get(targetId) as { shares_count: number } | undefined;
    sharesCount = Number(row?.shares_count || 0);
  } else if (cleanType === 'post') {
    if (counted) {
      db.prepare('UPDATE posts SET shares_count = shares_count + 1 WHERE id = ?').run(targetId);
      const pMeta = db.prepare('SELECT user_id, content FROM posts WHERE id = ?').get(targetId) as
        | { user_id: string; content: string }
        | undefined;
      if (pMeta) {
        recordUserInteraction({
          userId,
          targetType: 'post',
          targetId,
          authorId: pMeta.user_id,
          action: 'share',
          text: pMeta.content,
        });
      }
    }
    const row = db.prepare('SELECT shares_count FROM posts WHERE id = ?').get(targetId) as { shares_count: number } | undefined;
    sharesCount = Number(row?.shares_count || 0);
  }

  return res.json({ ok: true, counted, sharesCount });
});

app.post('/api/videos/:id/save', (req, res) => {
  const { userId } = req.body as { userId: string };
  const exists = db.prepare('SELECT 1 FROM video_saves WHERE video_id = ? AND user_id = ?').get(req.params.id, userId);
  const vMeta = db.prepare('SELECT user_id, title, description, tags FROM short_videos WHERE id = ?').get(req.params.id) as
    | { user_id: string; title: string; description: string; tags: string }
    | undefined;
  if (exists) {
    db.prepare('DELETE FROM video_saves WHERE video_id = ? AND user_id = ?').run(req.params.id, userId);
    db.prepare('UPDATE short_videos SET saves_count = MAX(0, saves_count - 1) WHERE id = ?').run(req.params.id);
    res.json({ ok: true, saved: false });
  } else {
    db.prepare('INSERT INTO video_saves (video_id, user_id) VALUES (?, ?)').run(req.params.id, userId);
    db.prepare('UPDATE short_videos SET saves_count = saves_count + 1 WHERE id = ?').run(req.params.id);
    if (vMeta) {
      recordUserInteraction({
        userId,
        targetType: 'video',
        targetId: req.params.id,
        authorId: vMeta.user_id,
        action: 'save',
        text: `${vMeta.title} ${vMeta.description} ${vMeta.tags}`,
      });
    }
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

  const vcReports = getReportCountsMap('video_comment');
  const comments = rows.map(r => {
    const isAi = r.user_id === 'lm_ai';
    let likedBy: string[] = [];
    try { likedBy = JSON.parse(String(r.liked_by_json || '[]')); } catch { likedBy = []; }
    const rCnt = vcReports.get(String(r.id)) || 0;
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
      reportsCount: rCnt,
      isSensitive: rCnt >= computeSensitiveReportThreshold(Number(r.likes_count || 0)),
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
      maxMembers: Number(c.max_members || (c.type === 'community' ? 100000 : c.type === 'group' ? 1000 : 2)),
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
  const { title, type, description, creatorId, aiEnabled, avatarUrl, memberCount } = req.body as {
    title: string;
    type?: 'dm' | 'group' | 'community';
    description?: string;
    creatorId?: string;
    aiEnabled?: boolean;
    avatarUrl?: string | null;
    memberCount?: number;
  };
  if (!title?.trim()) return res.status(400).json({ ok: false, error: 'اسم المحادثة مطلوب.' });
  const id = `c_${uuid().slice(0, 8)}`;
  const convType = type || 'group';
  const folder = convType === 'community' ? 'channels' : convType === 'group' ? 'groups' : 'personal';
  const maxMembers = convType === 'community' ? 100000 : convType === 'group' ? 1000 : 2;
  const initCount = Math.min(maxMembers, Math.max(1, Number(memberCount || (convType === 'community' ? 1 : 2))));
  db.prepare(`
    INSERT INTO conversations (id, type, folder, title, description, avatar_color, avatar_url, is_encrypted, member_count, max_members, ai_enabled, creator_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    convType,
    folder,
    title.trim(),
    (description || '').trim() || (convType === 'community' ? 'مجتمع مفتوح حتى 100,000 عضو' : 'مجموعة حتى 1,000 عضو'),
    '#27272A',
    avatarUrl || null,
    1,
    initCount,
    maxMembers,
    convType !== 'dm' && aiEnabled ? 1 : 0,
    creatorId || 'u_youssef'
  );
  broadcast('chat:message', { conversationId: id, created: true });
  res.json({ ok: true, id, maxMembers });
});

app.post('/api/conversations/:id/pin', (req, res) => {
  const row = db.prepare('SELECT id, is_pinned FROM conversations WHERE id = ?').get(req.params.id) as
    | { id: string; is_pinned: number }
    | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'المحادثة غير موجودة.' });
  const nextPinned = row.is_pinned ? 0 : 1;
  db.prepare('UPDATE conversations SET is_pinned = ? WHERE id = ?').run(nextPinned, req.params.id);
  broadcast('chat:message', { conversationId: req.params.id, isPinned: Boolean(nextPinned) });
  res.json({ ok: true, isPinned: Boolean(nextPinned) });
});

app.patch('/api/conversations/:id', (req, res) => {
  const { userId, title, description, avatarUrl } = req.body as {
    userId?: string;
    title?: string;
    description?: string;
    avatarUrl?: string | null;
  };
  const conv = db.prepare('SELECT id, type, creator_id, title, description, avatar_url FROM conversations WHERE id = ?').get(req.params.id) as
    | { id: string; type: string; creator_id?: string; title: string; description?: string; avatar_url?: string | null }
    | undefined;
  if (!conv) return res.status(404).json({ ok: false, error: 'المحادثة غير موجودة.' });
  if (conv.type !== 'dm' && userId && conv.creator_id && conv.creator_id !== userId) {
    return res.status(403).json({ ok: false, error: 'منشئ المجموعة فقط يمكنه تعديل بياناتها.' });
  }
  const nextTitle = (title ?? conv.title).trim() || conv.title;
  const nextDesc = (description ?? conv.description ?? '').trim();
  const nextAvatar = avatarUrl !== undefined ? avatarUrl : (conv.avatar_url ?? null);
  db.prepare('UPDATE conversations SET title = ?, description = ?, avatar_url = ? WHERE id = ?').run(
    nextTitle,
    nextDesc,
    nextAvatar,
    req.params.id
  );
  broadcast('chat:message', { conversationId: req.params.id, updated: true });
  res.json({ ok: true });
});

app.delete('/api/conversations/:id/messages', (req, res) => {
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ ok: false, error: 'المحادثة غير موجودة.' });
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(req.params.id);
  broadcast('chat:message', { conversationId: req.params.id, cleared: true });
  res.json({ ok: true });
});

app.delete('/api/conversations/:id', (req, res) => {
  const userId = String(req.query.userId || '');
  const conv = db.prepare('SELECT id, type, creator_id FROM conversations WHERE id = ?').get(req.params.id) as
    | { id: string; type: string; creator_id?: string }
    | undefined;
  if (!conv) return res.status(404).json({ ok: false, error: 'المحادثة غير موجودة.' });
  if (conv.type !== 'dm' && userId && conv.creator_id && conv.creator_id !== userId) {
    return res.status(403).json({ ok: false, error: 'منشئ المجموعة فقط يمكنه حذفها بالكامل.' });
  }
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(req.params.id);
  db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
  broadcast('chat:message', { conversationId: req.params.id, deletedConv: true });
  res.json({ ok: true });
});

app.post('/api/conversations/:id/ai-mode', (req, res) => {
  const { userId, aiEnabled } = req.body as { userId?: string; aiEnabled?: boolean };
  const conv = db.prepare('SELECT id, type, creator_id, ai_enabled FROM conversations WHERE id = ?').get(req.params.id) as
    | { id: string; type: string; creator_id?: string; ai_enabled?: number }
    | undefined;
  if (!conv) return res.status(404).json({ ok: false, error: 'المحادثة غير موجودة.' });
  if (conv.type === 'dm') {
    return res.status(403).json({ ok: false, error: 'وضع العضو التلقائي متاح فقط للمجموعات والمجتمعات.' });
  }
  if (userId && conv.creator_id && conv.creator_id !== userId) {
    return res.status(403).json({ ok: false, error: 'منشئ المجموعة فقط يمكنه تفعيل AI كعضو أساسي.' });
  }
  // One-time permanent activation rule: once enabled, it stays enabled permanently!
  if (conv.ai_enabled && !aiEnabled) {
    return res.status(400).json({ ok: false, error: 'تم تفعيل LM AI كعضو دائم في هذه المجموعة ولا يمكن تعطيله.' });
  }
  const nextVal = aiEnabled ? 1 : 0;
  db.prepare('UPDATE conversations SET ai_enabled = ? WHERE id = ?').run(nextVal, req.params.id);
  broadcast('chat:message', { conversationId: req.params.id, aiEnabled: Boolean(nextVal) });
  res.json({ ok: true, aiEnabled: Boolean(nextVal) });
});

// ============================================================
// VOICE CALLS LOGS & SHAREABLE VOICE CALL ROOMS (Voice ONLY!)
// ============================================================
function mapCallRow(r: Record<string, unknown>) {
  let invitedUserIds: string[] = [];
  try { invitedUserIds = JSON.parse(String(r.invited_json || '[]')); } catch { invitedUserIds = []; }
  return {
    id: String(r.id),
    roomCode: String(r.room_code),
    convId: r.conv_id ? String(r.conv_id) : null,
    hostId: String(r.host_id),
    hostName: String(r.host_name || 'مستخدم'),
    hostAvatarUrl: r.host_avatar ? String(r.host_avatar) : null,
    hostInitials: String(r.host_initials || 'LM'),
    peerId: r.peer_id ? String(r.peer_id) : null,
    peerName: r.peer_name ? String(r.peer_name) : null,
    peerAvatarUrl: r.peer_avatar ? String(r.peer_avatar) : null,
    title: String(r.title || 'مكالمة صوتية'),
    callScope: (String(r.call_scope || 'dm') as 'dm' | 'group' | 'community'),
    joinMode: (String(r.join_mode || 'open') as 'open' | 'approval' | 'invited'),
    invitedUserIds,
    status: (String(r.status || 'ended') as 'active' | 'ended' | 'missed'),
    createdAt: String(r.created_at || 'الآن'),
  };
}

app.get('/api/calls', (req, res) => {
  const userId = String(req.query.userId || '');
  const rows = db.prepare(`
    SELECT c.*,
      hu.display_name as host_name, hu.avatar_url as host_avatar, hu.avatar_initials as host_initials,
      pu.display_name as peer_name, pu.avatar_url as peer_avatar
    FROM call_logs c
    LEFT JOIN users hu ON c.host_id = hu.id
    LEFT JOIN users pu ON c.peer_id = pu.id
    ORDER BY CASE WHEN c.status = 'active' THEN 0 ELSE 1 END, c.rowid DESC
    LIMIT 60
  `).all() as Array<Record<string, unknown>>;

  const calls = rows
    .map(mapCallRow)
    .filter(c => {
      if (!userId) return true;
      if (c.hostId === userId || c.peerId === userId) return true;
      if (c.callScope !== 'dm' && (c.joinMode !== 'invited' || c.invitedUserIds.includes(userId))) return true;
      return false;
    });
  res.json({ ok: true, calls });
});

app.get('/api/calls/:code', (req, res) => {
  const row = db.prepare(`
    SELECT c.*,
      hu.display_name as host_name, hu.avatar_url as host_avatar, hu.avatar_initials as host_initials,
      pu.display_name as peer_name, pu.avatar_url as peer_avatar
    FROM call_logs c
    LEFT JOIN users hu ON c.host_id = hu.id
    LEFT JOIN users pu ON c.peer_id = pu.id
    WHERE c.room_code = ? OR c.id = ?
  `).get(req.params.code, req.params.code) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ ok: false, error: 'المكالمة غير موجودة أو انتهت.' });
  res.json({ ok: true, call: mapCallRow(row) });
});

app.post('/api/calls', (req, res) => {
  const { convId, hostId, peerId, title, callScope, joinMode, invitedUserIds } = req.body as {
    convId?: string | null;
    hostId?: string;
    peerId?: string | null;
    title?: string;
    callScope?: 'dm' | 'group' | 'community';
    joinMode?: 'open' | 'approval' | 'invited';
    invitedUserIds?: string[];
  };
  if (!hostId) return res.status(400).json({ ok: false, error: 'معرف المتصل مطلوب.' });
  const host = getUserOrNull(hostId);
  if (!host) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });

  const id = `call_${uuid().slice(0, 8)}`;
  const roomCode = `lm-${uuid().slice(0, 8)}`;
  const scope = callScope === 'community' || callScope === 'group' ? callScope : 'dm';
  const mode = joinMode === 'approval' || joinMode === 'invited' ? joinMode : 'open';
  const cleanInvited = Array.isArray(invitedUserIds) ? invitedUserIds.slice(0, 100) : [];
  const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  db.prepare(`
    INSERT INTO call_logs (id, room_code, conv_id, host_id, peer_id, title, call_scope, join_mode, invited_json, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(
    id,
    roomCode,
    convId || null,
    hostId,
    peerId || null,
    (title || `مكالمة ${host.displayName}`).trim(),
    scope,
    mode,
    JSON.stringify(cleanInvited),
    timeStr
  );

  const row = db.prepare(`
    SELECT c.*,
      hu.display_name as host_name, hu.avatar_url as host_avatar, hu.avatar_initials as host_initials,
      pu.display_name as peer_name, pu.avatar_url as peer_avatar
    FROM call_logs c
    LEFT JOIN users hu ON c.host_id = hu.id
    LEFT JOIN users pu ON c.peer_id = pu.id
    WHERE c.id = ?
  `).get(id) as Record<string, unknown>;

  const call = mapCallRow(row);
  broadcast('call:updated', { call });
  res.json({ ok: true, call });
});

app.patch('/api/calls/:id', (req, res) => {
  const { status } = req.body as { status?: 'active' | 'ended' | 'missed' };
  const nextStatus = status === 'missed' ? 'missed' : status === 'active' ? 'active' : 'ended';
  db.prepare('UPDATE call_logs SET status = ? WHERE id = ? OR room_code = ?').run(nextStatus, req.params.id, req.params.id);
  broadcast('call:updated', { id: req.params.id, status: nextStatus });
  res.json({ ok: true, status: nextStatus });
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
  if (!userId || !emoji) return res.status(400).json({ ok: false });
  const row = db.prepare('SELECT conversation_id, reactions_json FROM messages WHERE id = ?').get(req.params.id) as
    | { conversation_id: string; reactions_json: string }
    | undefined;
  if (!row) return res.status(404).json({ ok: false });

  let reactions: Record<string, string[]> = {};
  try { reactions = JSON.parse(row.reactions_json || '{}'); } catch { reactions = {}; }

  const alreadyHadThis = Array.isArray(reactions[emoji]) && reactions[emoji].includes(userId);

  // Strictly 1 reaction per user per message: remove userId from ALL existing reaction buckets first!
  for (const key of Object.keys(reactions)) {
    const filtered = (reactions[key] || []).filter(u => u !== userId);
    if (filtered.length === 0) delete reactions[key];
    else reactions[key] = filtered;
  }

  // If user chose a different reaction (or had none), set that single new reaction
  if (!alreadyHadThis) {
    reactions[emoji] = [...(reactions[emoji] || []), userId];
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
app.get('/api/live/rooms', (req, res) => {
  const viewerId = String(req.query.userId || '');
  const rows = db.prepare(`
    SELECT r.*, u.display_name as host_name, u.username as host_username, u.avatar_color as host_color, u.avatar_initials as host_initials, u.avatar_url as host_avatar
    FROM live_rooms r JOIN users u ON r.host_id = u.id
    WHERE r.is_active = 1
    ORDER BY CASE WHEN r.video_url IS NULL THEN 0 ELSE 1 END, r.rowid DESC
  `).all() as Array<Record<string, unknown>>;

  const storyUsers = getActiveStoryUserSet();
  const liveReports = getReportCountsMap('live');

  const mapped = rows.map((r, idx) => {
    const runtime = liveEngine.getPublicState(String(r.id));
    const rCnt = liveReports.get(String(r.id)) || 0;
    return {
      id: String(r.id),
      hostId: String(r.host_id),
      hostName: r.host_name,
      hostUsername: r.host_username,
      hostColor: r.host_color,
      hostInitials: r.host_initials,
      hostAvatarUrl: r.host_avatar,
      title: String(r.title || ''),
      category: String(r.category || 'عام'),
      videoUrl: r.video_url,
      scenePreset: r.scene_preset,
      orientation: (String(r.orientation || 'portrait') === 'landscape' ? 'landscape' : 'portrait') as 'portrait' | 'landscape',
      viewersCount: runtime.viewersCount,
      likesCount: runtime.likesCount,
      totalGiftsEgp: runtime.totalGiftsEgp,
      highlightsEnabled: runtime.highlightsEnabled,
      cooldownSec: runtime.cooldownSec,
      hasActiveStory: storyUsers.has(String(r.host_id)),
      reportsCount: rCnt,
      isSensitive: rCnt >= computeSensitiveReportThreshold(Math.floor(Number(runtime.likesCount || 0) + Number(runtime.viewersCount || 0) * 0.1)),
      // ranking fields: live popularity grows directly with taps/likes + active comments + viewers!
      authorId: String(r.host_id),
      text: `${String(r.title || '')} ${String(r.category || '')}`,
      likes: runtime.likesCount + runtime.viewersCount / 30,
      comments: runtime.recentMessages.length * 4,
      views: runtime.viewersCount,
      recencyIndex: idx,
      isOwnFresh: r.scene_preset === 'webrtc_live',
    };
  });

  const ranked = rankFeedItems(mapped, viewerId);
  res.json({
    ok: true,
    rooms: ranked.map(({ authorId: _a, text: _t, likes: _l, comments: _c, views: _v, recencyIndex: _ri, isOwnFresh: _iof, ...pub }) => pub),
  });
});

app.post('/api/live/rooms', (req, res) => {
  const { hostId, title, category, orientation } = req.body as {
    hostId?: string;
    title?: string;
    category?: string;
    orientation?: 'portrait' | 'landscape';
  };
  if (!hostId || !title?.trim()) {
    return res.status(400).json({ ok: false, error: 'عنوان البث المباشر مطلوب.' });
  }
  const host = getUserOrNull(hostId);
  if (!host) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });

  // End any previous user-created WebRTC room hosted by this user cleanly
  db.prepare("UPDATE live_rooms SET is_active = 0 WHERE host_id = ? AND scene_preset = 'webrtc_live'").run(hostId);

  const id = `live_u_${uuid().slice(0, 8)}`;
  const orient = orientation === 'landscape' ? 'landscape' : 'portrait';
  db.prepare(`
    INSERT INTO live_rooms (id, host_id, title, category, video_url, scene_preset, orientation, viewers_count, is_active)
    VALUES (?, ?, ?, ?, NULL, 'webrtc_live', ?, 1, 1)
  `).run(id, hostId, title.trim(), (category || 'عام').trim(), orient);

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
    orientation: orient,
    viewersCount: runtime.viewersCount,
    likesCount: 0,
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
  const room = db.prepare('SELECT host_id, title, category FROM live_rooms WHERE id = ?').get(req.params.id) as
    | { host_id: string; title: string; category: string }
    | undefined;
  if (room) {
    recordUserInteraction({
      userId,
      targetType: 'live',
      targetId: req.params.id,
      authorId: room.host_id,
      text: `${room.title} ${room.category}`,
      action: 'comment',
      weight: 4,
    });
  }
  res.json(result);
});

app.post('/api/live/rooms/:id/like', (req, res) => {
  const { userId, count } = req.body as { userId?: string; count?: number };
  const room = db.prepare('SELECT id, host_id, title, category FROM live_rooms WHERE id = ?').get(req.params.id) as
    | { id: string; host_id: string; title: string; category: string }
    | undefined;
  if (!room) return res.status(404).json({ ok: false, error: 'غرفة البث غير موجودة.' });
  const result = liveEngine.addLikes(req.params.id, Number(count || 1));
  if (userId) {
    recordUserInteraction({
      userId,
      targetType: 'live',
      targetId: req.params.id,
      authorId: room.host_id,
      text: `${room.title} ${room.category}`,
      action: 'like',
      weight: Math.min(6, Math.max(1, Number(count || 1) * 0.5)),
    });
  }
  res.json(result);
});

app.post('/api/live/rooms/:id/highlight', (req, res) => {
  const { userId, text } = req.body as { userId: string; text: string };
  const user = getUserOrNull(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود.' });
  const room = db.prepare('SELECT host_id FROM live_rooms WHERE id = ?').get(req.params.id) as
    | { host_id: string }
    | undefined;
  if (!room) return res.status(404).json({ ok: false, error: 'غرفة البث غير موجودة.' });
  if (room.host_id !== userId) {
    return res.status(403).json({ ok: false, error: 'صاحب البث فقط يمكنه تثبيت التعليقات.' });
  }
  const result = liveEngine.submitHighlight(req.params.id, user, text, true);
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

app.post('/api/ai/chat', aiLimiter, async (req, res) => {
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

    const safeAiImageUrl =
      attachmentUrl && /^\/uploads\/[^/]+\.(jpg|jpeg|png|webp|gif)$/i.test(attachmentUrl) ? attachmentUrl : null;
    const effectivePrompt = (prompt || '').trim() || resolvedTranscript || (safeAiImageUrl ? 'حلّل هذه الصورة بالتفصيل' : 'مرحبًا');

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
        attachmentUrl: safeAiImageUrl,
        attachmentName: safeAiImageUrl ? attachmentName : null,
        sharedContext: sessionHistoryContext || req.body.sharedContext,
      },
      delta => {
        sendEvent({ type: 'delta', text: delta });
      }
    );

    let activeSessionId = sessionId || null;
    let userMsgId: string | null = null;
    if (req.body.source === 'ai_tab' && userId && (effectivePrompt || audioUrl || safeAiImageUrl)) {
      const nowIso = new Date().toISOString();
      if (!activeSessionId) {
        activeSessionId = `ais_${uuid().slice(0, 8)}`;
        const title = (resolvedTranscript || effectivePrompt || 'صورة').trim().slice(0, 48);
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
        'INSERT INTO ai_messages (id, session_id, role, content, audio_url, transcript, attachment_url, company_id, model_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        userMsgId,
        activeSessionId,
        'user',
        (prompt || '').trim(),
        audioUrl || null,
        resolvedTranscript,
        safeAiImageUrl,
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
    const clean = typeof p === 'string' ? p.trim() : '';
    if (!clean || clean.startsWith('lm:') || clean.startsWith('data:')) {
      return `${origin}/lm-icon-512.png`;
    }
    if (/^https?:\/\//i.test(clean)) return clean;
    return `${origin}${clean.startsWith('/') ? clean : `/${clean}`}`;
  };

  let title = 'LM';
  let description = 'Connect without boundaries — social feed, short videos, live rooms, instant chat, and LM AI in one unified platform.';
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
  const handle = userMatch
    ? decodeURIComponent(userMatch[1])
    : String(req.query.user || req.query.u || '').trim();
  if (handle) {
    const clean = handle.replace(/^@/, '').toLowerCase();
    const u = db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR id = ?').get(clean, handle) as Record<string, unknown> | undefined;
    if (u) {
      title = `${String(u.display_name)} (@${String(u.username)}) • LM`;
      const bio = String(u.bio || '').replace(/\s+/g, ' ').trim();
      const loc = u.location ? ` • ${String(u.location)}` : '';
      description = bio ? `${bio.slice(0, 150)}${loc}` : `الملف الشخصي لـ ${String(u.display_name)} على LM`;
      const rawCover = typeof u.cover_url === 'string' && !u.cover_url.startsWith('lm:') ? u.cover_url : null;
      const rawAvatar = typeof u.avatar_url === 'string' && !u.avatar_url.startsWith('lm:') ? u.avatar_url : null;
      image = toAbs(rawCover || rawAvatar);
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

  const callMatch = req.path.match(/^\/call\/([^/]+)$/);
  const callCode = callMatch ? decodeURIComponent(callMatch[1]) : String(req.query.call || '').trim();
  if (callCode) {
    const cr = db.prepare(`
      SELECT c.title, c.call_scope, u.display_name, u.avatar_url
      FROM call_logs c JOIN users u ON c.host_id = u.id WHERE c.room_code = ?
    `).get(callCode) as Record<string, unknown> | undefined;
    if (cr) {
      title = `مكالمة صوتية: ${String(cr.title)} • LM`;
      description = `انضم الآن إلى المكالمة الصوتية مع ${String(cr.display_name)} على منصة LM`;
      image = toAbs(cr.avatar_url as string | null);
      type = 'website';
      return { title, description, image, url: fullUrl, type };
    }
  }

  return { title, description, image, url: fullUrl, type };
}

const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  const staticGzipCache = new Map<string, { gz: Buffer; contentType: string; etag: string }>();
  const COMPRESSIBLE_TYPES: Record<string, string> = {
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
  };

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const ext = path.extname(req.path).toLowerCase();
    const contentType = COMPRESSIBLE_TYPES[ext];
    const acceptsGzip = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
    if (!contentType || !acceptsGzip) return next();

    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(req.path);
    } catch {
      return next();
    }
    const safeRel = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
    const fullPath = path.resolve(distDir, safeRel);
    if (!fullPath.startsWith(distDir + path.sep) || !fs.existsSync(fullPath)) return next();

    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile() || stat.size > 4 * 1024 * 1024) return next();
      const cacheKey = `${fullPath}:${stat.mtimeMs}:${stat.size}`;
      let entry = staticGzipCache.get(cacheKey);
      if (!entry) {
        const raw = fs.readFileSync(fullPath);
        const gz = zlib.gzipSync(raw, { level: 6 });
        const etag = `W/"${crypto.createHash('sha1').update(gz).digest('hex').slice(0, 16)}"`;
        entry = { gz, contentType, etag };
        if (staticGzipCache.size > 80) staticGzipCache.clear();
        staticGzipCache.set(cacheKey, entry);
      }
      res.setHeader('Content-Type', entry.contentType);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('ETag', entry.etag);
      res.setHeader(
        'Cache-Control',
        req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
      );
      if (req.headers['if-none-match'] === entry.etag) {
        return res.status(304).end();
      }
      res.setHeader('Content-Length', String(entry.gz.length));
      if (req.method === 'HEAD') return res.status(200).end();
      return res.status(200).end(entry.gz);
    } catch {
      return next();
    }
  });

  app.use(
    express.static(distDir, {
      index: false,
      maxAge: '7d',
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

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
    <meta property="og:image:secure_url" content="${escapeHtmlAttr(og.image)}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
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
      res.setHeader('Cache-Control', 'no-cache');
      const acceptsGzip = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
      if (acceptsGzip) {
        const gz = zlib.gzipSync(Buffer.from(html, 'utf8'), { level: 6 });
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', String(gz.length));
        if (req.method === 'HEAD') return res.status(200).end();
        return res.status(200).end(gz);
      }
      if (req.method === 'HEAD') return res.status(200).end();
      res.send(html);
    } catch {
      res.sendFile(indexPath);
    }
  });
}

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, '0.0.0.0', () => {
  const cloud = getCloudStorageStatus();
  console.log(
    `\n  ✦ LM Core v6 (Phase 1 Free Production) running at http://localhost:${PORT} [DB: ${cloud.dbPersistence} | Media: ${cloud.mediaProvider}]\n`
  );
});

let shuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n  [LM] Received ${signal} — syncing cloud DB & checkpointing SQLite WAL...`);
  try {
    await flushCloudDbBeforeExit(db, DB_PATH);
  } catch {
    // ignore
  }
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // ignore
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 6000).unref();
}
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
