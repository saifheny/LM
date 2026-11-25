import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
import { RankBadge, UserAvatar, VipBadge } from '../shared/LmBrandMark';
import {
  IconChat2026,
  IconReels2026,
  IconFeed2026,
  IconLive2026,
  IconAiOrb2026,
  IconCrown2026,
  IconMarkets2026,
  IconSystems2026,
} from '../shared/Icons2026';
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
    Icon: React.ComponentType<{ active?: boolean; size?: number }>;
    dot?: 'purple' | 'red';
  }> = [
    { id: 'chat', labelAr: 'الدردشة', labelEn: 'Chat', Icon: IconChat2026, dot: 'purple' },
    { id: 'videos', labelAr: 'ريلز', labelEn: 'Reels', Icon: IconReels2026 },
    { id: 'social', labelAr: 'المجتمع', labelEn: 'Social', Icon: IconFeed2026 },
    { id: 'live', labelAr: 'مباشر', labelEn: 'Live', Icon: IconLive2026, dot: 'red' },
    { id: 'ai', labelAr: 'LM AI', labelEn: 'LM AI', Icon: IconAiOrb2026 },
    { id: 'vip', labelAr: 'VIP', labelEn: 'VIP', Icon: IconCrown2026 },
    { id: 'finance', labelAr: 'الأسواق', labelEn: 'Markets', Icon: IconMarkets2026 },
    { id: 'settings', labelAr: 'الربط', labelEn: 'Hub', Icon: IconSystems2026 },
  ];

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      api<{ users: UserProfile[]; posts: Array<Record<string, unknown>>; videos: Array<Record<string, unknown>>; groups: Array<Record<string, unknown>> }>(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      )
        .then(setSearchResults)
        .catch(() => {});
    }, 120);
    return () => clearTimeout(t);
  }, [searchOpen, searchQuery]);

  if (!user) return null;

  async function toggleVisualSystem() {
    if (!user) return;
    const nextTheme: ThemeId = user.theme === 'alabaster' ? 'obsidian' : 'alabaster';
    const res = await api<{ user: UserProfile }>(`/api/users/${user.id}/customize`, {
      method: 'POST',
      body: JSON.stringify({ theme: nextTheme }),
    });
    setUserLocal(res.user);
    toast(
      nextTheme === 'alabaster'
        ? (isAr ? 'النظام النهاري البلوري (Pearl Vision 2026)' : 'Pearl Vision 2026')
        : (isAr ? 'النظام الفضائي الداكن (Cosmos Glass 2026)' : 'Cosmos Glass 2026'),
      'info'
    );
  }

  // Full-bleed video screens extend behind the floating liquid-glass dock
  const fullBleedBehindDock = activeTab === 'videos';

  return (
    <div className="h-full w-full relative overflow-hidden bg-[var(--lm-bg)] text-[var(--lm-text)]">
      {/* MAIN STAGE */}
      <main className={`w-full h-full overflow-hidden ${fullBleedBehindDock ? '' : 'pb-[82px]'}`}>
        {children}
      </main>

      {/* ============================================================
          2026 FLOATING LIQUID-GLASS SPATIAL BOTTOM DOCK
         ============================================================ */}
      <div className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-2 pointer-events-none select-none">
        <motion.nav
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          className={`pointer-events-auto rounded-full px-2 py-1.5 flex items-center gap-0.5 sm:gap-1 max-w-full overflow-x-auto no-scrollbar ${
            fullBleedBehindDock
              ? 'bg-black/55 backdrop-blur-2xl border border-white/20 text-white shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.28)]'
              : 'liquid-glass'
          }`}
        >
          {dockItems.map((item) => {
            const active = activeTab === item.id;
            const IconComp = item.Icon;
            return (
              <motion.button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                whileHover={{ y: -3, scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                className={`relative px-2.5 sm:px-3.5 py-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 cursor-pointer shrink-0 transition-colors ${
                  active
                    ? 'text-[var(--lm-text)]'
                    : fullBleedBehindDock
                    ? 'text-white/65 hover:text-white'
                    : 'text-[var(--lm-text-secondary)] hover:text-[var(--lm-text)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="activeDockCapsule"
                    transition={{ type: 'spring', stiffness: 430, damping: 32 }}
                    className={`absolute inset-0 rounded-full ${
                      fullBleedBehindDock
                        ? 'bg-white/18 border border-white/25'
                        : 'bg-[var(--lm-accent-soft)] border border-[var(--lm-accent)]/35'
                    }`}
                  />
                )}

                <span className="relative z-10">
                  <IconComp active={active} size={22} />
                  {item.dot && (
                    <span
                      className={`absolute -top-0.5 -end-1 w-2 h-2 rounded-full ${
                        item.dot === 'red' ? 'bg-[#FF2D55] animate-ping' : 'bg-[#7C5CFF]'
                      }`}
                    />
                  )}
                </span>

                <span className={`relative z-10 text-[10px] leading-none tracking-tight ${active ? 'font-bold' : 'font-medium'}`}>
                  {isAr ? item.labelAr : item.labelEn}
                </span>
              </motion.button>
            );
          })}

          {/* Subtle Specular Divider */}
          <span className="w-px h-7 bg-[var(--lm-border-strong)] mx-1 shrink-0" />

          {/* Quick Spotlight Search */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setSearchOpen(true)}
            title="Ctrl+K"
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </motion.button>

          {/* 1-Tap 2026 Dual Visual System Switcher (Cosmos Dark <-> Pearl Light) */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 12 }}
            whileTap={{ scale: 0.92 }}
            onClick={toggleVisualSystem}
            title={isAr ? 'التبديل بين النظام الفضائي الداكن والبلوري النهاري' : 'Switch 2026 Visual System'}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer"
          >
            {user.theme === 'alabaster' ? <Moon className="w-4 h-4 text-indigo-600" /> : <Sun className="w-4 h-4 text-amber-300" />}
          </motion.button>

          {/* User Avatar Capsule */}
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setProfileMenuOpen(v => !v)}
            className="ps-0.5 pe-1 cursor-pointer shrink-0"
          >
            <UserAvatar
              initials={user.avatarInitials}
              color={user.avatarColor}
              avatarUrl={user.avatarUrl}
              size={34}
              vipTier={user.vipTier}
              online
            />
          </motion.button>
        </motion.nav>
      </div>

      {/* FLOATING LIQUID-GLASS PROFILE & ACCOUNT SWITCHER */}
      <AnimatePresence>
        {profileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="fixed bottom-22 left-1/2 -translate-x-1/2 w-80 liquid-glass rounded-3xl p-3 z-50"
            >
              <div className="p-3 rounded-2xl bg-[var(--lm-surface-2)] flex items-center gap-3">
                <UserAvatar
                  initials={user.avatarInitials}
                  color={user.avatarColor}
                  avatarUrl={user.avatarUrl}
                  size={44}
                  vipTier={user.vipTier}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{isAr ? user.displayName : user.displayNameEn}</div>
                  <div dir="ltr" className="text-[11px] text-[var(--lm-text-muted)] font-mono-num">@{user.username}</div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <VipBadge tier={user.vipTier} compact />
                    <RankBadge rankId={user.rankId} lang={lang} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 my-2.5">
                <button
                  onClick={() => setLang(isAr ? 'en' : 'ar')}
                  className="py-2 px-3 rounded-xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {isAr ? 'English' : 'العربية'}
                </button>
                <button
                  onClick={() => { setProfileMenuOpen(false); setActiveTab('vip'); }}
                  className="py-2 px-3 rounded-xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] text-xs font-mono-num flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{COUNTRY_META[user.country].flag}</span>
                  <span>{COUNTRY_META[user.country].currency}</span>
                </button>
              </div>

              <div className="space-y-1 max-h-44 overflow-y-auto">
                {allUsers
                  .filter(u => u.id !== user.id)
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        loginUser(u);
                        setProfileMenuOpen(false);
                        toast(isAr ? `${u.displayName}` : u.displayNameEn, 'info');
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl hover:bg-[var(--lm-surface-hover)] transition-colors text-start cursor-pointer"
                    >
                      <UserAvatar initials={u.avatarInitials} color={u.avatarColor} avatarUrl={u.avatarUrl} size={30} vipTier={u.vipTier} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{isAr ? u.displayName : u.displayNameEn}</div>
                        <div dir="ltr" className="text-[10px] text-[var(--lm-text-muted)] font-mono-num">@{u.username}</div>
                      </div>
                      <VipBadge tier={u.vipTier} compact />
                    </button>
                  ))}
              </div>

              <div className="mt-2 pt-2 border-t border-[var(--lm-border)]">
                <button
                  onClick={() => { setProfileMenuOpen(false); logout(); }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-2xl text-xs font-semibold text-[#FF2D55] hover:bg-[#FF2D55]/10 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {isAr ? 'تسجيل الخروج' : 'Sign Out'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* SPOTLIGHT SEARCH OVERLAY */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-start justify-center pt-16 px-4"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: -12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -12 }}
              className="w-full max-w-xl liquid-glass rounded-3xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 h-13 border-b border-[var(--lm-border)]">
                <Search className="w-4 h-4 text-[var(--lm-text-muted)]" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث في LM...' : 'Search LM...'}
                  className="flex-1 bg-transparent text-sm outline-none text-[var(--lm-text)] placeholder:text-[var(--lm-text-muted)]"
                />
                <button onClick={() => setSearchOpen(false)} className="p-1 text-[var(--lm-text-muted)] cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[58vh] overflow-y-auto p-4 space-y-4">
                {searchResults && (
                  <>
                    {searchResults.users.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold text-[var(--lm-text-muted)] mb-2 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" /> {isAr ? 'الأشخاص' : 'People'}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {searchResults.users.map(u => (
                            <button
                              key={u.id}
                              onClick={() => { setSearchOpen(false); setActiveTab('chat'); }}
                              className="flex items-center gap-2.5 p-2 rounded-2xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] text-start cursor-pointer"
                            >
                              <UserAvatar initials={u.avatarInitials} color={u.avatarColor} avatarUrl={u.avatarUrl} size={34} vipTier={u.vipTier} />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold truncate">{isAr ? u.displayName : u.displayNameEn}</div>
                                <div dir="ltr" className="text-[10px] text-[var(--lm-text-muted)] font-mono-num">@{u.username}</div>
                              </div>
                              <VipBadge tier={u.vipTier} compact />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.videos.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold text-[var(--lm-text-muted)] mb-2 flex items-center gap-1.5">
                          <Film className="w-3.5 h-3.5" /> {isAr ? 'ريلز' : 'Reels'}
                        </div>
                        <div className="space-y-1.5">
                          {searchResults.videos.map((v) => (
                            <button
                              key={String(v.id)}
                              onClick={() => { setSearchOpen(false); setActiveTab('videos'); }}
                              className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] text-start cursor-pointer"
                            >
                              <span className="text-xs font-medium truncate">{String(v.title)}</span>
                              <span className="text-[10px] text-[var(--lm-text-muted)]">{String(v.tags)}</span>
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
                              className="w-full p-2.5 rounded-2xl bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] text-start cursor-pointer"
                            >
                              <div className="text-xs font-semibold">{String(p.display_name)}</div>
                              <div className="text-[11px] text-[var(--lm-text-secondary)] line-clamp-1 mt-0.5">{String(p.content)}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING CAPSULE TOASTS */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.92 }}
              className="px-4 py-2 rounded-full text-xs font-semibold liquid-glass pointer-events-auto"
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
