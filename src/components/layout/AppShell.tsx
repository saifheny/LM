import React, { useEffect, useState } from 'react';
import {
  Home,
  PlaySquare,
  Radio,
  MessageSquare,
  Cpu,
  Crown,
  Landmark,
  SlidersHorizontal,
  Search,
  Globe,
  LogOut,
  ChevronDown,
  X,
  Sun,
  Moon,
  Users,
  FileText,
  Film,
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
    wsConnected,
    loginUser,
    logout,
    setUserLocal,
    toast,
    toasts,
    searchOpen,
    setSearchOpen,
  } = useApp();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    users: UserProfile[];
    posts: Array<Record<string, unknown>>;
    videos: Array<Record<string, unknown>>;
    groups: Array<Record<string, unknown>>;
  } | null>(null);

  const isAr = lang === 'ar';

  const navItems: Array<{ id: NavTab; labelAr: string; labelEn: string; icon: React.ComponentType<{ className?: string }>; badge?: string }> = [
    { id: 'social', labelAr: 'الرئيسية', labelEn: 'Social', icon: Home },
    { id: 'videos', labelAr: 'فيديوهات', labelEn: 'Shorts', icon: PlaySquare },
    { id: 'live', labelAr: 'بث مباشر', labelEn: 'Live', icon: Radio, badge: 'LIVE' },
    { id: 'chat', labelAr: 'المحادثات', labelEn: 'Chat', icon: MessageSquare },
    { id: 'ai', labelAr: 'LM AI', labelEn: 'LM AI', icon: Cpu },
    { id: 'vip', labelAr: 'VIP والرتب', labelEn: 'VIP & Ranks', icon: Crown },
    { id: 'finance', labelAr: 'المالية والاستثمار', labelEn: 'Finance', icon: Landmark },
    { id: 'settings', labelAr: 'مركز الـ APIs', labelEn: 'API Hub', icon: SlidersHorizontal },
  ];

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      api<{ users: UserProfile[]; posts: Array<Record<string, unknown>>; videos: Array<Record<string, unknown>>; groups: Array<Record<string, unknown>> }>(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      )
        .then(setSearchResults)
        .catch(() => {});
    }, 150);
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

  return (
    <div className="h-full w-full flex flex-col bg-[var(--lm-bg)] text-[var(--lm-text)] overflow-hidden">
      {/* FIXED EXECUTIVE TOP HEADER (56px) */}
      <header className="h-14 shrink-0 px-3 sm:px-5 border-b border-[var(--lm-border)] bg-[var(--lm-surface)] flex items-center justify-between gap-3 z-30">
        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setActiveTab('social')}
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          >
            <LmBrandMark iconStyle={user.customAppIcon} size={32} />
            <div className="text-start hidden sm:block">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-bold text-sm tracking-tight">{user.customAppName || 'LM'}</span>
                {user.prioritySupport && (
                  <span className="text-[10px] font-mono-num px-1.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#E8C85E] border border-[#D4AF37]/30">
                    PRO
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--lm-text-muted)]">
                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span>{wsConnected ? (isAr ? 'متصل لحظيًا' : 'Realtime') : (isAr ? 'إعادة اتصال' : 'Syncing')}</span>
              </div>
            </div>
          </button>
        </div>

        {/* Global Search Trigger — icon-only on tiny mobile so LM logo is never occluded */}
        <button
          onClick={() => setSearchOpen(true)}
          aria-label={isAr ? 'بحث شامل' : 'Global Search'}
          className="sm:flex-1 sm:max-w-md h-8 sm:h-9 w-8 sm:w-auto px-0 sm:px-3 rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)] hover:border-[var(--lm-border-strong)] flex items-center justify-center sm:justify-between text-xs text-[var(--lm-text-muted)] transition-colors cursor-pointer shrink-0 sm:shrink"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline truncate">{isAr ? 'ابحث عن أشخاص، مجموعات، فيديوهات، منشورات...' : 'Search people, groups, shorts, posts...'}</span>
          </span>
          <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono-num rounded bg-[var(--lm-surface)] border border-[var(--lm-border)]">
            Ctrl+K
          </kbd>
        </button>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Country badge */}
          <button
            onClick={() => setActiveTab('vip')}
            title={isAr ? 'التسعير حسب بلد الإقامة' : 'Residency Pricing'}
            className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[var(--lm-border)] bg-[var(--lm-surface-2)] hover:border-[var(--lm-border-strong)] text-xs font-mono-num cursor-pointer"
          >
            <span>{COUNTRY_META[user.country].flag}</span>
            <span>{COUNTRY_META[user.country].currency}</span>
          </button>

          {/* Theme quick toggle */}
          <button
            onClick={toggleLightDark}
            title={isAr ? 'تبديل الوضع الليلي / النهاري' : 'Toggle Light / Dark'}
            className="w-8 h-8 rounded-lg border border-[var(--lm-border)] bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] flex items-center justify-center text-[var(--lm-text-secondary)] cursor-pointer"
          >
            {user.theme === 'alabaster' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {/* Lang toggle */}
          <button
            onClick={() => setLang(isAr ? 'en' : 'ar')}
            className="h-8 px-2.5 rounded-lg border border-[var(--lm-border)] bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] flex items-center gap-1 text-xs font-medium text-[var(--lm-text-secondary)] cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isAr ? 'EN' : 'AR'}</span>
          </button>

          {/* Account Menu / Switcher */}
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen(v => !v)}
              className="h-9 pl-2 pr-2.5 rounded-xl border border-[var(--lm-border)] bg-[var(--lm-surface-2)] hover:border-[var(--lm-border-strong)] flex items-center gap-2 cursor-pointer"
            >
              <UserAvatar initials={user.avatarInitials} color={user.avatarColor} size={26} vipTier={user.vipTier} />
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-xs font-semibold max-w-[110px] truncate">{isAr ? user.displayName : user.displayNameEn}</span>
                <span className="text-[10px] text-[var(--lm-text-muted)] font-mono-num">
                  {user.vipTier ? `VIP ${user.vipTier}` : (isAr ? 'حساب عادي' : 'Standard')}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--lm-text-muted)]" />
            </button>

            {switcherOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
                <div
                  className={`absolute top-11 ${isAr ? 'left-0' : 'right-0'} w-72 lm-card rounded-2xl shadow-2xl p-2 z-50`}
                >
                  <div className="p-2.5 border-b border-[var(--lm-border)]">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar initials={user.avatarInitials} color={user.avatarColor} size={36} vipTier={user.vipTier} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{isAr ? user.displayName : user.displayNameEn}</div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <VipBadge tier={user.vipTier} compact />
                          <RankBadge rankId={user.rankId} lang={lang} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="py-1.5">
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--lm-text-muted)]">
                      {isAr ? 'تبديل فوري لحساب آخر للتجربة' : 'Quick Switch Demo Account'}
                    </div>
                    {allUsers
                      .filter(u => u.id !== user.id)
                      .map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            loginUser(u);
                            setSwitcherOpen(false);
                            toast(isAr ? `تم التبديل إلى ${u.displayName}` : `Switched to ${u.displayNameEn}`, 'info');
                          }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[var(--lm-surface-hover)] transition-colors text-start cursor-pointer"
                        >
                          <UserAvatar initials={u.avatarInitials} color={u.avatarColor} size={28} vipTier={u.vipTier} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate">{isAr ? u.displayName : u.displayNameEn}</div>
                            <div dir="ltr" className="text-[10px] text-[var(--lm-text-muted)] font-mono-num inline-block">@{u.username}</div>
                          </div>
                          <VipBadge tier={u.vipTier} compact />
                        </button>
                      ))}
                  </div>

                  <div className="pt-1.5 border-t border-[var(--lm-border)]">
                    <button
                      onClick={() => {
                        setSwitcherOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {isAr ? 'تسجيل الخروج والعودة لصفحة الدخول' : 'Sign Out'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE: SIDEBAR RAIL + ACTIVE VIEW */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop Sidebar Rail */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col justify-between border-e border-[var(--lm-border)] bg-[var(--lm-surface)] p-3 overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-[var(--lm-accent-soft)] text-[var(--lm-text)] border border-[var(--lm-accent)]/30 font-semibold'
                      : 'text-[var(--lm-text-secondary)] hover:bg-[var(--lm-surface-hover)] hover:text-[var(--lm-text)] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[var(--lm-accent)]' : ''}`} />
                    <span className="truncate">{isAr ? item.labelAr : item.labelEn}</span>
                  </span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Compact Status Footer */}
          <div className="mt-4 pt-3 border-t border-[var(--lm-border)] space-y-2">
            <div className="p-3 rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)] space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--lm-text-muted)]">{isAr ? 'العضوية' : 'Plan'}</span>
                <span className="font-mono-num font-semibold text-[var(--lm-text)]">
                  {user.vipTier ? `VIP ${user.vipTier}` : (isAr ? 'مجاني' : 'Free')}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--lm-text-muted)]">{isAr ? 'إعلانات المنصة' : 'Platform Ads'}</span>
                <span className={user.adRemoval.videos && user.adRemoval.ai ? 'text-emerald-400 font-medium' : 'text-[var(--lm-text-secondary)]'}>
                  {user.adRemoval.videos && user.adRemoval.ai ? (isAr ? 'مُزالة' : 'Removed') : (isAr ? 'مفعّلة' : 'Active')}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Active Module Content Viewport */}
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden relative">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (5 core tabs + More drawer for VIP, Finance, API Hub) */}
      <nav className="md:hidden h-14 shrink-0 border-t border-[var(--lm-border)] bg-[var(--lm-surface)] flex items-center justify-around px-1 z-30">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setMobileMoreOpen(false); }}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg text-[10px] cursor-pointer ${
                active ? 'text-[var(--lm-accent)] font-semibold' : 'text-[var(--lm-text-muted)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[54px]">{isAr ? item.labelAr : item.labelEn}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMobileMoreOpen(v => !v)}
          className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg text-[10px] cursor-pointer ${
            activeTab === 'vip' || activeTab === 'finance' || activeTab === 'settings' || mobileMoreOpen
              ? 'text-[var(--lm-accent)] font-semibold'
              : 'text-[var(--lm-text-muted)]'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>{isAr ? 'المزيد' : 'More'}</span>
        </button>
      </nav>

      {/* Mobile More Bottom Sheet */}
      {mobileMoreOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileMoreOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-14 inset-x-3 lm-card rounded-2xl p-3 space-y-1.5 shadow-2xl"
          >
            {navItems.slice(5).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMoreOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer ${
                    active ? 'bg-[var(--lm-accent-soft)] text-[var(--lm-text)] font-semibold' : 'text-[var(--lm-text-secondary)]'
                  }`}
                >
                  <Icon className="w-4 h-4 text-[var(--lm-accent)]" />
                  <span>{isAr ? item.labelAr : item.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* GLOBAL SEARCH COMMAND PALETTE (Ctrl+K) */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-start justify-center pt-16 px-4" onClick={() => setSearchOpen(false)}>
          <div
            className="w-full max-w-2xl lm-card rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 h-12 border-b border-[var(--lm-border)]">
              <Search className="w-4 h-4 text-[var(--lm-text-muted)]" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'ابحث في كل أقسام LM: أشخاص، منشورات، فيديوهات، مجموعات...' : 'Search across all of LM...'}
                className="flex-1 bg-transparent text-sm outline-none text-[var(--lm-text)] placeholder:text-[var(--lm-text-muted)]"
              />
              <button onClick={() => setSearchOpen(false)} className="p-1 text-[var(--lm-text-muted)] hover:text-[var(--lm-text)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-4 space-y-4">
              {searchResults && (
                <>
                  {searchResults.users.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-[var(--lm-text-muted)] mb-2 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> {isAr ? 'الحسابات والأشخاص' : 'People'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {searchResults.users.map(u => (
                          <button
                            key={u.id}
                            onClick={() => { setSearchOpen(false); setActiveTab('social'); }}
                            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] text-start cursor-pointer"
                          >
                            <UserAvatar initials={u.avatarInitials} color={u.avatarColor} size={30} vipTier={u.vipTier} />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold truncate">{isAr ? u.displayName : u.displayNameEn}</div>
                              <div dir="ltr" className="text-[10px] text-[var(--lm-text-muted)] font-mono-num inline-block">@{u.username}</div>
                            </div>
                            <VipBadge tier={u.vipTier} compact />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.groups.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-[var(--lm-text-muted)] mb-2 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" /> {isAr ? 'المجموعات والمجتمعات' : 'Groups & Communities'}
                      </div>
                      <div className="space-y-1.5">
                        {searchResults.groups.map((g) => (
                          <button
                            key={String(g.id)}
                            onClick={() => { setSearchOpen(false); setActiveTab('chat'); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] text-start cursor-pointer"
                          >
                            <div>
                              <div className="text-xs font-semibold">{String(g.title)}</div>
                              <div className="text-[11px] text-[var(--lm-text-muted)]">{String(g.description)}</div>
                            </div>
                            <span className="text-[10px] font-mono-num text-[var(--lm-text-muted)]">
                              {Number(g.member_count).toLocaleString('en-US')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.videos.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-[var(--lm-text-muted)] mb-2 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5" /> {isAr ? 'الفيديوهات القصيرة' : 'Short Videos'}
                      </div>
                      <div className="space-y-1.5">
                        {searchResults.videos.map((v) => (
                          <button
                            key={String(v.id)}
                            onClick={() => { setSearchOpen(false); setActiveTab('videos'); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] text-start cursor-pointer"
                          >
                            <div className="truncate">
                              <div className="text-xs font-semibold truncate">{String(v.title)}</div>
                              <div className="text-[11px] text-[var(--lm-text-muted)] truncate">{String(v.tags)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.posts.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-[var(--lm-text-muted)] mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> {isAr ? 'المنشورات' : 'Posts'}
                      </div>
                      <div className="space-y-1.5">
                        {searchResults.posts.map((p) => (
                          <button
                            key={String(p.id)}
                            onClick={() => { setSearchOpen(false); setActiveTab('social'); }}
                            className="w-full p-2.5 rounded-xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] text-start cursor-pointer"
                          >
                            <div className="text-xs font-semibold">{String(p.display_name)}</div>
                            <div className="text-[11px] text-[var(--lm-text-secondary)] line-clamp-2 mt-0.5">{String(p.content)}</div>
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

      {/* TOAST NOTIFICATIONS */}
      <div className={`fixed bottom-16 md:bottom-5 ${isAr ? 'left-5' : 'right-5'} z-50 flex flex-col gap-2 pointer-events-none`}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl text-xs font-medium shadow-xl border backdrop-blur-md pointer-events-auto max-w-sm ${
              t.tone === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
                : t.tone === 'error'
                ? 'bg-red-950/90 border-red-500/40 text-red-100'
                : t.tone === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-100'
                : 'bg-[var(--lm-surface)] border-[var(--lm-border-strong)] text-[var(--lm-text)]'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
