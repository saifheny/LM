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

const TARGET_DB_VERSION = 13;

export function initDatabase() {
  const verRow = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (verRow.user_version < TARGET_DB_VERSION) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS notifications;
      DROP TABLE IF EXISTS user_follows;
      DROP TABLE IF EXISTS ai_messages;
      DROP TABLE IF EXISTS ai_sessions;
      DROP TABLE IF EXISTS post_reactions;
      DROP TABLE IF EXISTS post_poll_votes;
      DROP TABLE IF EXISTS post_votes;
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
      cover_url TEXT,
      location TEXT DEFAULT 'القاهرة',
      website TEXT DEFAULT '',
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
      demo_balance_egp REAL DEFAULT 25000,
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
      topic TEXT DEFAULT 'عام',
      content TEXT NOT NULL,
      media_url TEXT,
      media_urls_json TEXT DEFAULT '[]',
      poll_json TEXT,
      location TEXT DEFAULT 'القاهرة',
      score INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      shares_count INTEGER DEFAULT 0,
      is_edited INTEGER DEFAULT 0,
      created_at TEXT DEFAULT 'منذ 18 د',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS post_votes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      vote INTEGER NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_poll_votes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      option_id TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_saves (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_reactions (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reaction TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      parent_id TEXT,
      content TEXT DEFAULT '',
      audio_url TEXT,
      audio_duration_sec INTEGER DEFAULT 6,
      transcript TEXT,
      ai_summoned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT 'منذ 5 د',
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
      ai_summoned INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      liked_by_json TEXT DEFAULT '[]',
      is_edited INTEGER DEFAULT 0,
      created_at TEXT DEFAULT 'منذ دقيقتين'
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      folder TEXT DEFAULT 'personal',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      avatar_color TEXT DEFAULT '#27272A',
      avatar_url TEXT,
      online_text TEXT DEFAULT 'متصل الآن',
      pinned_message TEXT,
      is_pinned INTEGER DEFAULT 0,
      unread_count INTEGER DEFAULT 0,
      is_large_group INTEGER DEFAULT 0,
      is_encrypted INTEGER DEFAULT 1,
      ai_enabled INTEGER DEFAULT 0,
      creator_id TEXT DEFAULT 'u_youssef',
      dm_key TEXT,
      peer_user_id TEXT,
      member_count INTEGER DEFAULT 2,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      msg_type TEXT DEFAULT 'text',
      media_url TEXT,
      transcript TEXT,
      is_spoiler INTEGER DEFAULT 0,
      is_edited INTEGER DEFAULT 0,
      ai_summoned INTEGER DEFAULT 0,
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
      cooldown_sec INTEGER DEFAULT 10,
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

    CREATE TABLE IF NOT EXISTS ai_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      company_id TEXT DEFAULT 'gemini',
      model_id TEXT DEFAULT 'gemini-3.8-flash',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      audio_url TEXT,
      transcript TEXT,
      company_id TEXT,
      model_label TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_follows (
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      ref_tab TEXT DEFAULT 'social',
      ref_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT 'الآن'
    );

    CREATE TABLE IF NOT EXISTS user_interactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      author_id TEXT,
      action TEXT NOT NULL,
      keywords_json TEXT DEFAULT '[]',
      weight REAL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS content_reports (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reporter_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(target_type, target_id, reporter_id)
    );

    CREATE TABLE IF NOT EXISTS story_reactions (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reaction TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(story_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_reposts (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS user_audio_tracks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      duration_sec INTEGER DEFAULT 15,
      kind TEXT DEFAULT 'upload',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      room_code TEXT UNIQUE NOT NULL,
      conv_id TEXT,
      host_id TEXT NOT NULL,
      peer_id TEXT,
      title TEXT NOT NULL,
      call_scope TEXT DEFAULT 'dm',
      join_mode TEXT DEFAULT 'open',
      invited_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Safe non-destructive migrations for V15/V19/V20/V21 columns on existing databases
  try {
    db.exec('ALTER TABLE video_comments ADD COLUMN is_edited INTEGER DEFAULT 0;');
  } catch {
    // column already exists
  }
  try {
    db.exec('ALTER TABLE posts ADD COLUMN music_url TEXT;');
  } catch {
    // column already exists
  }
  try {
    db.exec('ALTER TABLE posts ADD COLUMN music_title TEXT;');
  } catch {
    // column already exists
  }
  try {
    db.exec('ALTER TABLE live_rooms ADD COLUMN likes_count INTEGER DEFAULT 0;');
  } catch {
    // column already exists
  }
  try {
    db.exec("ALTER TABLE live_rooms ADD COLUMN orientation TEXT DEFAULT 'portrait';");
  } catch {
    // column already exists
  }
  try {
    db.exec('ALTER TABLE ai_messages ADD COLUMN attachment_url TEXT;');
  } catch {
    // column already exists
  }
  try {
    db.exec('ALTER TABLE conversations ADD COLUMN max_members INTEGER DEFAULT 1000;');
  } catch {
    // column already exists
  }

  // Ensure vertical Live feed has at least 4 rich rooms to swipe through
  const liveCount = (db.prepare('SELECT COUNT(*) as c FROM live_rooms WHERE is_active = 1').get() as { c: number }).c;
  if (liveCount > 0 && liveCount < 4) {
    db.prepare(`
      INSERT OR IGNORE INTO live_rooms (id, host_id, title, category, video_url, scene_preset, viewers_count, is_active)
      VALUES
        ('live_3', 'u_karim', 'مراجعة أحدث تقنيات الذكاء الاصطناعي والبرمجة 2026', 'تقنية', '/uploads/seed/reel3.mp4', 'tech-studio', 3640, 1),
        ('live_4', 'u_nour', 'جولة ليلية هادئة وتصوير سينمائي على الكورنيش', 'تصوير', '/uploads/seed/reel4.mp4', 'nile-night', 2190, 1)
    `).run();
  }

  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, username, password, display_name, display_name_en, bio,
      avatar_color, avatar_initials, avatar_url, cover_url, location, website, verified, country,
      demo_balance_egp, creator_earnings_egp, followers_count, following_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'u_youssef', 'youssef', '123456', 'يوسف المنصوري', 'Youssef El-Mansoury',
    'مهندس منتجات وأنظمة مفتوحة المصدر • بناء الجيل القادم من المنصات الذكية',
    '#27272A', 'يم', '/uploads/seed/avatar_youssef.jpg', '/uploads/seed/post_cairo.jpg', 'القاهرة، مصر', 'https://lm.app/youssef', 1, 'EG', 48500, 12400, 284900, 310
  );

  insertUser.run(
    'u_mariam', 'mariam', '123456', 'مريم الشريف', 'Mariam El-Sherif',
    'مخرجة بصرية ومقدمة بثوث مباشرة • سينما وإضاءة ليلية في القاهرة',
    '#27272A', 'مش', '/uploads/seed/avatar_mariam.jpg', '/uploads/seed/post_studio.jpg', 'الزمالك، القاهرة', 'https://lm.app/mariam', 1, 'EG', 15200, 34900, 192400, 520
  );

  insertUser.run(
    'u_karim', 'karim', '123456', 'كريم فؤاد', 'Karim Fouad',
    'تقنية وإعلام رقمي • بين نيويورك والقاهرة',
    '#27272A', 'كف', '/uploads/seed/avatar_karim.jpg', '/uploads/seed/post_tech1.jpg', 'نيويورك / القاهرة', 'https://lm.app/karim', 1, 'US', 31000, 6200, 94200, 184
  );

  insertUser.run(
    'u_nour', 'nour', '123456', 'نور حسن', 'Nour Hassan',
    'مصورة سينمائية وصانعة محتوى • تفاصيل هادئة وإيقاع بصري',
    '#27272A', 'نح', '/uploads/seed/avatar_nour.jpg', '/uploads/seed/post_nile.jpg', 'الإسكندرية، مصر', '', 1, 'EG', 4300, 1850, 67800, 412
  );

  insertUser.run(
    'u_omar', 'omar', '123456', 'عمر طارق', 'Omar Tarek',
    'مهندس صوتيات ومطور مفتوح المصدر',
    '#27272A', 'عط', '/uploads/seed/avatar_omar.jpg', '/uploads/seed/post_studio.jpg', 'المعادي، القاهرة', '', 0, 'EG', 5400, 0, 5420, 290
  );

  const insertStory = db.prepare('INSERT INTO stories (id, user_id, media_url, caption) VALUES (?, ?, ?, ?)');
  insertStory.run('s_1', 'u_mariam', '/uploads/seed/story_1.jpg', 'كواليس السيت أب قبل البث المباشر');
  insertStory.run('s_2', 'u_youssef', '/uploads/seed/post_cairo.jpg', 'القاهرة وقت الغروب');
  insertStory.run('s_3', 'u_nour', '/uploads/seed/story_2.jpg', 'تلوين الفيلم القصير الجديد');
  insertStory.run('s_4', 'u_karim', '/uploads/seed/story_3.jpg', 'لقطات من المكتب');

  const insertPost = db.prepare(`
    INSERT INTO posts (id, user_id, topic, content, media_url, media_urls_json, poll_json, location, score, likes_count, comments_count, shares_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPost.run(
    'p_1', 'u_nour', 'عام',
    'الغروب من فوق النيل النهاردة كان لوحة سينمائية هادية جدًا. لقطتين بدون أي فلاتر، إيه رأيكم في توازن الإضاءة؟',
    '/uploads/seed/post_cairo.jpg', JSON.stringify(['/uploads/seed/post_cairo.jpg', '/uploads/seed/post_nile.jpg']),
    null, 'الزمالك، القاهرة', 1420, 1420, 3, 214, 'منذ 14 د'
  );

  insertPost.run(
    'p_2', 'u_mariam', 'عام',
    'خلصنا معايرة الصوت في الاستوديو.. البث المباشر شغال دلوقتي بجودة نقية وبدون أي تأخير.',
    '/uploads/seed/post_studio.jpg', JSON.stringify(['/uploads/seed/post_studio.jpg']),
    null, 'الشيخ زايد', 984, 984, 2, 128, 'منذ 42 د'
  );

  const poll1 = JSON.stringify({
    question: 'ما أكثر ميزة تستخدمها يوميًا؟',
    options: [
      { id: 'opt_1', text: 'المحادثات السريعة والرسائل الصوتية', votes: 614 },
      { id: 'opt_2', text: 'الفيديوهات القصيرة والبث المباشر', votes: 519 },
      { id: 'opt_3', text: 'المساعد الذكي والترجمة الفورية', votes: 428 },
    ],
  });

  insertPost.run(
    'p_3', 'u_youssef', 'عام',
    'التجربة الأنظف دائمًا هي اللي بتسيب الصورة والمحتوى يتكلموا بدون زحمة عناصر حولهم.',
    null, '[]', poll1, 'القاهرة', 815, 815, 2, 95, 'منذ ساعة'
  );

  insertPost.run(
    'p_4', 'u_karim', 'عام',
    'الجيل الجديد من معالجات الهواتف والذكاء الاصطناعي المحلي بيغير شكل التطبيقات بالكامل في 2026.',
    '/uploads/seed/post_tech1.jpg', JSON.stringify(['/uploads/seed/post_tech1.jpg', '/uploads/seed/post_tech2.jpg']),
    null, 'نيويورك • القاهرة', 642, 642, 1, 88, 'منذ ساعتين'
  );

  const insertPostComment = db.prepare(`
    INSERT INTO post_comments (id, post_id, user_id, parent_id, content, audio_url, audio_duration_sec, transcript, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPostComment.run('pc_1', 'p_1', 'u_mariam', null, 'الكادر الثاني على النيل تحفة بجد، توزيع الظلال ممتاز.', null, 0, null, 'منذ 11 د');
  insertPostComment.run('pc_2', 'p_1', 'u_nour', 'pc_1', '', '/uploads/seed/voice_note_1.wav', 6, 'شكرًا يا مريم! صورتها بعد الغروب بثماني دقائق بعدسة 35mm.', 'منذ 8 د');
  insertPostComment.run('pc_3', 'p_1', 'u_karim', null, 'الألوان الطبيعية دايمًا بتكسب.', null, 0, null, 'منذ 5 د');
  insertPostComment.run('pc_4', 'p_2', 'u_omar', null, 'العزل الصوتي الجديد فرق جدًا في وضوح الترددات.', null, 0, null, 'منذ 25 د');
  insertPostComment.run('pc_5', 'p_2', 'u_youssef', null, 'منتظرين البث!', null, 0, null, 'منذ 15 د');
  insertPostComment.run('pc_6', 'p_3', 'u_karim', null, 'البساطة والسرعة أهم من أي شيء.', null, 0, null, 'منذ 30 د');
  insertPostComment.run('pc_7', 'p_3', 'u_mariam', null, 'متفقة تمامًا.', null, 0, null, 'منذ 18 د');
  insertPostComment.run('pc_8', 'p_4', 'u_youssef', null, 'نقلة حقيقية في الأداء على الأجهزة.', null, 0, null, 'منذ ساعة');

  const insertVideo = db.prepare(`
    INSERT INTO short_videos (
      id, user_id, title, description, tags, audio_title, video_url, poster_url,
      duration_sec, likes_count, comments_count, saves_count, shares_count, views_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertVideo.run(
    'v_1', 'u_mariam',
    'لما الإضاءة والموسيقى يندمجوا في لحظة واحدة داخل الاستوديو — كواليس تصوير أحدث تجربة بصرية وإخراجية مع الفريق بالكامل باستخدام عدسات سينمائية وإضاءة ليلية طبيعية في قلب القاهرة ✨',
    'أقوى لقطة صورناها الأسبوع ده من الاستوديو', '#تصوير #سينما #القاهرة #إخراج #إضاءة', 'Cairo Midnight — Mariam Studio', '/uploads/seed/reel1.mp4', '/uploads/seed/post_studio.jpg', 15, 248900, 4, 31400, 12800, 1950000
  );
  insertVideo.run('v_2', 'u_nour', 'صوت المية والهوا بس بدون أي صخب', 'فصلان آخر الأسبوع', '#سفر #هدوء #طبيعة', 'Ocean Breeze — Nour Original', '/uploads/seed/reel2.mp4', '/uploads/seed/post_nile.jpg', 15, 164200, 2, 24100, 7430, 1120000);
  insertVideo.run('v_3', 'u_karim', 'طريق مفتوح وموسيقى آخر الليل', 'التجربة الكاملة على الطريق الساحلي', '#ليل #طريق #موسيقى', 'Nightrunner — Synth', '/uploads/seed/reel3.mp4', '/uploads/seed/post_tech1.jpg', 15, 92400, 1, 11900, 4120, 840000);
  insertVideo.run('v_4', 'u_youssef', 'التفاصيل البسيطة بتصنع كل الفارق', 'لقطات من يوم شغل مكثف', '#تصميم #تقنية #مصر', 'Focus Flow — Youssef', '/uploads/seed/reel4.mp4', '/uploads/seed/post_cairo.jpg', 15, 312000, 3, 52800, 19400, 2840000);

  const insertVidComment = db.prepare(`
    INSERT INTO video_comments (id, video_id, user_id, parent_id, content, audio_url, audio_duration_sec, transcript, likes_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertVidComment.run('vc_1', 'v_1', 'u_youssef', null, 'الكادر وتدريج الإضاءة في حتة تانية خالص', null, 0, null, 842, 'منذ 12 د');
  insertVidComment.run('vc_2', 'v_1', 'u_mariam', 'vc_1', '', '/uploads/seed/voice_note_1.wav', 6, 'شكرًا جدًا يا يوسف! صورناها بعد الغروب بدقايق بإضاءة طبيعية بالكامل.', 219, 'منذ 9 د');
  insertVidComment.run('vc_3', 'v_1', 'u_nour', 'vc_1', 'عدسة الـ 35mm فرقت جدًا في العمق هنا.', null, 0, null, 94, 'منذ 5 د');
  insertVidComment.run('vc_4', 'v_1', 'u_karim', null, '', '/uploads/seed/voice_note_1.wav', 6, 'الموسيقى راكبة على حركة الكاميرا بالملي، مستوى عالمي.', 315, 'منذ 18 د');

  const insertConv = db.prepare(`
    INSERT INTO conversations (
      id, type, folder, title, description, avatar_color, avatar_url,
      online_text, pinned_message, is_pinned, unread_count, is_encrypted, member_count, ai_enabled, creator_id, dm_key, peer_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertConv.run('c_mariam', 'dm', 'personal', 'مريم الشريف', 'Visual Director & Live Host', '#27272A', '/uploads/seed/avatar_mariam.jpg', 'متصل الآن', 'بروفة الصوت الساعة 8:30 قبل البث المباشر', 1, 2, 1, 2, 0, 'u_youssef', 'u_mariam::u_youssef', 'u_mariam');
  insertConv.run('c_karim', 'dm', 'personal', 'كريم فؤاد', 'NYC / Cairo', '#27272A', '/uploads/seed/avatar_karim.jpg', 'متصل الآن', null, 1, 1, 1, 2, 0, 'u_youssef', 'u_karim::u_youssef', 'u_karim');
  insertConv.run('c_nour', 'dm', 'personal', 'نور حسن', 'Cinematographer', '#27272A', '/uploads/seed/avatar_nour.jpg', 'آخر ظهور منذ دقيقتين', null, 0, 0, 1, 2, 0, 'u_youssef', 'u_nour::u_youssef', 'u_nour');
  insertConv.run('c_founders', 'community', 'channels', 'Cairo Builders & Tech', 'مجتمع المطورين وصناع المحتوى', '#27272A', '/uploads/seed/post_cairo.jpg', '18,940 عضو • 1,120 متصل', 'لقاء الأسبوع القادم في الزمالك يوم الخميس الساعة 7 مساءً', 0, 3, 0, 18940, 1, 'u_youssef', null, null);
  insertConv.run('c_lm_core', 'group', 'groups', 'استوديو الإنتاج والتصوير', 'تنسيق التصوير والموسيقى', '#27272A', '/uploads/seed/post_studio.jpg', '14 عضو • 6 متصلين', null, 0, 0, 1, 14, 0, 'u_youssef', null, null);

  const insertFollow = db.prepare('INSERT OR REPLACE INTO user_follows (follower_id, following_id) VALUES (?, ?)');
  insertFollow.run('u_youssef', 'u_mariam');
  insertFollow.run('u_mariam', 'u_youssef');
  insertFollow.run('u_karim', 'u_youssef');

  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, user_id, actor_id, type, text, ref_tab, ref_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertNotif.run('n_seed_1', 'u_youssef', 'u_mariam', 'message', 'أرسلت لك رسالة صوتية جديدة في الدردشة', 'chat', 'c_mariam', 0, 'منذ 5 د');
  insertNotif.run('n_seed_2', 'u_youssef', 'u_karim', 'react', 'تفاعل مع منشورك الأخير في المجتمع', 'social', 'p_1', 0, 'منذ 14 د');

  const insertPostRx = db.prepare('INSERT OR REPLACE INTO post_reactions (post_id, user_id, reaction) VALUES (?, ?, ?)');
  insertPostRx.run('p_1', 'u_mariam', 'love');
  insertPostRx.run('p_1', 'u_karim', 'fire');
  insertPostRx.run('p_1', 'u_nour', 'wow');
  insertPostRx.run('p_2', 'u_youssef', 'love');
  insertPostRx.run('p_2', 'u_karim', 'like');
  insertPostRx.run('p_3', 'u_mariam', 'fire');
  insertPostRx.run('p_3', 'u_nour', 'zap');
  insertPostRx.run('p_4', 'u_karim', 'like');

  const insertMsg = db.prepare(`
    INSERT INTO messages (
      id, conversation_id, sender_id, content, msg_type, media_url, transcript,
      is_spoiler, reply_to_id, reply_sender, reply_text, reactions_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMsg.run('m_1', 'c_mariam', 'u_mariam', 'Just finished color grading the sunset frame — sending it to you now.', 'image', '/uploads/seed/post_cairo.jpg', null, 0, null, null, null, JSON.stringify({ heart: ['u_youssef'], fire: ['u_youssef', 'u_mariam'] }), '09:38 م');
  insertMsg.run('m_2', 'c_mariam', 'u_youssef', 'الإضاءة وتفاصيل السما ممتازة، اعتمدي الزاوية دي للبرومو.', 'text', null, null, 0, 'm_1', 'مريم الشريف', 'Just finished color grading the sunset frame', JSON.stringify({ thumbs: ['u_mariam'] }), '09:40 م');
  insertMsg.run('m_3', 'c_mariam', 'u_mariam', 'رسالة صوتية', 'audio', '/uploads/seed/voice_note_1.wav', 'كل حاجة جاهزة تمامًا، المايك والكاميرا اتظبطوا وهنطلع في الميعاد بالثانية.', 0, null, null, null, JSON.stringify({ zap: ['u_youssef'] }), '09:42 م');
  insertMsg.run('m_4', 'c_mariam', 'u_mariam', 'رسالة فيديو دائرية', 'video_note', '/uploads/seed/reel2.mp4', null, 0, null, null, null, JSON.stringify({ fire: ['u_youssef'] }), '09:44 م');

  insertMsg.run('m_5', 'c_karim', 'u_karim', 'Hey! Just finished testing the new release in New York — performance feels super fast and clean. Are we ready for tonight?', 'text', null, null, 0, null, null, null, JSON.stringify({ zap: ['u_youssef'], hundred: ['u_karim'] }), '08:16 م');
  insertMsg.run('m_6', 'c_nour', 'u_nour', 'بعتلك النسخة النهائية من المونتاج، قول لي رأيك في الإيقاع.', 'text', null, null, 0, null, null, null, '{}', '07:50 م');
  insertMsg.run('m_7', 'c_founders', 'u_youssef', 'مساء النور جميعًا — شاركونا أحدث المشاريع المفتوحة اللي شغالين عليها الأسبوع ده.', 'text', null, null, 0, null, null, null, JSON.stringify({ fire: ['u_mariam', 'u_karim'], heart: ['u_nour'] }), '06:30 م');

  const insertLive = db.prepare(`
    INSERT INTO live_rooms (id, host_id, title, category, video_url, scene_preset, viewers_count, highlights_enabled, cooldown_sec, platform_cut_pct, total_gifts_egp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertLive.run('live_1', 'u_mariam', 'سهرة القاهرة المباشرة • صوتيات وسينما', 'مباشر', '/uploads/seed/reel1.mp4', 'cairo-studio', 4820, 1, 10, 25, 18400);
  insertLive.run('live_2', 'u_karim', 'جولة ليلية وموسيقى حية', 'موسيقى', '/uploads/seed/reel3.mp4', 'night-drive', 2390, 1, 10, 25, 9750);
}

export function mapUserRow(row: Record<string, unknown>): UserProfile {
  let adRemoval = { videos: false, largeGroups: false, ai: false, investment: false };
  try { adRemoval = JSON.parse(String(row.ad_removal_json || '{}')); } catch { /* ignore */ }
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    displayNameEn: String(row.display_name_en),
    bio: String(row.bio || ''),
    avatarColor: String(row.avatar_color),
    avatarInitials: String(row.avatar_initials),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    coverUrl: row.cover_url ? String(row.cover_url) : null,
    location: String(row.location || ''),
    website: String(row.website || ''),
    verified: Boolean(row.verified),
    vipTier: 0,
    prioritySupport: false,
    rankId: 'soldier',
    supremeTitle: null,
    aiTier: 'free',
    aiUsedToday: Number(row.ai_used_today || 0),
    adRemoval,
    customAppName: 'LM',
    customAppIcon: 'default',
    theme: 'obsidian',
    country: String(row.country || 'EG') as UserProfile['country'],
    travelExceptionActive: false,
    travelExceptionNote: null,
    monthsAbroad: 0,
    targetCountry: null,
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
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
    xaiApiKey: process.env.XAI_API_KEY || '',
    mistralApiKey: process.env.MISTRAL_API_KEY || '',
    groqApiKey: process.env.GROQ_API_KEY || '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
    togetherApiKey: process.env.TOGETHER_API_KEY || '',
    cohereApiKey: process.env.COHERE_API_KEY || '',
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    livekitUrl: process.env.LIVEKIT_URL || '',
    livekitApiKey: process.env.LIVEKIT_API_KEY || '',
    livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
    meilisearchUrl: process.env.MEILISEARCH_URL || '',
    blnkUrl: process.env.BLNK_URL || '',
    matrixUrl: process.env.MATRIX_HOMESERVER_URL || '',
    defaultProvider: 'gemini',
    defaultModel: 'gemini-3.8-flash',
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
