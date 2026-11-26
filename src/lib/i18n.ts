import { Lang } from '../types';

const DICT = {
  // Navigation & Account Hub
  nav_social: { ar: 'المجتمع', en: 'Community' },
  nav_videos: { ar: 'نبض', en: 'Pulse' },
  nav_live: { ar: 'مباشر', en: 'Live' },
  nav_chat: { ar: 'الدردشة', en: 'Chat' },
  nav_ai: { ar: 'LM AI', en: 'LM AI' },
  nav_profile: { ar: 'حسابي', en: 'Account' },
  account_hub: { ar: 'الحساب والإعدادات', en: 'Account & Settings' },
  my_profile: { ar: 'الملف الشخصي', en: 'My Profile' },
  notifications: { ar: 'الإشعارات', en: 'Notifications' },
  mark_all_read: { ar: 'قراءة الكل', en: 'Mark all read' },
  no_notifications: { ar: 'لا توجد إشعارات بعد', en: 'No notifications yet' },
  share_app: { ar: 'مشاركة تطبيق LM', en: 'Share LM App' },
  install_app: { ar: 'تثبيت تطبيق LM', en: 'Install LM App' },
  language: { ar: 'اللغة', en: 'Language' },
  switch_lang_label: { ar: 'English (الإنجليزية)', en: 'العربية (Arabic)' },
  api_hub: { ar: 'بوابة API والمفاتيح', en: 'API Hub & Keys' },
  switch_account: { ar: 'تبديل الحساب', en: 'Switch Account' },
  logout: { ar: 'تسجيل الخروج', en: 'Sign Out' },
  back: { ar: 'رجوع', en: 'Back' },

  // Common UI
  post: { ar: 'نشر', en: 'Post' },
  posting: { ar: 'جارٍ النشر...', en: 'Posting...' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  save: { ar: 'حفظ', en: 'Save' },
  edit: { ar: 'تعديل', en: 'Edit' },
  remove: { ar: 'إزالة', en: 'Remove' },
  reply: { ar: 'رد', en: 'Reply' },
  report: { ar: 'إبلاغ', en: 'Report' },
  translate: { ar: 'ترجمة', en: 'Translate' },
  show_more: { ar: 'عرض المزيد', en: 'Show more' },
  show_less: { ar: 'عرض أقل', en: 'Show less' },
  search: { ar: 'بحث...', en: 'Search...' },
  all: { ar: 'الكل', en: 'All' },
  send: { ar: 'إرسال', en: 'Send' },

  // Social & Stories
  your_story: { ar: 'قصتك', en: 'Your Story' },
  share_moment: { ar: 'شارك لحظة أو فكرة...', en: 'Share a moment or thought...' },
  reposted_by: { ar: 'أعاد النشر', en: 'Reposted' },
  audio_library: { ar: 'استوديو الصوت والموسيقى', en: 'Audio & Music Studio' },
  record_voice_1m: { ar: 'تسجيل صوتي (حتى دقيقة)', en: 'Record Voice (max 1 min)' },
  upload_audio: { ar: 'رفع ملف صوتي', en: 'Upload Audio' },
  my_uploads: { ar: 'مرفوعاتي', en: 'My Audio' },
  add_comment: { ar: 'أضف تعليقًا...', en: 'Add a comment...' },

  // Chat & Calls
  chat_personal: { ar: 'شخصي', en: 'Personal' },
  chat_groups: { ar: 'مجموعات', en: 'Groups' },
  chat_communities: { ar: 'مجتمعات', en: 'Communities' },
  chat_calls: { ar: 'الاتصالات', en: 'Calls' },
  new_chat: { ar: 'محادثة جديدة', en: 'New Chat' },
  start_chat_now: { ar: 'ابدأ المحادثة الآن', en: 'Start chatting now' },
  select_chat_hint: { ar: 'اختر محادثة أو ابدأ تواصلًا جديدًا على LM', en: 'Select a chat or start a new conversation on LM' },
  voice_call: { ar: 'مكالمة صوتية', en: 'Voice Call' },
  copy_call_link: { ar: 'نسخ رابط المكالمة', en: 'Copy Call Link' },
  active_call: { ar: 'مكالمة نشطة', en: 'Active Call' },
  pin_chat: { ar: 'تثبيت بالأعلى', en: 'Pin to top' },
  unpin_chat: { ar: 'إلغاء التثبيت', en: 'Unpin' },
  chat_info: { ar: 'معلومات المحادثة', en: 'Chat Info' },
  group_info: { ar: 'معلومات المجموعة', en: 'Group Info' },
  community_info: { ar: 'معلومات المجتمع', en: 'Community Info' },
  clear_chat: { ar: 'مسح رسائل المحادثة', en: 'Clear Chat History' },
  delete_group: { ar: 'حذف المجموعة بالكامل', en: 'Delete Group Permanently' },
  ai_permanent_member: { ar: 'تفعيل LM AI كعضو دائم (مرة واحدة)', en: 'Enable LM AI Permanent Member (One-time)' },
  ai_already_active: { ar: 'LM AI مفعّل كعضو دائم في هذه المجموعة', en: 'LM AI is permanently active in this group' },

  // Live
  go_live: { ar: 'ابدأ بثًا', en: 'Go Live' },
  end_live: { ar: 'إنهاء', en: 'End' },
  portrait_mode: { ar: 'طولي (9:16)', en: 'Portrait (9:16)' },
  landscape_mode: { ar: 'بالعرض (16:9)', en: 'Landscape (16:9)' },
  live_studio_title: { ar: 'استوديو البث المباشر', en: 'Live Broadcast Studio' },
  start_broadcast_now: { ar: 'بدء البث المباشر الآن', en: 'Start Live Broadcast' },
  latest_comments: { ar: 'أحدث التعليقات', en: 'Latest comments' },

  // Pulse
  tab_following: { ar: 'متابعون', en: 'Following' },
  tab_friends: { ar: 'أصدقاء', en: 'Friends' },
  tab_for_you: { ar: 'لك', en: 'For You' },
  follow: { ar: 'متابعة', en: 'Follow' },

  // Profile
  edit_profile: { ar: 'تعديل الملف', en: 'Edit Profile' },
  posts_tab: { ar: 'المنشورات', en: 'Posts' },
  pulse_tab: { ar: 'نبض', en: 'Pulse' },
  saved_tab: { ar: 'المحفوظات', en: 'Saved' },
  followers: { ar: 'متابِع', en: 'Followers' },
  following: { ar: 'يتابع', en: 'Following' },
  message: { ar: 'مراسلة', en: 'Message' },

  // AI
  ai_greeting: { ar: 'كيف أساعدك اليوم؟', en: 'How can I help you today?' },
  ai_placeholder: { ar: 'اكتب رسالتك أو أرفق صورة...', en: 'Type a message or attach an image...' },
  ai_history: { ar: 'السجل', en: 'History' },
  ai_new_chat: { ar: 'جديد', en: 'New' },
} as const;

export type I18nKey = keyof typeof DICT;

export function t(lang: Lang, key: I18nKey): string {
  return DICT[key][lang] || DICT[key].ar;
}
