import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UserProfile, ProviderConfig } from './types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '../data');
export const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'lm.db'));
db.exec('PRAGMA journal_mode = WAL;');

const TARGET_DB_VERSION = 3;

export function initDatabase() {
  const verRow = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (verRow.user_version < TARGET_DB_VERSION) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS post_comments;
      DROP TABLE IF EXISTS post_likes;
      DROP TABLE IF EXISTS posts;
      DROP TABLE IF EXISTS stories;
      DROP TABLE IF EXISTS video_comments;
      DROP TABLE IF EXISTS video_likes;
      DROP TABLE IF EXISTS video_saves;
      DROP TABLE IF EXISTS short_videos;
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS conversations;
      DROP TABLE IF EXISTS live_rooms;
      DROP TABLE IF EXISTS ledger_entries;
      DROP TABLE IF EXISTS ai_security_logs;
      DROP TABLE IF EXISTS users;
      PRAGMA user_version = ${TARGET_DB_VERSION};
    `);
  }

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      display_name_en TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_color TEXT NOT NULL,
      avatar_initials TEXT NOT NULL,
      avatar_url TEXT,
      verified INTEGER DEFAULT 0,
      vip_tier INTEGER DEFAULT 0,
      priority_support INTEGER DEFAULT 0,
      rank_id TEXT DEFAULT 'soldier',
      supreme_title TEXT,
      ai_tier TEXT DEFAULT 'free',
      ai_used_today INTEGER DEFAULT 0,
      ad_removal_json TEXT DEFAULT '{"videos":false,"largeGroups":false,"ai":false,"investment":false}',
      custom_app_name TEXT DEFAULT 'LM',
      custom_app_icon TEXT DEFAULT 'default',
      theme TEXT DEFAULT 'obsidian',
      country TEXT DEFAULT 'EG',
      travel_exception_active INTEGER DEFAULT 0,
      travel_exception_note TEXT,
      months_abroad INTEGER DEFAULT 0,
      target_country TEXT,
      demo_balance_egp REAL DEFAULT 2500,
      creator_earnings_egp REAL DEFAULT 0,
      followers_count INTEGER DEFAULT 0,
      following_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      media_url TEXT NOT NULL,
      caption TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      media_url TEXT,
      media_urls_json TEXT DEFAULT '[]',
      media_style TEXT,
      media_caption TEXT,
      location TEXT DEFAULT 'القاهرة',
      is_sponsored INTEGER DEFAULT 0,
      sponsor_budget_egp REAL DEFAULT 0,
      sponsor_audience TEXT,
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      shares_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      audio_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS short_videos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      tags TEXT DEFAULT '',
      audio_title TEXT DEFAULT 'Original Sound — Cairo Studio',
      video_url TEXT,
      poster_url TEXT,
      scene_preset TEXT DEFAULT 'cairo-skyline',
      duration_sec INTEGER DEFAULT 15,
      is_sponsored INTEGER DEFAULT 0,
      sponsor_budget_egp REAL DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      saves_count INTEGER DEFAULT 0,
      shares_count INTEGER DEFAULT 0,
      views_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS video_likes (
      video_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (video_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS video_saves (
      video_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (video_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS video_comments (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      parent_id TEXT,
      content TEXT DEFAULT '',
      audio_url TEXT,
      audio_duration_sec INTEGER DEFAULT 6,
      transcript TEXT,
      likes_count INTEGER DEFAULT 0,
      liked_by_json TEXT DEFAULT '[]',
      created_at TEXT DEFAULT 'منذ دقيقتين'
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      folder TEXT DEFAULT 'personal',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      avatar_color TEXT DEFAULT '#6366F1',
      avatar_url TEXT,
      online_text TEXT DEFAULT 'متصل الآن',
      pinned_message TEXT,
      is_pinned INTEGER DEFAULT 0,
      unread_count INTEGER DEFAULT 0,
      is_large_group INTEGER DEFAULT 0,
      is_encrypted INTEGER DEFAULT 1,
      member_count INTEGER DEFAULT 2,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      msg_type TEXT DEFAULT 'text', -- 'text' | 'image' | 'audio' | 'video_note' | 'file' | 'ai_reply'
      media_url TEXT,
      transcript TEXT,
      send_effect TEXT,
      reply_to_id TEXT,
      reply_sender TEXT,
      reply_text TEXT,
      reactions_json TEXT DEFAULT '{}',
      ai_consent_ref TEXT,
      created_at TEXT DEFAULT '10:42 م'
    );

    CREATE TABLE IF NOT EXISTS live_rooms (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      video_url TEXT,
      scene_preset TEXT NOT NULL,
      viewers_count INTEGER DEFAULT 4280,
      highlights_enabled INTEGER DEFAULT 1,
      cooldown_sec INTEGER DEFAULT 15,
      platform_cut_pct INTEGER DEFAULT 25,
      total_gifts_egp REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      debit_account TEXT NOT NULL,
      credit_account TEXT NOT NULL,
      amount_egp REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'posted_sandbox',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_security_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      decision TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, username, password, display_name, display_name_en, bio,
      avatar_color, avatar_initials, avatar_url, verified, vip_tier, priority_support,
      rank_id, supreme_title, ai_tier, ai_used_today, ad_removal_json,
      custom_app_name, custom_app_icon, theme, country,
      demo_balance_egp, creator_earnings_egp, followers_count, following_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'u_youssef', 'youssef', '123456', 'يوسف المنصوري', 'Youssef El-Mansoury',
    'Cairo • Founder & Spatial Architect',
    '#D4AF37', 'يم', '/uploads/seed/avatar_youssef.jpg', 1, 1, 1, 'emperor', 'emperor', 'ai_200', 14,
    JSON.stringify({ videos: true, largeGroups: true, ai: true, investment: true }),
    'LM', 'platinum', 'obsidian', 'EG', 48500, 12400, 284900, 310
  );

  insertUser.run(
    'u_mariam', 'mariam', '123456', 'مريم الشريف', 'Mariam El-Sherif',
    'Visual Director & Live Creator 🎙️✨',
    '#10B981', 'مش', '/uploads/seed/avatar_mariam.jpg', 1, 3, 0, 'general', null, 'ai_100', 22,
    JSON.stringify({ videos: true, largeGroups: false, ai: true, investment: false }),
    'LM', 'default', 'obsidian', 'EG', 15200, 34900, 192400, 520
  );

  insertUser.run(
    'u_karim', 'karim', '123456', 'كريم فؤاد', 'Karim Fouad',
    'Global Tech & Macro Strategist • NYC / CAI',
    '#3B82F6', 'كف', '/uploads/seed/avatar_karim.jpg', 1, 2, 0, 'prince', null, 'ai_100', 9,
    JSON.stringify({ videos: true, largeGroups: true, ai: false, investment: true }),
    'LM', 'cobalt', 'obsidian', 'US', 31000, 6200, 94200, 184
  );

  insertUser.run(
    'u_nour', 'nour', '123456', 'نور حسن', 'Nour Hassan',
    'Cinematographer • Night & Motion 🎬',
    '#F59E0B', 'نح', '/uploads/seed/avatar_nour.jpg', 1, 5, 0, 'sergeant', null, 'ai_20', 6,
    JSON.stringify({ videos: true, largeGroups: false, ai: false, investment: false }),
    'LM', 'default', 'obsidian', 'EG', 4300, 1850, 67800, 412
  );

  insertUser.run(
    'u_omar', 'omar', '123456', 'عمر طارق', 'Omar Tarek',
    'Sound Designer & Creative Technologist',
    '#64748B', 'عط', '/uploads/seed/avatar_omar.jpg', 0, 0, 0, 'soldier', null, 'free', 3,
    JSON.stringify({ videos: false, largeGroups: false, ai: false, investment: false }),
    'LM', 'default', 'obsidian', 'EG', 1200, 0, 5420, 290
  );

  // Authentic Human Stories
  const insertStory = db.prepare('INSERT INTO stories (id, user_id, media_url, caption) VALUES (?, ?, ?, ?)');
  insertStory.run('s_1', 'u_mariam', '/uploads/seed/story_1.jpg', 'كواليس السيت أب الجديد قبل لايف الليلة 🔥🎙️');
  insertStory.run('s_2', 'u_youssef', '/uploads/seed/post_cairo.jpg', 'القاهرة وقت الغروب.. سحر ملوش زي ✨');
  insertStory.run('s_3', 'u_nour', '/uploads/seed/story_2.jpg', 'أخيرًا خلصنا تلوين الفيلم القصير الجديد 🎬');
  insertStory.run('s_4', 'u_karim', '/uploads/seed/story_3.jpg', 'صباح الحركة القوية في جلسة التداول النهاردة 📈');

  // Authentic Human Social Posts (ZERO meta explanations!)
  const insertPost = db.prepare(`
    INSERT INTO posts (id, user_id, content, media_url, media_urls_json, location, is_sponsored, sponsor_budget_egp, sponsor_audience, likes_count, comments_count, shares_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPost.run(
    'p_1', 'u_youssef',
    'الغروب من فوق النيل النهاردة كان لوحة سريالية. ساعات بتحتاج بس تفصل عشر دقايق وتتأمل تفاصيل المدينة دي من فوق ✨🌇',
    '/uploads/seed/post_cairo.jpg',
    JSON.stringify(['/uploads/seed/post_cairo.jpg', '/uploads/seed/post_nile.jpg']),
    'الزمالك، القاهرة',
    0, 0, null, 12840, 418, 920
  );

  insertPost.run(
    'p_2', 'u_mariam',
    'ليلة تسجيل طويلة في الاستوديو.. الصوت الجديد طالع أنقى بمراحل مما تخيلت 🎧🔥 مستعدين للايف الساعة 9؟',
    '/uploads/seed/post_studio.jpg',
    JSON.stringify(['/uploads/seed/post_studio.jpg']),
    'الشيخ زايد',
    0, 0, null, 8430, 276, 315
  );

  insertPost.run(
    'p_3', 'u_karim',
    'الجيل الجديد من معالجات الذكاء الاصطناعي بيغير شكل الحوسبة بالكامل في 2026. أرقام الأداء السنة دي قفزت لمرحلة غير مسبوقة ⚡',
    '/uploads/seed/post_tech1.jpg',
    JSON.stringify(['/uploads/seed/post_tech1.jpg', '/uploads/seed/post_tech2.jpg']),
    'نيويورك • القاهرة',
    1, 2500, 'التكنولوجيا والأعمال', 5690, 164, 410
  );

  const insertPostComment = db.prepare('INSERT INTO post_comments (id, post_id, user_id, content) VALUES (?, ?, ?, ?)');
  insertPostComment.run('pc_1', 'p_1', 'u_mariam', 'الزاوية والإضاءة خيالية فعلًا! 😍🔥');
  insertPostComment.run('pc_2', 'p_1', 'u_nour', 'ثاني صورة على النيل محتاجة تتعلق في معرض!');

  // Authentic Viral-Style TikTok / Reels Videos
  const insertVideo = db.prepare(`
    INSERT INTO short_videos (
      id, user_id, title, description, tags, audio_title, video_url, poster_url,
      duration_sec, is_sponsored, sponsor_budget_egp, likes_count, comments_count, saves_count, shares_count, views_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertVideo.run(
    'v_1', 'u_mariam',
    'لما الإضاءة والموسيقى يندمجوا في لحظة واحدة ✨🔥',
    'أقوى لقطة صورناها الأسبوع ده بدون أي فلاتر!',
    '#تصوير #سينما #القاهرة #اجواء #fyp',
    'Cairo Midnight Pulse — Mariam Original',
    '/uploads/seed/reel1.mp4', '/uploads/seed/post_studio.jpg',
    15, 0, 0, 248900, 3420, 31400, 12800, 1950000
  );

  insertVideo.run(
    'v_2', 'u_nour',
    'اهرب لمكان مفيهوش غير صوت المية والهوا 🌊🤍',
    'مين محتاج يفصل في مكان زي ده دلوقتي؟',
    '#سفر #هدوء #طبيعة #بحر #vibes',
    'Ocean Breeze Ambient — Nour Studio',
    '/uploads/seed/reel2.mp4', '/uploads/seed/post_nile.jpg',
    15, 0, 0, 164200, 1890, 24100, 7430, 1120000
  );

  insertVideo.run(
    'v_3', 'u_karim',
    'طريق مفتوح وموسيقى آخر الليل.. إحساس الحرية 🏎️⚡',
    'التجربة الكاملة على الطريق الساحلي الجديد.',
    '#سيارات #ليل #سرعة #سفر',
    'Nightrunner 2026 — Synth Audio',
    '/uploads/seed/reel3.mp4', '/uploads/seed/post_tech1.jpg',
    15, 1, 3200, 92400, 980, 11900, 4120, 840000
  );

  insertVideo.run(
    'v_4', 'u_youssef',
    'التفاصيل الصغيرة هي اللي بتصنع الفارق الحقيقي دائمًا 🚀',
    'لقطات من يوم شغل مكثف مع الفريق في القاهرة.',
    '#شغف #تصميم #إبداع #مصر',
    'Focus Flow — Youssef Original',
    '/uploads/seed/reel4.mp4', '/uploads/seed/post_cairo.jpg',
    15, 0, 0, 312000, 4910, 52800, 19400, 2840000
  );

  // Rich Threaded & VOICE Video Comments!
  const insertVidComment = db.prepare(`
    INSERT INTO video_comments (id, video_id, user_id, parent_id, content, audio_url, audio_duration_sec, transcript, likes_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertVidComment.run('vc_1', 'v_1', 'u_youssef', null, 'الكادر وتدريج الألوان في حتة تانية خالص! 🔥👏', null, 0, null, 842, 'منذ 12 د');
  // Nested Voice Reply to vc_1!
  insertVidComment.run('vc_2', 'v_1', 'u_mariam', 'vc_1', '', '/uploads/seed/voice_note_1.wav', 6, 'شكرًا جدًا يا يوسف! صورناها بعد الغروب بدقايق بضوء طبيعي بالكامل.', 219, 'منذ 9 د');
  // Nested Text Reply to vc_1!
  insertVidComment.run('vc_3', 'v_1', 'u_nour', 'vc_1', 'اتفق جدًا، العدسة الـ 35mm فرقت جدًا في العمق هنا ✨', null, 0, null, 94, 'منذ 5 د');
  // Top-level Voice Comment!
  insertVidComment.run('vc_4', 'v_1', 'u_karim', null, '', '/uploads/seed/voice_note_1.wav', 6, 'الموسيقى راكبة على حركة الكاميرا بالملي! استمروا على المستوى ده.', 315, 'منذ 18 د');
  insertVidComment.run('vc_5', 'v_2', 'u_mariam', null, 'المكان ده يرد الروح بجد 😍🌊', null, 0, null, 512, 'منذ 25 د');

  // Authentic Conversations (ZERO tutorial text!)
  const insertConv = db.prepare(`
    INSERT INTO conversations (
      id, type, folder, title, description, avatar_color, avatar_url,
      online_text, pinned_message, is_pinned, unread_count, is_large_group, is_encrypted, member_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertConv.run(
    'c_mariam', 'dm', 'personal', 'مريم الشريف', 'Visual Director & Live Creator',
    '#10B981', '/uploads/seed/avatar_mariam.jpg', 'متصل الآن',
    'بروفة الصوت الساعة 8:30 قبل البث المباشر 🎙️', 1, 2, 0, 1, 2
  );
  insertConv.run(
    'c_karim', 'dm', 'personal', 'كريم فؤاد', 'NYC / Cairo Macro',
    '#3B82F6', '/uploads/seed/avatar_karim.jpg', 'متصل الآن',
    null, 1, 0, 0, 1, 2
  );
  insertConv.run(
    'c_nour', 'dm', 'personal', 'نور حسن', 'Cinematographer',
    '#F59E0B', '/uploads/seed/avatar_nour.jpg', 'آخر ظهور منذ دقيقتين',
    null, 0, 1, 0, 1, 2
  );
  insertConv.run(
    'c_founders', 'community', 'channels', 'Cairo Creators & Founders ⚡',
    'المجتمع الرئيسي لصناع المحتوى ورواد التكنولوجيا في مصر والشرق الأوسط',
    '#8B5CF6', '/uploads/seed/post_cairo.jpg', '18,940 عضو • 1,120 متصل',
    'لقاء الأسبوع القادم في الزمالك يوم الخميس الساعة 7 مساءً ✨', 0, 4, 1, 0, 18940
  );
  insertConv.run(
    'c_lm_core', 'group', 'groups', 'استوديو الإنتاج والتصوير 🎬',
    'مجموعة تنسيق جلسات التصوير والموسيقى',
    '#10B981', '/uploads/seed/post_studio.jpg', '14 عضو • 6 متصلين',
    null, 0, 0, 0, 1, 14
  );

  const insertMsg = db.prepare(`
    INSERT INTO messages (
      id, conversation_id, sender_id, content, msg_type, media_url, transcript, send_effect,
      reply_to_id, reply_sender, reply_text, reactions_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMsg.run(
    'm_1', 'c_mariam', 'u_mariam',
    'شوف اللقطة دي من سطح الاستوديو وقت الغروب النهاردة 🌇',
    'image', '/uploads/seed/post_cairo.jpg', null, null,
    null, null, null, JSON.stringify({ '❤️': ['u_youssef'], '🔥': ['u_youssef', 'u_mariam'] }), '09:38 م'
  );

  insertMsg.run(
    'm_2', 'c_mariam', 'u_youssef',
    'الإضاءة خيالية! جاهزين نبدأ البث المباشر الساعة 9؟',
    'text', null, null, 'fire',
    'm_1', 'مريم الشريف', 'شوف اللقطة دي من سطح الاستوديو وقت الغروب...',
    JSON.stringify({ '🔥': ['u_mariam'] }), '09:40 م'
  );

  // Real Voice Note with AI Transcript!
  insertMsg.run(
    'm_3', 'c_mariam', 'u_mariam',
    'رسالة صوتية',
    'audio', '/uploads/seed/voice_note_1.wav',
    'أيوه كل حاجة جاهزة تمامًا، المايك والكاميرا اتظبطوا وهنطلع في الميعاد بالثانية!',
    null, null, null, null, JSON.stringify({ '🎧': ['u_youssef'] }), '09:41 م'
  );

  // Real Circular Telegram/2026 Video Note Bubble!
  insertMsg.run(
    'm_4', 'c_mariam', 'u_mariam',
    'رسالة فيديو دائرية',
    'video_note', '/uploads/seed/reel2.mp4', null, null,
    null, null, null, JSON.stringify({ '😍': ['u_youssef'] }), '09:43 م'
  );

  insertMsg.run(
    'm_5', 'c_karim', 'u_karim',
    'مؤشر السوق قفل على ارتفاع 2.4% النهاردة، السيولة داخلة بقوة في قطاع التكنولوجيا 📈',
    'text', null, null, null, null, null, null, JSON.stringify({ '🚀': ['u_youssef'] }), '08:15 م'
  );

  insertMsg.run(
    'm_6', 'c_nour', 'u_nour',
    'بعتلك النسخة النهائية من الفيديو القصير، قول لي رأيك في الإيقاع السريع!',
    'text', null, null, null, null, null, null, '{}', '07:50 م'
  );

  insertMsg.run(
    'm_7', 'c_founders', 'u_youssef',
    'مساء النور جميعًا! شاركونا أحدث المشاريع اللي شغالين عليها الأسبوع ده 🔥',
    'text', null, null, null, null, null, null, JSON.stringify({ '🔥': ['u_mariam', 'u_karim', 'u_nour'], '❤️': ['u_omar'] }), '06:30 م'
  );

  // Live Rooms
  const insertLive = db.prepare(`
    INSERT INTO live_rooms (id, host_id, title, category, video_url, scene_preset, viewers_count, highlights_enabled, cooldown_sec, platform_cut_pct, total_gifts_egp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertLive.run('live_1', 'u_mariam', 'سهرة القاهرة المباشرة • موسيقى وتقنية 🎙️✨', 'بث مباشر', '/uploads/seed/reel1.mp4', 'cairo-studio', 4820, 1, 15, 25, 18400);
  insertLive.run('live_2', 'u_karim', 'نبض وول ستريت والبورصة المصرية لحظة بلحظة 📊', 'أسواق', '/uploads/seed/reel3.mp4', 'market-desk', 2390, 1, 15, 25, 9750);

  // Ledger
  const insertLedger = db.prepare(`
    INSERT INTO ledger_entries (id, user_id, debit_account, credit_account, amount_egp, category, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertLedger.run('led_1', 'u_youssef', 'reserve:pool', 'wallet:u_youssef:egp', 50000, 'mint', 'رصيد محفظة أولي');
  insertLedger.run('led_2', 'u_youssef', 'wallet:u_youssef:egp', 'lm:vip_subs', 1999, 'subscription', 'اشتراك عضوية VIP 1');
  insertLedger.run('led_3', 'u_mariam', 'gifts:live_1', 'creator:u_mariam', 750, 'gift_creator', 'أرباح هدايا البث المباشر (75%)');
  insertLedger.run('led_4', 'u_mariam', 'gifts:live_1', 'lm:commission', 250, 'gift_fee', 'حصة المنصة من الهدايا (25%)');

  const insertAudit = db.prepare(`
    INSERT INTO ai_security_logs (id, user_id, action_type, decision, reason)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertAudit.run('aud_1', 'u_youssef', 'PRIVATE_CHAT_GUARD', 'BLOCKED', 'حماية الخصوصية: المحادثات الخاصة معزولة عن الذكاء الاصطناعي.');
  insertAudit.run('aud_2', 'u_youssef', 'WALLET_ISOLATION', 'BLOCKED', 'حماية المحفظة: الذكاء الاصطناعي لا يملك صلاحيات مالية.');
}

export function mapUserRow(row: Record<string, unknown>): UserProfile {
  let adRemoval = { videos: false, largeGroups: false, ai: false, investment: false };
  try {
    adRemoval = JSON.parse(String(row.ad_removal_json || '{}'));
  } catch {
    // keep defaults
  }
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    displayNameEn: String(row.display_name_en),
    bio: String(row.bio || ''),
    avatarColor: String(row.avatar_color),
    avatarInitials: String(row.avatar_initials),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    verified: Boolean(row.verified),
    vipTier: Number(row.vip_tier) as UserProfile['vipTier'],
    prioritySupport: Boolean(row.priority_support),
    rankId: String(row.rank_id) as UserProfile['rankId'],
    supremeTitle: row.supreme_title ? (String(row.supreme_title) as UserProfile['supremeTitle']) : null,
    aiTier: String(row.ai_tier) as UserProfile['aiTier'],
    aiUsedToday: Number(row.ai_used_today || 0),
    adRemoval,
    customAppName: String(row.custom_app_name || 'LM'),
    customAppIcon: String(row.custom_app_icon || 'default'),
    theme: String(row.theme || 'obsidian') as UserProfile['theme'],
    country: String(row.country || 'EG') as UserProfile['country'],
    travelExceptionActive: Boolean(row.travel_exception_active),
    travelExceptionNote: row.travel_exception_note ? String(row.travel_exception_note) : null,
    monthsAbroad: Number(row.months_abroad || 0),
    targetCountry: row.target_country ? (String(row.target_country) as UserProfile['targetCountry']) : null,
    demoBalanceEgp: Number(row.demo_balance_egp || 0),
    creatorEarningsEgp: Number(row.creator_earnings_egp || 0),
    followersCount: Number(row.followers_count || 0),
    followingCount: Number(row.following_count || 0),
    createdAt: String(row.created_at),
  };
}

const PROVIDERS_FILE = path.join(DATA_DIR, 'providers.json');

export function loadProviderConfig(): ProviderConfig {
  const defaults: ProviderConfig = {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    groqApiKey: process.env.GROQ_API_KEY || '',
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    livekitUrl: process.env.LIVEKIT_URL || '',
    livekitApiKey: process.env.LIVEKIT_API_KEY || '',
    livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
    meilisearchUrl: process.env.MEILISEARCH_URL || '',
    blnkUrl: process.env.BLNK_URL || '',
    matrixUrl: process.env.MATRIX_HOMESERVER_URL || '',
    defaultProvider: 'local-smart',
    defaultModel: 'lm-smart-local',
  };
  if (fs.existsSync(PROVIDERS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(PROVIDERS_FILE, 'utf-8'));
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  }
  return defaults;
}

export function saveProviderConfig(patch: Partial<ProviderConfig>): ProviderConfig {
  const current = loadProviderConfig();
  const next = { ...current, ...patch };
  fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
