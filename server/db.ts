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

const TARGET_DB_VERSION = 2;

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
      location TEXT DEFAULT 'القاهرة، مصر',
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
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS short_videos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      tags TEXT DEFAULT '',
      audio_title TEXT DEFAULT 'الصوت الأصلي — LM Studio',
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
      content TEXT NOT NULL,
      likes_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'dm' | 'group' | 'community'
      folder TEXT DEFAULT 'personal', -- 'personal' | 'groups' | 'channels'
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      avatar_color TEXT DEFAULT '#3390EC',
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
      msg_type TEXT DEFAULT 'text', -- 'text' | 'image' | 'audio' | 'file' | 'ai_reply'
      media_url TEXT,
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
      viewers_count INTEGER DEFAULT 3840,
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
    'مؤسس ومهندس منظومات رقمية • القاهرة 🇪🇬 | نبني الجيل الجديد من التطبيقات الفائقة.',
    '#D4AF37', 'يم', '/uploads/seed/avatar_youssef.jpg', 1, 1, 1, 'emperor', 'emperor', 'ai_200', 14,
    JSON.stringify({ videos: true, largeGroups: true, ai: true, investment: true }),
    'LM', 'platinum', 'obsidian', 'EG', 48500, 12400, 142800, 310
  );

  insertUser.run(
    'u_mariam', 'mariam', '123456', 'مريم الشريف', 'Mariam El-Sherif',
    'صانعة محتوى تقني وبث مباشر يومي من القاهرة 🎙️✨',
    '#10B981', 'مش', '/uploads/seed/avatar_mariam.jpg', 1, 3, 0, 'general', null, 'ai_100', 22,
    JSON.stringify({ videos: true, largeGroups: false, ai: true, investment: false }),
    'LM', 'default', 'obsidian', 'EG', 15200, 34900, 89400, 520
  );

  insertUser.run(
    'u_karim', 'karim', '123456', 'كريم فؤاد', 'Karim Fouad',
    'محلل أسواق مالية وتقنية • القاهرة / نيويورك 📈',
    '#3390EC', 'كف', '/uploads/seed/avatar_karim.jpg', 1, 2, 0, 'prince', null, 'ai_100', 9,
    JSON.stringify({ videos: true, largeGroups: true, ai: false, investment: true }),
    'LM', 'cobalt', 'obsidian', 'US', 31000, 6200, 51200, 184
  );

  insertUser.run(
    'u_nour', 'nour', '123456', 'نور حسن', 'Nour Hassan',
    'مخرجة بصرية وتصوير سينمائي قصير 🎬',
    '#F59E0B', 'نح', '/uploads/seed/avatar_nour.jpg', 1, 5, 0, 'sergeant', null, 'ai_20', 6,
    JSON.stringify({ videos: true, largeGroups: false, ai: false, investment: false }),
    'LM', 'default', 'obsidian', 'EG', 4300, 1850, 12900, 412
  );

  insertUser.run(
    'u_omar', 'omar', '123456', 'عمر طارق', 'Omar Tarek',
    'مطور ومهتم بالذكاء الاصطناعي والمصادر المفتوحة.',
    '#64748B', 'عط', '/uploads/seed/avatar_omar.jpg', 0, 0, 0, 'soldier', null, 'free', 3,
    JSON.stringify({ videos: false, largeGroups: false, ai: false, investment: false }),
    'LM', 'default', 'obsidian', 'EG', 1200, 0, 840, 290
  );

  // Stories (Instagram / Telegram Stories ring!)
  const insertStory = db.prepare('INSERT INTO stories (id, user_id, media_url, caption) VALUES (?, ?, ?, ?)');
  insertStory.run('s_1', 'u_mariam', '/uploads/seed/story_1.jpg', 'تحضيرات استوديو البث المباشر الليلة الساعة 9 بتوقيت القاهرة 🎙️🔥');
  insertStory.run('s_2', 'u_youssef', '/uploads/seed/post_cairo.jpg', 'القاهرة من الأعلى — البداية من مصر والتوسع للعالم 🌍');
  insertStory.run('s_3', 'u_nour', '/uploads/seed/story_2.jpg', 'كواليس مونتاج الفيديوهات القصيرة الجديدة على LM 🎬');
  insertStory.run('s_4', 'u_karim', '/uploads/seed/story_3.jpg', 'افتتاح قوي لمؤشر EGX30 وأسهم التكنولوجيا اليوم 📊');

  // Social Posts with real high-resolution photography & carousels
  const insertPost = db.prepare(`
    INSERT INTO posts (id, user_id, content, media_url, media_urls_json, location, is_sponsored, sponsor_budget_egp, sponsor_audience, likes_count, comments_count, shares_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPost.run(
    'p_1', 'u_youssef',
    'لحظة الغروب فوق القاهرة والنيل ✨\nصممنا LM عشان تجمع المحادثات المشفرة السريعة بمستوى Telegram، والفيديوهات القصيرة الانسيابية بمستوى TikTok، والمساعد الذكي في مكان واحد متكامل.',
    '/uploads/seed/post_cairo.jpg',
    JSON.stringify(['/uploads/seed/post_cairo.jpg', '/uploads/seed/post_nile.jpg']),
    'الزمالك، القاهرة',
    0, 0, null, 4820, 312, 640
  );

  insertPost.run(
    'p_2', 'u_mariam',
    'من داخل الاستوديو قبل بدء البث المباشر! 🎧🎙️\nالليلة هنجرب سوا نظام التعليقات المميزة لـ VIP 1 (15 ثانية) وVIP 2 (10 ثوانٍ) وVIP 3 (5 ثوانٍ) مع الهدايا المباشرة.',
    '/uploads/seed/post_studio.jpg',
    JSON.stringify(['/uploads/seed/post_studio.jpg']),
    'مدينة الإنتاج، الجيزة',
    0, 0, null, 2940, 184, 215
  );

  insertPost.run(
    'p_3', 'u_karim',
    'تقرير الربع الرابع للبنية التحتية للذكاء الاصطناعي والرقائق الإلكترونية — متاح الآن مع رسوم الشموع اليابانية التفاعلية في قسم الأسواق.',
    '/uploads/seed/post_tech1.jpg',
    JSON.stringify(['/uploads/seed/post_tech1.jpg', '/uploads/seed/post_tech2.jpg']),
    'التجمع الخامس، القاهرة الجديدة',
    1, 2500, 'رواد الأعمال والمستثمرون — مصر والخليج', 1690, 94, 178
  );

  // Seed Comments on Posts
  const insertPostComment = db.prepare('INSERT INTO post_comments (id, post_id, user_id, content) VALUES (?, ?, ?, ?)');
  insertPostComment.run('pc_1', 'p_1', 'u_mariam', 'التصوير وتناسق الألوان تحفة! سرعة التنقل بقت رهيبة 🔥');
  insertPostComment.run('pc_2', 'p_1', 'u_karim', 'الجمع بين الشات والفيديوهات في واجهة بدون زحمة هو المستقبل فعلاً.');

  // Short Videos (TikTok / Loops Full-Screen HD MP4s!)
  const insertVideo = db.prepare(`
    INSERT INTO short_videos (
      id, user_id, title, description, tags, audio_title, video_url, poster_url,
      duration_sec, is_sponsored, sponsor_budget_egp, likes_count, comments_count, saves_count, shares_count, views_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertVideo.run(
    'v_1', 'u_mariam',
    'جولة ليلية سريعة بتقنية السينما الرقمية 🔥',
    'لما تجتمع السرعة مع الصورة السينمائية النقية على LM Shorts! اسحب للأعلى للفيديو التالي 👆',
    '#LM #القاهرة #تصوير #تيك_توك #مصر',
    'الصوت الأصلي — استوديو مريم الشريف • Cairo Beats',
    '/uploads/seed/reel1.mp4', '/uploads/seed/post_studio.jpg',
    15, 0, 0, 184200, 2410, 19400, 8320, 1420000
  );

  insertVideo.run(
    'v_2', 'u_nour',
    'هروب للطبيعة والهدوء بعد أسبوع شغل طويل 🌊✨',
    'أجمل لقطات السفر والاستكشاف بجودة كاملة بدون أي تقطيع. جرب تضغط مرتين على الشاشة للإعجاب ❤️',
    '#سفر #طبيعة #استكشاف #سينما',
    'موسيقى هادئة — Acoustic Horizon • Nour',
    '/uploads/seed/reel2.mp4', '/uploads/seed/post_nile.jpg',
    15, 0, 0, 96400, 1180, 14200, 4190, 780000
  );

  insertVideo.run(
    'v_3', 'u_karim',
    'تجربة قيادة ليلية وأداء استثنائي على الطريق السريع 🏎️⚡',
    'حملة ترويجية ممولة • استمتع بسرعة استجابة فائقة وتجربة مشاهدة رأسية كاملة.',
    '#سيارات #سرعة #ممول #تكنولوجيا',
    'Midnight Drive Synthwave — Karim Audio',
    '/uploads/seed/reel3.mp4', '/uploads/seed/post_tech1.jpg',
    15, 1, 3200, 64100, 740, 8900, 2650, 540000
  );

  insertVideo.run(
    'v_4', 'u_youssef',
    'كواليس بناء منظومة LM المتكاملة من قلب القاهرة 🚀',
    'شاهد كيف نربط الذكاء الاصطناعي بالمحتوى والبث المباشر مع احترام كامل لخصوصية المستخدم.',
    '#ريادة_أعمال #برمجة #ذكاء_اصطناعي #LM',
    'الصوت الأصلي — يوسف المنصوري',
    '/uploads/seed/reel4.mp4', '/uploads/seed/post_cairo.jpg',
    15, 0, 0, 231000, 3890, 41200, 15400, 2150000
  );

  const insertVidComment = db.prepare('INSERT INTO video_comments (id, video_id, user_id, content, likes_count) VALUES (?, ?, ?, ?, ?)');
  insertVidComment.run('vc_1', 'v_1', 'u_youssef', 'جودة الفيديو وسلاسة التمرير عالمية! 👏🔥', 418);
  insertVidComment.run('vc_2', 'v_1', 'u_nour', 'الإضاءة وحركة الكاميرا رهيبة جدًا ❤️', 192);
  insertVidComment.run('vc_3', 'v_1', 'u_omar', 'أخيرًا منصة عربية بتجربة مشاهدة سريعة ونظيفة كده!', 87);
  insertVidComment.run('vc_4', 'v_2', 'u_mariam', 'المكان تحفة! محتاجين رحلة قريب جدًا 😍', 264);

  // Telegram-Grade Conversations
  const insertConv = db.prepare(`
    INSERT INTO conversations (
      id, type, folder, title, description, avatar_color, avatar_url,
      online_text, pinned_message, is_pinned, unread_count, is_large_group, is_encrypted, member_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertConv.run(
    'c_mariam', 'dm', 'personal', 'مريم الشريف', 'محادثة فردية مشفرة من الطرفين',
    '#10B981', '/uploads/seed/avatar_mariam.jpg', 'متصل الآن',
    '📌 البث المباشر الليلة الساعة 9:00 م — تجربة تعليقات VIP المميزة', 1, 2, 0, 1, 2
  );
  insertConv.run(
    'c_karim', 'dm', 'personal', 'كريم فؤاد', 'محادثة فردية مشفرة',
    '#3390EC', '/uploads/seed/avatar_karim.jpg', 'آخر ظهور منذ 4 دقائق',
    null, 1, 0, 0, 1, 2
  );
  insertConv.run(
    'c_nour', 'dm', 'personal', 'نور حسن', 'محادثة فردية مشفرة',
    '#F59E0B', '/uploads/seed/avatar_nour.jpg', 'متصل الآن',
    null, 0, 1, 0, 1, 2
  );
  insertConv.run(
    'c_founders', 'community', 'channels', 'مجتمع رواد الأعمال المصريين 🇪🇬',
    'قناة ومجتمع عام لمناقشة الشركات الناشئة والتقنية والاستثمار في مصر والمنطقة',
    '#8774E1', '/uploads/seed/post_cairo.jpg', '12,480 مشترك • 642 متصل',
    '📌 مرحبًا بكم في المجتمع الرسمي لرواد الأعمال على منصة LM', 0, 5, 1, 0, 12480
  );
  insertConv.run(
    'c_lm_core', 'group', 'groups', 'مختبر هندسة وتصميم LM ⚡',
    'مجموعة خاصة مشفرة لفريق التطوير والمصادر المفتوحة',
    '#2F6BFF', '/uploads/seed/post_tech2.jpg', '18 عضو • 7 متصلين',
    '📌 التزموا ببنية Telegram Web A للدردشة وLoops للفيديوهات القصيرة', 0, 0, 0, 1, 18
  );

  // Rich Telegram Messages (Text + Photo + Voice Waveform + Reply Quote + Reactions!)
  const insertMsg = db.prepare(`
    INSERT INTO messages (
      id, conversation_id, sender_id, content, msg_type, media_url,
      reply_to_id, reply_sender, reply_text, reactions_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMsg.run(
    'm_1', 'c_mariam', 'u_mariam',
    'مساء الخير يا يوسف! شوف لقطة القاهرة اللي صورتها النهاردة قبل تجهيز الاستوديو 🌆',
    'image', '/uploads/seed/post_cairo.jpg',
    null, null, null, JSON.stringify({ '❤️': ['u_youssef'], '🔥': ['u_youssef', 'u_mariam'] }), '09:38 م'
  );

  insertMsg.run(
    'm_2', 'c_mariam', 'u_youssef',
    'لقطة خرافية فعلًا! واجهة الدردشة الجديدة بخلفيات وفقاعات تيليجرام مع التشفير طالعة فخمة وسريعة جدًا.',
    'text', null,
    'm_1', 'مريم الشريف', 'شوف لقطة القاهرة اللي صورتها النهاردة...',
    JSON.stringify({ '👍': ['u_mariam'] }), '09:40 م'
  );

  insertMsg.run(
    'm_3', 'c_mariam', 'u_mariam',
    'رسالة صوتية (0:06)',
    'audio', '/uploads/seed/voice_note_1.wav',
    null, null, null, JSON.stringify({ '🎧': ['u_youssef'] }), '09:41 م'
  );

  insertMsg.run(
    'm_4', 'c_mariam', 'u_mariam',
    'وكمان أهم ميزة إن المساعد الذكي @LM AI مستحيل يقرأ أي رسالة خاصة هنا إلا لو ضغطنا على الرسالة واخترنا مشاركتها معاه بإذننا 🔒✨',
    'text', null,
    null, null, null, JSON.stringify({ '❤️': ['u_youssef'] }), '09:42 م'
  );

  insertMsg.run(
    'm_5', 'c_karim', 'u_karim',
    'راجعت نموذج التسعير الجغرافي بين مصر وأمريكا — استثناء السفر المؤقت لمدة شهرين وقاعدة الـ 3 أشهر + شهر سماح جاهزة تمامًا للعرض على المستثمرين.',
    'text', null, null, null, null, JSON.stringify({ '🔥': ['u_youssef'] }), '08:15 م'
  );

  insertMsg.run(
    'm_6', 'c_nour', 'u_nour',
    'رفعت 4 فيديوهات قصيرة جديدة بجودة HD كاملة في قسم الفيديوهات القصيرة، جرب تسحب بينهم بالماوس أو الكيبورد!',
    'text', null, null, null, null, '{}', '07:50 م'
  );

  insertMsg.run(
    'm_7', 'c_founders', 'u_youssef',
    'مرحبًا بكم في مجتمع رواد الأعمال المصريين على LM! هدفنا تقديم تجربة موحدة تجمع سرعة تيليجرام ومتعة تيك توك وذكاء LM AI في منصة واحدة.',
    'text', null, null, null, null, JSON.stringify({ '🔥': ['u_mariam', 'u_karim', 'u_nour'], '❤️': ['u_omar'] }), '06:30 م'
  );

  insertMsg.run(
    'm_8', 'c_lm_core', 'u_karim',
    'تم دمج مكتبات TradingView Lightweight Charts وWaveSurfer وSwiper بنجاح مع صفر تهنيج.',
    'text', null, null, null, null, JSON.stringify({ '🚀': ['u_youssef', 'u_mariam'] }), '05:20 م'
  );

  // Live Rooms with real looping HD video stream!
  const insertLive = db.prepare(`
    INSERT INTO live_rooms (id, host_id, title, category, video_url, scene_preset, viewers_count, highlights_enabled, cooldown_sec, platform_cut_pct, total_gifts_egp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertLive.run('live_1', 'u_mariam', 'ليلة القاهرة التقنية — تجربة تعليقات VIP والهدايا المباشرة', 'تقنية وصناع محتوى', '/uploads/seed/reel1.mp4', 'cairo-studio', 3840, 1, 15, 25, 14200);
  insertLive.run('live_2', 'u_karim', 'تغطية الأسواق العالمية والبورصة المصرية لحظة بلحظة', 'أسواق واستثمار', '/uploads/seed/reel3.mp4', 'market-desk', 1920, 1, 15, 25, 8600);

  // Demo Ledger
  const insertLedger = db.prepare(`
    INSERT INTO ledger_entries (id, user_id, debit_account, credit_account, amount_egp, category, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertLedger.run('led_1', 'u_youssef', 'sandbox:funding_pool', 'wallet:u_youssef:egp', 50000, 'sandbox_mint', 'رصيد تجريبي أولي لبيئة العرض (Sandbox)');
  insertLedger.run('led_2', 'u_youssef', 'wallet:u_youssef:egp', 'revenue:lm:vip_subs', 1999, 'subscription', 'تفعيل تجريبي لعضوية VIP 1 (شهري)');
  insertLedger.run('led_3', 'u_mariam', 'gifts:escrow:live_1', 'creator:u_mariam:earnings', 750, 'gift_creator_share', 'حصة صانع المحتوى من هدية البث المباشر (75%)');
  insertLedger.run('led_4', 'u_mariam', 'gifts:escrow:live_1', 'revenue:lm:gift_commission', 250, 'gift_platform_fee', 'عمولة منصة LM من الهدايا الافتراضية (25%)');

  const insertAudit = db.prepare(`
    INSERT INTO ai_security_logs (id, user_id, action_type, decision, reason)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertAudit.run('aud_1', 'u_youssef', 'PRIVATE_CHAT_AUTOREAD', 'BLOCKED', 'سياسة الخصوصية: ممنوع وصول LM AI التلقائي للمحادثات الخاصة بدون إذن صريح.');
  insertAudit.run('aud_2', 'u_youssef', 'FINANCIAL_TRANSFER_ATTEMPT', 'BLOCKED', 'عزل الصلاحيات المالية: LM AI لا يملك أي صلاحية لتحويل الأموال أو تعديل الأرصدة.');
  insertAudit.run('aud_3', 'u_youssef', 'EXPLICIT_POST_SUMMARY', 'ALLOWED', 'مشاركة صريحة من المستخدم لتلخيص منشور عام داخل LM.');
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
