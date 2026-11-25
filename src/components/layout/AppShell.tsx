import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  Play,
  Radio,
  MessageCircle,
  Sparkles,
  Search,
  SlidersHorizontal,
  LogOut,
  X,
  LayoutGrid,
} from 'lucide-react';
import { Lang, NavTab, UserProfile } from '../../types';
import { LmBrandMark, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { useLayout } from '../../context/LayoutContext';
import { apiGet } from '../../lib/api';

interface AppShellProps {
  user: UserProfile;
  allUsers: UserProfile[];
  activeTab: NavTab;
  onSelectTab: (t: NavTab) => void;
  lang: Lang;
  onToggleLang: () => void;
  wsOnline: boolean;
  onSwitchUser: (u: UserProfile) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const NAV_ITEMS: Array<{
  id: NavTab;
  ar: string;
  en: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  liveDot?: boolean;
}> = [
  { id: 'social', ar: 'المجتمع', en: 'Feed', icon: Compass },
  { id: 'videos', ar: 'ريلز', en: 'Reels', icon: Play },
  { id: 'live', ar: 'مباشر', en: 'Live', icon: Radio, liveDot: true },
  { id: 'chat', ar: 'الدردشة', en: 'Chat', icon: MessageCircle },
  { id: 'ai', ar: 'LM AI', en: 'LM AI', icon: Sparkles },
];

/**
 * Reusable Mobile Morphing Dock Button that lives side-by-side next to any Floating Composer on Mobile (< md).
 * - When Composer is focused -> this pill collapses smoothly to width 0 & fades out so Composer takes 100% width!
 * - When tapped -> expands into the quick floating 5-tab bar right next to/replacing the shrunk composer!
 * - On Desktop (md+) -> hidden because Desktop uses the permanent clean Side Rail!
 */
export function MobileInlineNavTrigger({ lang }: { lang: Lang }) {
  const { composerFocused, mobileNavExpanded, setMobileNavExpanded, activeTab, onSelectTab } = useLayout();

  return (
    <AnimatePresence initial={false}>
      {!composerFocused && (
        <motion.div
          key="mobile-nav-morph"
          initial={{ opacity: 0, width: 0, scale: 0.85 }}
          animate={{ opacity: 1, width: 'auto', scale: 1 }}
          exit={{ opacity: 0, width: 0, scale: 0.85 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="md:hidden shrink-0 overflow-hidden"
        >
          {mobileNavExpanded ? (
            <div className="h-[52px] px-1.5 rounded-full bg-[#070709]/95 backdrop-blur-md border border-white/[0.12] flex items-center gap-0.5">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setMobileNavExpanded(false);
                    }}
                    title={lang === 'ar' ? item.ar : item.en}
                    className={`w-10 h-10 rounded-full flex items-center justify-center relative cursor-pointer transition-colors ${
                      active ? 'bg-white text-black' : 'text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                    {item.liveDot && !active && (
                      <span className="absolute top-2 end-2 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setMobileNavExpanded(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#71717A] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMobileNavExpanded(true)}
              aria-label="التنقل"
              className="w-[52px] h-[52px] rounded-full bg-[#070709]/95 backdrop-blur-md border border-white/[0.12] text-[#D4D4D8] hover:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
            >
              <LayoutGrid className="w-[19px] h-[19px]" strokeWidth={1.8} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppShell({
  user,
  allUsers,
  activeTab,
  onSelectTab,
  lang,
  onToggleLang,
  wsOnline,
  onSwitchUser,
  onLogout,
  children,
}: AppShellProps) {
  const { composerFocused, hideMobileDock, setComposerFocused, setMobileNavExpanded } = useLayout();
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState<{
    users: UserProfile[];
    posts: Array<Record<string, unknown>>;
    videos: Array<Record<string, unknown>>;
    groups: Array<Record<string, unknown>>;
  } | null>(null);

  useEffect(() => {
    setComposerFocused(false);
    setMobileNavExpanded(false);
  }, [activeTab, setComposerFocused, setMobileNavExpanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      apiGet<{
        ok: boolean;
        users: UserProfile[];
        posts: Array<Record<string, unknown>>;
        videos: Array<Record<string, unknown>>;
        groups: Array<Record<string, unknown>>;
      }>(`/api/search?q=${encodeURIComponent(searchQ)}`)
        .then(d => setSearchRes(d))
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [searchQ, searchOpen]);

  // Views that render their own inline morphing nav beside their floating composer on mobile
  const hasInlineComposerMobile = activeTab === 'chat' || activeTab === 'live' || activeTab === 'ai';
  const isFullHeightViewport = activeTab === 'videos' || activeTab === 'live' || activeTab === 'chat' || activeTab === 'ai';

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="h-screen w-screen bg-black text-[#F5F5F7] overflow-hidden flex select-none">
      {/* DESKTOP / LAPTOP SIDE RAIL (Hidden on Mobile, Clean & Native on Laptop!) */}
      <aside className="hidden md:flex flex-col justify-between w-[72px] lg:w-[216px] shrink-0 h-full bg-black border-e border-white/[0.08] py-5 px-3 z-30">
        <div className="space-y-6">
          {/* Brand Mark */}
          <button
            type="button"
            onClick={() => onSelectTab('social')}
            className="w-full px-2 flex items-center gap-3 cursor-pointer"
          >
            <LmBrandMark size={34} />
            <span className="hidden lg:inline text-[17px] font-semibold tracking-tight text-white">LM</span>
          </button>

          {/* Primary Navigation Items */}
          <nav className="space-y-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full h-11 px-3 rounded-full flex items-center gap-3.5 text-[14.5px] transition-colors cursor-pointer ${
                    active
                      ? 'bg-white/[0.1] text-white font-semibold'
                      : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="relative flex items-center justify-center shrink-0">
                    <Icon className="w-[21px] h-[21px]" strokeWidth={active ? 2.2 : 1.75} />
                    {item.liveDot && (
                      <span className="absolute -top-0.5 -end-0.5 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                    )}
                  </span>
                  <span className="hidden lg:inline truncate">{lang === 'ar' ? item.ar : item.en}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-full h-11 px-3 rounded-full flex items-center gap-3.5 text-[14.5px] text-[#8E8E93] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <Search className="w-[21px] h-[21px] shrink-0" strokeWidth={1.75} />
              <span className="hidden lg:inline truncate">{lang === 'ar' ? 'بحث' : 'Search'}</span>
            </button>
          </nav>
        </div>

        {/* Bottom Side Rail Profile & API Hub */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className={`w-full h-10 px-3 rounded-full flex items-center gap-3.5 text-[13.5px] transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white/[0.1] text-white font-semibold'
                : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <SlidersHorizontal className="w-[19px] h-[19px] shrink-0" strokeWidth={1.8} />
            <span className="hidden lg:inline truncate">API Hub</span>
          </button>

          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="w-full p-2 rounded-full hover:bg-white/[0.05] flex items-center gap-2.5 cursor-pointer transition-colors text-start"
          >
            <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={34} online={wsOnline} />
            <div className="hidden lg:block min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{user.displayName}</div>
              <div className="text-[11px] text-[#71717A] font-mono-num truncate">@{user.username}</div>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content Stage */}
      <main className={`flex-1 min-w-0 h-full bg-black relative ${isFullHeightViewport ? 'overflow-hidden' : 'overflow-y-auto pb-20 md:pb-0'}`}>
        {children}
      </main>

      {/* MOBILE FLOATING BOTTOM DOCK (Only on Mobile < md AND Only when screen doesn't merge inline with a composer!) */}
      {!hasInlineComposerMobile && !hideMobileDock && !composerFocused && (
        <nav className="md:hidden fixed bottom-3 inset-x-0 z-40 flex justify-center px-3 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#070709]/95 backdrop-blur-md border border-white/[0.12]">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    active ? 'bg-white text-black' : 'text-[#8E8E93] hover:text-white'
                  }`}
                >
                  <Icon className="w-[19px] h-[19px]" strokeWidth={active ? 2.2 : 1.8} />
                  {item.liveDot && !active && (
                    <span className="absolute top-2 end-2 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                  )}
                </button>
              );
            })}

            <div className="w-[1px] h-5 bg-white/[0.08] mx-0.5" />

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#8E8E93] hover:text-white cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="p-0.5 rounded-full cursor-pointer"
            >
              <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={28} online={wsOnline} />
            </button>
          </div>
        </nav>
      )}

      {/* Account Switcher & Quick Settings Modal */}
      {accountOpen && (
        <div
          onClick={() => setAccountOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end md:items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[340px] rounded-2xl bg-[#070709] border border-white/[0.12] overflow-hidden text-start"
          >
            <div className="px-4 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={36} online={wsOnline} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white flex items-center gap-1.5 truncate">
                    <span>{user.displayName}</span>
                    {user.verified && <VerifiedIcon />}
                  </div>
                  <div className="text-xs text-[#71717A] font-mono-num">@{user.username}</div>
                </div>
              </div>
              <button type="button" onClick={() => setAccountOpen(false)} className="text-[#71717A] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-1 border-b border-white/[0.08]">
              {allUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onSwitchUser(u);
                    setAccountOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between text-xs hover:bg-white/[0.04] cursor-pointer ${
                    u.id === user.id ? 'text-white font-semibold' : 'text-[#A1A1AA]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={26} />
                    <span>{u.displayName}</span>
                  </div>
                  {u.id === user.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </button>
              ))}
            </div>

            <div className="p-2 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => {
                  onSelectTab('settings');
                  setAccountOpen(false);
                }}
                className="flex-1 px-3 py-2 rounded-xl hover:bg-white/[0.05] text-xs text-[#E4E4E7] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>API Hub</span>
              </button>

              <button
                type="button"
                onClick={onToggleLang}
                className="px-3 py-2 rounded-xl hover:bg-white/[0.05] text-xs font-mono-num text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                {lang === 'ar' ? 'EN' : 'AR'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  onLogout();
                }}
                className="px-3 py-2 rounded-xl hover:bg-white/[0.05] text-xs text-[#EF4444] flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Search Overlay */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[540px] bg-[#060608] border border-white/[0.12] rounded-2xl overflow-hidden text-start"
          >
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-3">
              <Search className="w-4 h-4 text-[#71717A]" />
              <input
                autoFocus
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder={lang === 'ar' ? 'ابحث...' : 'Search...'}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-[#52525B] outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[#71717A] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto divide-y divide-white/[0.08]">
              {searchRes?.users && searchRes.users.length > 0 && (
                <div className="py-2">
                  {searchRes.users.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        onSwitchUser(u);
                        setSearchOpen(false);
                      }}
                      className="w-full px-4 py-2 flex items-center gap-3 hover:bg-white/[0.04] cursor-pointer text-start"
                    >
                      <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={32} />
                      <div>
                        <div className="text-xs font-semibold text-white">{u.displayName}</div>
                        <div className="text-[11px] text-[#71717A]">@{u.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchRes?.posts && searchRes.posts.length > 0 && (
                <div className="py-2">
                  {searchRes.posts.map(p => (
                    <button
                      key={String(p.id)}
                      type="button"
                      onClick={() => {
                        onSelectTab('social');
                        setSearchOpen(false);
                      }}
                      className="w-full px-4 py-2 hover:bg-white/[0.04] cursor-pointer text-start"
                    >
                      <div className="text-xs text-[#E4E4E7] line-clamp-1">{String(p.content)}</div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">@{String(p.username)}</div>
                    </button>
                  ))}
                </div>
              )}

              {searchRes?.videos && searchRes.videos.length > 0 && (
                <div className="py-2">
                  {searchRes.videos.map(v => (
                    <button
                      key={String(v.id)}
                      type="button"
                      onClick={() => {
                        onSelectTab('videos');
                        setSearchOpen(false);
                      }}
                      className="w-full px-4 py-2 hover:bg-white/[0.04] cursor-pointer text-start"
                    >
                      <div className="text-xs text-[#E4E4E7] line-clamp-1">{String(v.title)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
