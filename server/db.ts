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
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      media_url TEXT,
      media_style TEXT,
      media_caption TEXT,
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
      video_url TEXT,
      scene_preset TEXT DEFAULT 'cairo-night',
      duration_sec INTEGER DEFAULT 24,
      is_sponsored INTEGER DEFAULT 0,
      sponsor_budget_egp REAL DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      saves_count INTEGER DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'dm' | 'group' | 'community'
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      avatar_color TEXT DEFAULT '#2F6BFF',
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
      ai_consent_ref TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS live_rooms (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      scene_preset TEXT NOT NULL,
      viewers_count INTEGER DEFAULT 1420,
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
      decision TEXT NOT NULL, -- 'ALLOWED' | 'BLOCKED'
      reason TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Fix post_comments foreign key typo if any table existed cleanly — ensure clean schema
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, username, password, display_name, display_name_en, bio,
      avatar_color, avatar_initials, verified, vip_tier, priority_support,
      rank_id, supreme_title, ai_tier, ai_used_today, ad_removal_json,
      custom_app_name, custom_app_icon, theme, country,
      demo_balance_egp, creator_earnings_egp, followers_count, following_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'u_youssef', 'youssef', '123456', 'يوسف المنصوري', 'Youssef El-Mansoury',
    'مؤسس ومهندس منظومات رقمية • القاهرة | نُعيد تعريف التجربة الرقمية الموحدة.',
    '#D4AF37', 'يم', 1, 1, 1, 'emperor', 'emperor', 'ai_200', 14,
    JSON.stringify({ videos: true, largeGroups: true, ai: true, investment: true }),
    'LM Imperial', 'platinum', 'obsidian', 'EG', 48500, 12400, 142800, 310
  );

  insertUser.run(
    'u_mariam', 'mariam', '123456', 'مريم الشريف', 'Mariam El-Sherif',
    'صانعة محتوى تقني وبث مباشر يومي • القاهرة 🎙️✨',
    '#10B981', 'مش', 1, 3, 0, 'general', null, 'ai_100', 22,
    JSON.stringify({ videos: true, largeGroups: false, ai: true, investment: false }),
    'LM', 'default', 'obsidian', 'EG', 15200, 34900, 89400, 520
  );

  insertUser.run(
    'u_karim', 'karim', '123456', 'كريم فؤاد', 'Karim Fouad',
    'محلل أسواق مالية وتقنية • بين القاهرة ونيويورك 📊',
    '#2F6BFF', 'كف', 1, 2, 0, 'prince', null, 'ai_100', 9,
    JSON.stringify({ videos: true, largeGroups: true, ai: false, investment: true }),
    'LM', 'cobalt', 'obsidian', 'US', 31000, 6200, 51200, 184
  );

  insertUser.run(
    'u_nour', 'nour', '123456', 'نور حسن', 'Nour Hassan',
    'مصممة جرافيك وتصوير سينمائي قصير 🎬',
    '#F59E0B', 'نح', 0, 5, 0, 'sergeant', null, 'ai_20', 6,
    JSON.stringify({ videos: true, largeGroups: false, ai: false, investment: false }),
    'LM', 'default', 'obsidian', 'EG', 4300, 1850, 12900, 412
  );

  insertUser.run(
    'u_omar', 'omar', '123456', 'عمر طارق', 'Omar Tarek',
    'مهتم بالتكنولوجيا والذكاء الاصطناعي وريادة الأعمال.',
    '#64748B', 'عط', 0, 0, 0, 'soldier', null, 'free', 3,
    JSON.stringify({ videos: false, largeGroups: false, ai: false, investment: false }),
    'LM', 'default', 'obsidian', 'EG', 1200, 0, 840, 290
  );

  // Seed Posts
  const insertPost = db.prepare(`
    INSERT INTO posts (id, user_id, content, media_style, media_caption, is_sponsored, sponsor_budget_egp, sponsor_audience, likes_count, comments_count, shares_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPost.run(
    'p_1', 'u_youssef',
    'إطلاق التجربة الموحدة الأولى لـ LM — محادثات مشفرة، فيديوهات قصيرة، بث مباشر بنظام أولوية تعليقات VIP، ومساعد ذكي يحترم خصوصيتك ولا يلمس محادثاتك الخاصة أو أموالك.\n\nالمبدأ بسيط: منظومة واحدة، سرعة فائقة، وتجربة نظيفة بدون تشتت.',
    'editorial-architecture', 'LM Unified Architecture • Egypt to Global',
    0, 0, null, 1842, 128, 340
  );

  insertPost.run(
    'p_2', 'u_mariam',
    'النهاردة الساعة 9 مساءً في البث المباشر هنختبر نظام التعليقات المميزة لـ VIP 1 و2 و3 على الهواء مع هدايا البث المباشر. جهزوا أسئلتكم عن صناعة المحتوى التقني في مصر! 🎙️',
    'studio-live', 'بث مباشر • ليلة القاهرة التقنية',
    0, 0, null, 934, 76, 112
  );

  insertPost.run(
    'p_3', 'u_karim',
    'ترويج حملة: تقرير الربع الرابع لأسواق التكنولوجيا والشركات الناشئة في الشرق الأوسط وشمال أفريقيا — متاح الآن للتحليل المباشر عبر الرسوم البيانية التفاعلية في قسم الاستثمار.',
    'market-pulse', 'تقرير الأسواق • Q4 MENA Tech Pulse',
    1, 1500, 'رواد الأعمال والمستثمرون — مصر والخليج', 612, 41, 89
  );

  insertPost.run(
    'p_4', 'u_nour',
    'جربت ألوان الثيم الداكن الجديد في LM مع التبديل السلس بين الفيديوهات القصيرة والشات. الفارق الحقيقي في أي تطبيق هو الإحساس بالانسيابية وعدم التداخل بين العناصر.',
    'visual-craft', 'تصميم وتجربة مستخدم • Visual Craft',
    0, 0, null, 418, 29, 34
  );

  // Seed Short Videos
  const insertVideo = db.prepare(`
    INSERT INTO short_videos (id, user_id, title, description, tags, scene_preset, duration_sec, is_sponsored, sponsor_budget_egp, likes_count, comments_count, saves_count, views_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertVideo.run(
    'v_1', 'u_youssef',
    'لماذا يحتاج السوق العربي لـ Super App حقيقي؟',
    'رحلة سريعة في 30 ثانية داخل تصميم LM الموحد: من الشات المشفر للبث المباشر للذكاء الاصطناعي في مكان واحد.',
    '#LM #تكنولوجيا #مصر #SuperApp',
    'cairo-skyline', 28, 0, 0, 24500, 1340, 4820, 184200
  );

  insertVideo.run(
    'v_2', 'u_mariam',
    'كيف يعمل نظام تعليقات VIP المميزة في البث؟',
    'شرح عملي لنظام الأولوية: 15 ثانية لـ VIP 1، 10 ثوانٍ لـ VIP 2، و5 ثوانٍ لـ VIP 3 مع فلتر أمان فوري.',
    '#بث_مباشر #VIP #صناع_المحتوى',
    'broadcast-pulse', 22, 0, 0, 18900, 920, 3110, 132400
  );

  insertVideo.run(
    'v_3', 'u_karim',
    'قراءة حركة EGX30 وأسهم التكنولوجيا في دقيقة',
    'محتوى ممول • نظرة مركزة على أهم المؤشرات باستخدام رسوم TradingView المدمجة داخل قسم الاستثمار.',
    '#استثمار #البورصة #ممول',
    'market-wave', 35, 1, 2200, 11200, 480, 2950, 95600
  );

  insertVideo.run(
    'v_4', 'u_nour',
    'كواليس تصوير ليلي في وسط البلد — القاهرة',
    'إضاءة سينمائية سريعة وتدريج ألوان هادئ — جرب رفع فيديوهاتك القصيرة بجودة عالية مباشرة على LM.',
    '#القاهرة #تصوير #سينما',
    'nile-gold', 19, 0, 0, 31400, 1620, 7400, 241000
  );

  // Seed Conversations & Messages
  const insertConv = db.prepare(`
    INSERT INTO conversations (id, type, title, description, avatar_color, is_large_group, is_encrypted, member_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertConv.run('c_mariam', 'dm', 'مريم الشريف', 'محادثة فردية مشفرة', '#10B981', 0, 1, 2);
  insertConv.run('c_karim', 'dm', 'كريم فؤاد', 'محادثة فردية مشفرة', '#2F6BFF', 0, 1, 2);
  insertConv.run('c_founders', 'community', 'مجتمع رواد الأعمال المصريين', 'مجموعة عامة كبيرة لمناقشة المشاريع الناشئة والاستثمار (أكثر من 12,000 عضو)', '#D4AF37', 1, 0, 12480);
  insertConv.run('c_lm_core', 'group', 'فريق تصميم ومعمارية LM', 'مجموعة خاصة مشفرة لفريق التطوير والتصميم', '#6366F1', 0, 1, 18);

  const insertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, content, msg_type)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertMsg.run('m_1', 'c_mariam', 'u_mariam', 'أهلًا يوسف! جربت شاشة البث المباشر الجديدة، ترتيب أولوية تعليقات VIP سلس جدًا بدون أي تهنيج.', 'text');
  insertMsg.run('m_2', 'c_mariam', 'u_youssef', 'ممتاز جدًا! الأهم إننا نحافظ على نظافة الواجهة وتشفير الرسائل، وإن @LM AI ميتدخلش أبدًا غير لما نشارك معاه رسالة محددة بإذننا.', 'text');
  insertMsg.run('m_3', 'c_mariam', 'u_mariam', 'فعلاً دي أقوى نقطة ثقة للمستخدمين. جرب تضغط على أي رسالة هنا وتختار "مشاركة مع LM AI" عشان تشوف جدار الخصوصية عمليًا.', 'text');

  insertMsg.run('m_4', 'c_karim', 'u_karim', 'قارنت تسعير العضويات بين مصر وأمريكا — قاعدة الـ 3 أشهر + شهر السماح مع استثناء السفر المؤقت منطقية جدًا للمستثمرين.', 'text');
  insertMsg.run('m_5', 'c_karim', 'u_youssef', 'بالظبط، لازم العميل اللي مسافر سياحة شهرين ميتفاجئش بتغيير عملته، وفي نفس الوقت التسعير يتناسب مع القدرة الشرائية لكل بلد.', 'text');

  insertMsg.run('m_6', 'c_founders', 'u_karim', 'أهلاً بالجميع في مجتمع رواد الأعمال. ما هو برأيكم أهم عامل يجذب المستثمر في النسخة التجريبية لأي Super App؟', 'text');
  insertMsg.run('m_7', 'c_founders', 'u_nour', 'سرعة التطبيق وتناسق التصميم وعدم وجود عناصر متداخلة، بالإضافة لوضوح نموذج الربح.', 'text');

  insertMsg.run('m_8', 'c_lm_core', 'u_youssef', 'تذكير مهم للفريق: كل الخدمات مربوطة بواجهات API معيارية عشان نقدر نوسّع أو نستبدل أي محرك مفتوح المصدر لاحقًا.', 'text');

  // Seed Live Rooms
  const insertLive = db.prepare(`
    INSERT INTO live_rooms (id, host_id, title, category, scene_preset, viewers_count, highlights_enabled, cooldown_sec, platform_cut_pct, total_gifts_egp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertLive.run('live_1', 'u_mariam', 'ليلة القاهرة التقنية — تجربة تعليقات VIP والهدايا', 'تقنية وريادة أعمال', 'cairo-studio', 3840, 1, 15, 25, 14200);
  insertLive.run('live_2', 'u_karim', 'جلسة الأسواق العالمية والبورصة المصرية مباشر', 'أسواق واستثمار', 'market-desk', 1920, 1, 15, 25, 8600);

  // Seed Demo Double-Entry Ledger Entries (Sandbox)
  const insertLedger = db.prepare(`
    INSERT INTO ledger_entries (id, user_id, debit_account, credit_account, amount_egp, category, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertLedger.run('led_1', 'u_youssef', 'sandbox:funding_pool', 'wallet:u_youssef:egp', 50000, 'sandbox_mint', 'رصيد تجريبي أولي لبيئة العرض (Sandbox)');
  insertLedger.run('led_2', 'u_youssef', 'wallet:u_youssef:egp', 'revenue:lm:vip_subs', 1999, 'subscription', 'تفعيل تجريبي لعضوية VIP 1 (شهري)');
  insertLedger.run('led_3', 'u_mariam', 'gifts:escrow:live_1', 'creator:u_mariam:earnings', 750, 'gift_creator_share', 'حصة صانع المحتوى من هدية البث المباشر (75%)');
  insertLedger.run('led_4', 'u_mariam', 'gifts:escrow:live_1', 'revenue:lm:gift_commission', 250, 'gift_platform_fee', 'عمولة منصة LM من الهدايا الافتراضية (25%)');

  // Seed AI Security Audit Log
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
