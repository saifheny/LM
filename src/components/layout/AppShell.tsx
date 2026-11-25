import React, { useEffect, useRef, useState } from 'react';
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
  Plus,
  Paperclip,
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
 * Innovative 2026 Split-Action Orb beside Floating Composers:
 * - Tapping splits smoothly UPWARD (right above bottom, NOT center screen) into 2 ascending action pills:
 *   1) إرفاق ملف (Attach)
 *   2) الشريط السفلي (Open Full Bottom Dock without any X button — tap empty space to restore!)
 * - Collapses cleanly to width 0 when user focuses the composer input!
 */
export function SplitComposerOrb({
  onAttach,
  showNavOption = true,
}: {
  onAttach?: () => void;
  showNavOption?: boolean;
}) {
  const { composerFocused, setMobileNavExpanded, setBottomDockHidden } = useLayout();
  const [splitOpen, setSplitOpen] = useState(false);

  useEffect(() => {
    if (composerFocused) setSplitOpen(false);
  }, [composerFocused]);

  return (
    <AnimatePresence initial={false}>
      {!composerFocused && (
        <motion.div
          key="split-orb-wrap"
          initial={{ opacity: 0, width: 0, scale: 0.82 }}
          animate={{ opacity: 1, width: 'auto', scale: 1 }}
          exit={{ opacity: 0, width: 0, scale: 0.82 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="relative shrink-0"
        >
          {/* Ascending Split Choices Right Above the Orb */}
          <AnimatePresence>
            {splitOpen && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.86 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.86 }}
                transition={{ type: 'spring', stiffness: 460, damping: 28 }}
                onClick={e => e.stopPropagation()}
                className="absolute bottom-[58px] start-0 z-40 flex flex-col gap-2 items-start"
              >
                {onAttach && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 14, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.03, type: 'spring', stiffness: 480, damping: 26 }}
                    onClick={() => {
                      setSplitOpen(false);
                      onAttach();
                    }}
                    className="h-10 px-3.5 rounded-full bg-[#16161C]/95 backdrop-blur-xl border border-white/[0.14] text-xs font-medium text-[#F2F2F5] hover:bg-white hover:text-black flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-xl transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>إرفاق ملف</span>
                  </motion.button>
                )}

                {showNavOption && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 18, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.06, type: 'spring', stiffness: 480, damping: 26 }}
                    onClick={() => {
                      setSplitOpen(false);
                      setBottomDockHidden(false);
                      setMobileNavExpanded(true);
                    }}
                    className="md:hidden h-10 px-3.5 rounded-full bg-[#16161C]/95 backdrop-blur-xl border border-white/[0.14] text-xs font-medium text-[#F2F2F5] hover:bg-white hover:text-black flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-xl transition-colors"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>الشريط السفلي</span>
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              // On desktop where bottom dock isn't needed, clicking directly attaches if only attach exists, else splits
              if (!showNavOption && onAttach) {
                onAttach();
                return;
              }
              setSplitOpen(v => !v);
            }}
            aria-label="خيارات إضافية"
            className={`w-[48px] h-[48px] rounded-full bg-[#131318]/95 backdrop-blur-xl border transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-95 ${
              splitOpen ? 'border-white/35 text-white bg-[#1D1D24]' : 'border-white/[0.12] text-[#D4D4D8] hover:text-white'
            }`}
          >
            <Plus className={`w-5 h-5 transition-transform duration-200 ${splitOpen ? 'rotate-45' : ''}`} strokeWidth={1.9} />
          </button>
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
  const {
    composerFocused,
    mobileNavExpanded,
    bottomDockHidden,
    chatInThread,
    setComposerFocused,
    setMobileNavExpanded,
    setBottomDockHidden,
  } = useLayout();

  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState<{
    users: UserProfile[];
    posts: Array<Record<string, unknown>>;
    videos: Array<Record<string, unknown>>;
    groups: Array<Record<string, unknown>>;
  } | null>(null);

  const mainRef = useRef<HTMLElement | null>(null);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    setComposerFocused(false);
    setMobileNavExpanded(false);
    setBottomDockHidden(false);
  }, [activeTab, setComposerFocused, setMobileNavExpanded, setBottomDockHidden]);

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

  // Scroll-reactive bottom dock shrink/hide downward on scroll down, reappear smoothly on scroll up!
  function handleMainScroll(e: React.UIEvent<HTMLElement>) {
    const top = e.currentTarget.scrollTop;
    const delta = top - lastScrollTopRef.current;
    if (top < 24) {
      setBottomDockHidden(false);
    } else if (delta > 10) {
      setBottomDockHidden(true);
    } else if (delta < -6) {
      setBottomDockHidden(false);
    }
    lastScrollTopRef.current = top;
  }

  // On mobile: Bottom Dock is visible on Social, Reels, Settings, Chat List (!chatInThread), OR whenever user expanded it from Split Orb!
  const isComposerManagedView =
    activeTab === 'live' || activeTab === 'ai' || (activeTab === 'chat' && chatInThread);

  const shouldRenderMobileBottomDock =
    !composerFocused && (!isComposerManagedView || mobileNavExpanded);

  const isFullHeightViewport = activeTab === 'videos' || activeTab === 'live' || activeTab === 'chat' || activeTab === 'ai';

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="h-screen w-screen bg-[#0A0A0C] text-[#F2F2F5] overflow-hidden flex select-none">
      {/* DESKTOP / LAPTOP SIDE RAIL */}
      <aside className="hidden md:flex flex-col justify-between w-[72px] lg:w-[214px] shrink-0 h-full bg-[#0A0A0C] border-e border-white/[0.07] py-5 px-3 z-30">
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => onSelectTab('social')}
            className="w-full px-2 flex items-center gap-3 cursor-pointer"
          >
            <LmBrandMark size={34} />
            <span className="hidden lg:inline text-[17px] font-semibold tracking-tight text-white">LM</span>
          </button>

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
                      ? 'bg-white/[0.11] text-white font-semibold'
                      : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="relative flex items-center justify-center shrink-0">
                    <Icon className="w-[20px] h-[20px]" strokeWidth={active ? 2.2 : 1.75} />
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
              <Search className="w-[20px] h-[20px] shrink-0" strokeWidth={1.75} />
              <span className="hidden lg:inline truncate">{lang === 'ar' ? 'بحث' : 'Search'}</span>
            </button>
          </nav>
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className={`w-full h-10 px-3 rounded-full flex items-center gap-3.5 text-[13.5px] transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white/[0.11] text-white font-semibold'
                : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <SlidersHorizontal className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
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
      <main
        ref={mainRef}
        onScroll={handleMainScroll}
        className={`flex-1 min-w-0 h-full relative ${
          activeTab === 'videos' || activeTab === 'live' ? 'bg-black' : 'bg-[#0A0A0C]'
        } ${isFullHeightViewport ? 'overflow-hidden' : 'overflow-y-auto pb-20 md:pb-0'}`}
      >
        {children}
      </main>

      {/* 2026 MOBILE FULL-WIDTH TOP-ROUNDED BOTTOM DOCK (rounded-t-[26px] rounded-b-none, NO X button, Scroll Shrink-Down Animation!) */}
      <AnimatePresence>
        {shouldRenderMobileBottomDock && (
          <motion.nav
            key="mobile-bottom-sheet-dock"
            initial={{ y: 84, scale: 0.9, opacity: 0 }}
            animate={
              bottomDockHidden
                ? { y: 86, scale: 0.84, opacity: 0, pointerEvents: 'none' as const }
                : { y: 0, scale: 1, opacity: 1, pointerEvents: 'auto' as const }
            }
            exit={{ y: 84, scale: 0.88, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={e => e.stopPropagation()}
            className="md:hidden fixed bottom-0 inset-x-0 z-40 rounded-t-[26px] rounded-b-none bg-[#121216]/94 backdrop-blur-2xl border-t border-white/[0.11] px-3 pt-2.5 pb-3 shadow-[0_-10px_30px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-around gap-1">
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
                    className={`relative flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-2xl transition-colors cursor-pointer ${
                      active ? 'text-white' : 'text-[#7A7A85] hover:text-[#D4D4D8]'
                    }`}
                  >
                    <span className="relative flex items-center justify-center">
                      <Icon className="w-[21px] h-[21px]" strokeWidth={active ? 2.3 : 1.75} />
                      {item.liveDot && (
                        <span className="absolute -top-0.5 -end-1 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                      )}
                    </span>
                    <span className={`text-[10px] leading-none ${active ? 'font-semibold text-white' : 'font-medium'}`}>
                      {lang === 'ar' ? item.ar : item.en}
                    </span>
                    {active && (
                      <motion.span
                        layoutId="dock-active-dot"
                        className="absolute -top-1 w-5 h-[2.5px] rounded-full bg-white"
                      />
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                className="flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-2xl cursor-pointer"
              >
                <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={24} online={wsOnline} />
                <span className="text-[10px] leading-none text-[#7A7A85]">{lang === 'ar' ? 'حسابي' : 'Me'}</span>
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Account Switcher & Quick Settings Modal */}
      {accountOpen && (
        <div
          onClick={() => setAccountOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end md:items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[340px] rounded-2xl bg-[#121216] border border-white/[0.12] overflow-hidden text-start"
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

      {/* Search Overlay */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[540px] bg-[#121216] border border-white/[0.12] rounded-2xl overflow-hidden text-start"
          >
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-3">
              <Search className="w-4 h-4 text-[#71717A]" />
              <input
                autoFocus
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder={lang === 'ar' ? 'ابحث...' : 'Search...'}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-[#585860] outline-none"
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
