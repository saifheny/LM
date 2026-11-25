import React, { useEffect, useState } from 'react';
import {
  MessageCircle,
  Compass,
  Play,
  Radio,
  Sparkles,
  Crown,
  TrendingUp,
  SlidersHorizontal,
  Search,
  Globe,
  LogOut,
  X,
  Sun,
  Moon,
  Users,
  Film,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { COUNTRY_META, NavTab, ThemeId, UserProfile } from '../../types';
import { LmBrandMark, RankBadge, UserAvatar, VipBadge } from '../shared/LmBrandMark';
import { api } from '../../lib/api';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const {
    user,
    allUsers,
    lang,
    setLang,
    activeTab,
    setActiveTab,
    loginUser,
    logout,
    setUserLocal,
    toast,
    toasts,
    searchOpen,
    setSearchOpen,
  } = useApp();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    users: UserProfile[];
    posts: Array<Record<string, unknown>>;
    videos: Array<Record<string, unknown>>;
    groups: Array<Record<string, unknown>>;
  } | null>(null);

  const isAr = lang === 'ar';

  const dockItems: Array<{
    id: NavTab;
    labelAr: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeTone?: 'purple' | 'red';
  }> = [
    { id: 'chat', labelAr: 'المحادثات', labelEn: 'Chats', icon: MessageCircle, badge: '3', badgeTone: 'purple' },
    { id: 'videos', labelAr: 'فيديوهات', labelEn: 'Shorts', icon: Play },
    { id: 'social', labelAr: 'المجتمع', labelEn: 'Feed', icon: Compass },
    { id: 'live', labelAr: 'بث مباشر', labelEn: 'Live', icon: Radio, badge: 'LIVE', badgeTone: 'red' },
    { id: 'ai', labelAr: 'LM AI', labelEn: 'LM AI', icon: Sparkles },
    { id: 'vip', labelAr: 'VIP والرتب', labelEn: 'VIP', icon: Crown },
    { id: 'finance', labelAr: 'الأسواق', labelEn: 'Markets', icon: TrendingUp },
    { id: 'settings', labelAr: 'الـ APIs', labelEn: 'APIs', icon: SlidersHorizontal },
  ];

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      api<{ users: UserProfile[]; posts: Array<Record<string, unknown>>; videos: Array<Record<string, unknown>>; groups: Array<Record<string, unknown>> }>(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      )
        .then(setSearchResults)
        .catch(() => {});
    }, 140);
    return () => clearTimeout(t);
  }, [searchOpen, searchQuery]);

  if (!user) return null;

  async function toggleLightDark() {
    if (!user) return;
    const nextTheme: ThemeId = user.theme === 'alabaster' ? 'obsidian' : 'alabaster';
    const res = await api<{ user: UserProfile }>(`/api/users/${user.id}/customize`, {
      method: 'POST',
      body: JSON.stringify({ theme: nextTheme }),
    });
    setUserLocal(res.user);
  }

  const isImmersiveDark = activeTab === 'videos' || activeTab === 'live';

  return (
    <div className="h-full w-full flex flex-col md:flex-row bg-[var(--lm-bg)] text-[var(--lm-text)] overflow-hidden">
      {/* FRAMELESS ICON DOCK (Telegram Desktop / WeChat / Discord Style — NO TOP BAR!) */}
      <aside className="hidden md:flex w-[72px] shrink-0 flex-col items-center justify-between py-3.5 bg-[#0E0E11] text-white border-e border-white/[0.06] z-30 select-none">
        {/* Top Brand Icon + Quick Search */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setActiveTab('chat')}
            title={user.customAppName || 'LM'}
            className="cursor-pointer"
          >
            <LmBrandMark iconStyle={user.customAppIcon} size={40} />
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            title={isAr ? 'بحث شامل (Ctrl+K)' : 'Global Search (Ctrl+K)'}
            className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/75 hover:text-white transition-all cursor-pointer"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Center App Switcher Icons */}
        <nav className="flex flex-col items-center gap-1.5 w-full px-2">
          {dockItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isAr ? item.labelAr : item.labelEn}
                className={`relative group w-full py-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  active
                    ? 'bg-white/[0.11] text-white'
                    : 'text-white/55 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {/* Active Pill Indicator */}
                {active && (
                  <span className="absolute start-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-e-full bg-[#8774E1]" />
                )}
                <div className="relative">
                  <Icon className={`w-[20px] h-[20px] ${active && item.id === 'videos' ? 'fill-current' : ''}`} />
                  {item.badge && (
                    <span
                      className={`absolute -top-1.5 -end-2.5 px-1 min-w-[16px] h-[15px] rounded-full text-[9px] font-mono-num font-bold flex items-center justify-center ${
                        item.badgeTone === 'red'
                          ? 'bg-[#FE2C55] text-white'
                          : 'bg-[#8774E1] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium leading-none tracking-tight truncate max-w-[58px]">
                  {isAr ? item.labelAr : item.labelEn}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Profile Avatar & Quick Preferences */}
        <div className="flex flex-col items-center gap-2.5 relative">
          <button
            onClick={toggleLightDark}
            title={isAr ? 'الوضع الليلي / النهاري' : 'Theme'}
            className="w-9 h-9 rounded-xl hover:bg-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            {user.theme === 'alabaster' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setProfileMenuOpen(v => !v)}
            title={isAr ? user.displayName : user.displayNameEn}
            className="cursor-pointer relative"
          >
            <UserAvatar
              initials={user.avatarInitials}
              color={user.avatarColor}
              avatarUrl={user.avatarUrl}
              size={38}
              vipTier={user.vipTier}
              online
            />
          </button>

          {/* Floating Account Switcher & Quick Settings Popover */}
          {profileMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
              <div
                className={`fixed bottom-4 ${isAr ? 'right-20' : 'left-20'} w-72 rounded-2xl bg-[#1C1D24] text-white border border-white/10 shadow-2xl p-2.5 z-50`}
              >
                <div className="p-2.5 rounded-xl bg-white/[0.04] flex items-center gap-3">
                  <UserAvatar
                    initials={user.avatarInitials}
                    color={user.avatarColor}
                    avatarUrl={user.avatarUrl}
                    size={42}
                    vipTier={user.vipTier}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{isAr ? user.displayName : user.displayNameEn}</div>
                    <div dir="ltr" className="text-[11px] text-white/55 font-mono-num">@{user.username}</div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <VipBadge tier={user.vipTier} compact />
                      <RankBadge rankId={user.rankId} lang={lang} />
                    </div>
                  </div>
                </div>

                {/* Language & Country */}
                <div className="grid grid-cols-2 gap-1.5 my-2">
                  <button
                    onClick={() => setLang(isAr ? 'en' : 'ar')}
                    className="py-1.5 px-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {isAr ? 'English' : 'العربية'}
                  </button>
                  <button
                    onClick={() => { setProfileMenuOpen(false); setActiveTab('vip'); }}
                    className="py-1.5 px-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-[11px] font-mono-num flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{COUNTRY_META[user.country].flag}</span>
                    <span>{COUNTRY_META[user.country].currency}</span>
                  </button>
                </div>

                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {isAr ? 'تبديل سريع بين الحسابات' : 'Switch Account'}
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {allUsers
                    .filter(u => u.id !== user.id)
                    .map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          loginUser(u);
                          setProfileMenuOpen(false);
                          toast(isAr ? `تم التبديل إلى ${u.displayName}` : `Switched to ${u.displayNameEn}`, 'info');
                        }}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/[0.07] transition-colors text-start cursor-pointer"
                      >
                        <UserAvatar
                          initials={u.avatarInitials}
                          color={u.avatarColor}
                          avatarUrl={u.avatarUrl}
                          size={28}
                          vipTier={u.vipTier}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{isAr ? u.displayName : u.displayNameEn}</div>
                          <div dir="ltr" className="text-[10px] text-white/45 font-mono-num">@{u.username}</div>
                        </div>
                        <VipBadge tier={u.vipTier} compact />
                      </button>
                    ))}
                </div>

                <div className="mt-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => { setProfileMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {isAr ? 'تسجيل الخروج' : 'Sign Out'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* FULL-BLEED 100VH STAGE */}
      <main className="flex-1 min-w-0 min-h-0 h-full overflow-hidden relative">
        {children}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (TikTok / Telegram Translucent Style) */}
      <nav
        className={`md:hidden h-14 shrink-0 border-t flex items-center justify-around px-1 z-30 ${
          isImmersiveDark
            ? 'bg-black text-white border-white/10'
            : 'bg-[var(--lm-surface)] text-[var(--lm-text)] border-[var(--lm-border)]'
        }`}
      >
        {dockItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setMobileMoreOpen(false); }}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl text-[10px] cursor-pointer ${
                active ? 'text-[#8774E1] font-bold' : 'opacity-65'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{isAr ? item.labelAr : item.labelEn}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMobileMoreOpen(v => !v)}
          className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl text-[10px] opacity-75 cursor-pointer"
        >
          <UserAvatar
            initials={user.avatarInitials}
            color={user.avatarColor}
            avatarUrl={user.avatarUrl}
            size={22}
            vipTier={user.vipTier}
          />
          <span>{isAr ? 'حسابي' : 'Menu'}</span>
        </button>
      </nav>

      {/* Mobile Drawer */}
      {mobileMoreOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-xs" onClick={() => setMobileMoreOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-14 inset-x-3 rounded-3xl bg-[#1C1D24] text-white border border-white/10 p-4 space-y-2 shadow-2xl"
          >
            {dockItems.slice(5).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-xs font-medium cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-[#8774E1]" />
                  <span>{isAr ? item.labelAr : item.labelEn}</span>
                </button>
              );
            })}
            <button
              onClick={() => { setMobileMoreOpen(false); logout(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 text-xs font-medium cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      )}

      {/* SPOTLIGHT GLOBAL SEARCH OVERLAY (Ctrl+K) */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 px-4" onClick={() => setSearchOpen(false)}>
          <div
            className="w-full max-w-xl rounded-3xl bg-[#1C1D24] text-white border border-white/12 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 h-13 border-b border-white/10">
              <Search className="w-4 h-4 text-white/50" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'ابحث في الرسائل، الأشخاص، الفيديوهات، القنوات...' : 'Search chats, people, shorts, channels...'}
                className="flex-1 bg-transparent text-sm outline-none text-white placeholder:text-white/40"
              />
              <button onClick={() => setSearchOpen(false)} className="p-1 text-white/50 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[62vh] overflow-y-auto p-4 space-y-4">
              {searchResults && (
                <>
                  {searchResults.users.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-white/45 mb-2 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> {isAr ? 'الأشخاص وصناع المحتوى' : 'People'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {searchResults.users.map(u => (
                          <button
                            key={u.id}
                            onClick={() => { setSearchOpen(false); setActiveTab('chat'); }}
                            className="flex items-center gap-2.5 p-2 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-start cursor-pointer"
                          >
                            <UserAvatar initials={u.avatarInitials} color={u.avatarColor} avatarUrl={u.avatarUrl} size={34} vipTier={u.vipTier} />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold truncate">{isAr ? u.displayName : u.displayNameEn}</div>
                              <div dir="ltr" className="text-[10px] text-white/45 font-mono-num">@{u.username}</div>
                            </div>
                            <VipBadge tier={u.vipTier} compact />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.videos.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-white/45 mb-2 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5" /> {isAr ? 'الفيديوهات القصيرة' : 'Shorts'}
                      </div>
                      <div className="space-y-1.5">
                        {searchResults.videos.map((v) => (
                          <button
                            key={String(v.id)}
                            onClick={() => { setSearchOpen(false); setActiveTab('videos'); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-start cursor-pointer"
                          >
                            <span className="text-xs font-medium truncate">{String(v.title)}</span>
                            <span className="text-[10px] text-white/45">{String(v.tags)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.posts.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-white/45 mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> {isAr ? 'المنشورات' : 'Posts'}
                      </div>
                      <div className="space-y-1.5">
                        {searchResults.posts.map((p) => (
                          <button
                            key={String(p.id)}
                            onClick={() => { setSearchOpen(false); setActiveTab('social'); }}
                            className="w-full p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-start cursor-pointer"
                          >
                            <div className="text-xs font-semibold">{String(p.display_name)}</div>
                            <div className="text-[11px] text-white/60 line-clamp-1 mt-0.5">{String(p.content)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SLEEK PILL TOASTS */}
      <div className={`fixed bottom-16 md:bottom-5 ${isAr ? 'left-5' : 'right-5'} z-50 flex flex-col gap-2 pointer-events-none`}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-4 py-2.5 rounded-full text-xs font-medium shadow-2xl bg-[#202024]/95 text-white border border-white/12 backdrop-blur-md pointer-events-auto max-w-sm"
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
