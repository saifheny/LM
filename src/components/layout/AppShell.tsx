import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  LogOut,
  X,
  Plus,
  Paperclip,
  LayoutGrid,
  PanelRightClose,
  PanelLeftClose,
} from 'lucide-react';
import { Lang, NavTab, UserProfile } from '../../types';
import { LmBrandMark, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import {
  NavCommunityIcon,
  NavPulseIcon,
  NavLiveIcon,
  NavChatIcon,
  NavAiIcon,
} from '../shared/Icons2026Pro';
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
  icon: React.ComponentType<{ active?: boolean; className?: string }>;
  liveDot?: boolean;
}> = [
  { id: 'social', ar: 'المجتمع', en: 'Feed', icon: NavCommunityIcon },
  { id: 'videos', ar: 'نبض', en: 'Pulse', icon: NavPulseIcon },
  { id: 'live', ar: 'مباشر', en: 'Live', icon: NavLiveIcon, liveDot: true },
  { id: 'chat', ar: 'الدردشة', en: 'Chat', icon: NavChatIcon },
  { id: 'ai', ar: 'LM AI', en: 'LM AI', icon: NavAiIcon },
];

/**
 * Responsive Split-Action Orb beside Floating Composers:
 * - On LAPTOP / DESKTOP (md+): Direct single Paperclip button (only if onAttach is provided; hidden if not needed!)
 * - On MOBILE (< md): Tactile + Orb that splits upward smoothly into 2 ascending pills:
 *     1) إرفاق ملف (Attach)
 *     2) الشريط السفلي (Opens full-width pitch-black-edged Bottom Dock — NO X button!)
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
    <>
      {/* LAPTOP / DESKTOP: Direct Clean Paperclip Button ONLY (No + menu clutter!) */}
      {onAttach && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onAttach();
          }}
          title="إرفاق ملف"
          className="hidden md:flex w-[48px] h-[48px] rounded-full bg-[#14141A]/95 backdrop-blur-xl border border-white/[0.11] text-[#A1A1AA] hover:text-white hover:border-white/25 items-center justify-center cursor-pointer shrink-0 transition-colors"
        >
          <Paperclip className="w-[19px] h-[19px]" strokeWidth={1.85} />
        </button>
      )}

      {/* MOBILE: Ascending 2-Choice Split Orb (Collapses smoothly when typing!) */}
      <AnimatePresence initial={false}>
        {!composerFocused && (
          <motion.div
            key="split-orb-mobile"
            initial={{ opacity: 0, width: 0, scale: 0.82 }}
            animate={{ opacity: 1, width: 'auto', scale: 1 }}
            exit={{ opacity: 0, width: 0, scale: 0.82 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="md:hidden relative shrink-0"
          >
            <AnimatePresence>
              {splitOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.8 }}
                  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                  onClick={e => e.stopPropagation()}
                  className="absolute bottom-[58px] start-0 z-40 flex flex-col gap-2 items-start"
                >
                  {onAttach && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 14, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.03, duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                      onClick={() => {
                        setSplitOpen(false);
                        onAttach();
                      }}
                      className="h-10 px-4 rounded-full bg-[#09090C]/96 backdrop-blur-2xl border border-white/[0.15] text-xs font-medium text-[#F2F2F5] hover:bg-white hover:text-black flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-2xl transition-colors"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>إرفاق ملف</span>
                    </motion.button>
                  )}

                  {showNavOption && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 20, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.07, duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                      onClick={() => {
                        setSplitOpen(false);
                        setBottomDockHidden(false);
                        setMobileNavExpanded(true);
                      }}
                      className="h-10 px-4 rounded-full bg-[#09090C]/96 backdrop-blur-2xl border border-white/[0.15] text-xs font-medium text-[#F2F2F5] hover:bg-white hover:text-black flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-2xl transition-colors"
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
                setSplitOpen(v => !v);
              }}
              aria-label="خيارات"
              className={`w-[48px] h-[48px] rounded-full bg-[#0B0B0E]/95 backdrop-blur-2xl border transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-95 ${
                splitOpen ? 'border-white/35 text-white bg-[#1A1A22]' : 'border-white/[0.13] text-[#D4D4D8] hover:text-white'
              }`}
            >
              <Plus className={`w-5 h-5 transition-transform duration-200 ${splitOpen ? 'rotate-45' : ''}`} strokeWidth={1.9} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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

  // ChatGPT / Gemini-style Floating Collapsible Desktop Sidebar State (Persisted across refresh, ZERO reflow lag!)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lm_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });

  function toggleSidebarCollapsed(next: boolean) {
    setSidebarCollapsed(next);
    try {
      localStorage.setItem('lm_sidebar_collapsed', next ? '1' : '0');
    } catch {
      // ignore
    }
  }

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

  function handleMainScroll(e: React.UIEvent<HTMLElement>) {
    const top = e.currentTarget.scrollTop;
    const delta = top - lastScrollTopRef.current;
    if (top < 28) {
      setBottomDockHidden(false);
    } else if (delta > 14) {
      setBottomDockHidden(true);
    } else if (delta < -10) {
      setBottomDockHidden(false);
    }
    lastScrollTopRef.current = top;
  }

  const isComposerManagedView =
    activeTab === 'live' || activeTab === 'ai' || (activeTab === 'chat' && chatInThread);

  const shouldRenderMobileBottomDock =
    !composerFocused && (!isComposerManagedView || mobileNavExpanded);

  const showPulseCornerOrb = activeTab === 'videos' && bottomDockHidden && !composerFocused;
  const isFullHeightViewport = activeTab === 'videos' || activeTab === 'live' || activeTab === 'chat' || activeTab === 'ai';
  const CollapseIcon = lang === 'ar' ? PanelRightClose : PanelLeftClose;

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="h-screen w-screen bg-[#0A0A0C] text-[#F2F2F5] overflow-hidden flex select-none">
      {/* DESKTOP / LAPTOP FLOATING COLLAPSIBLE SIDEBAR (Instant single-frame switch — ZERO WaveSurfer/Swiper reflow lag!) */}
      <aside
        style={{ contain: 'layout style' }}
        className={`hidden md:flex flex-col justify-between shrink-0 my-2.5 ms-2.5 h-[calc(100%-20px)] rounded-[24px] bg-[#0C0C10]/94 backdrop-blur-xl border border-white/[0.09] shadow-[0_14px_40px_rgba(0,0,0,0.55)] py-3.5 px-2 z-30 overflow-hidden ${
          sidebarCollapsed ? 'w-[66px]' : 'w-[216px]'
        }`}
      >
        <div className="space-y-4">
          {/* Top Brand + Collapse/Expand Toggle */}
          <div className={`flex items-center h-10 ${sidebarCollapsed ? 'justify-center' : 'justify-between px-1.5'}`}>
            <button
              type="button"
              onClick={() => {
                if (sidebarCollapsed) toggleSidebarCollapsed(false);
                else onSelectTab('social');
              }}
              title={sidebarCollapsed ? 'توسيع القائمة' : 'LM'}
              className="flex items-center gap-2.5 cursor-pointer group shrink-0"
            >
              <LmBrandMark size={34} />
              {!sidebarCollapsed && (
                <span className="text-[16px] font-semibold tracking-tight text-white">LM</span>
              )}
            </button>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => toggleSidebarCollapsed(true)}
                title="تصغير القائمة"
                className="w-8 h-8 rounded-xl hover:bg-white/[0.07] text-[#7A7A85] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <CollapseIcon className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </button>
            )}
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  title={lang === 'ar' ? item.ar : item.en}
                  className={`w-full h-11 rounded-2xl flex items-center transition-colors cursor-pointer ${
                    sidebarCollapsed ? 'justify-center px-0' : 'gap-3.5 px-3'
                  } text-[14px] ${
                    active
                      ? 'bg-white/[0.11] text-white font-semibold'
                      : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="relative flex items-center justify-center shrink-0">
                    <Icon active={active} className="w-[21px] h-[21px]" />
                    {item.liveDot && (
                      <span className="absolute -top-0.5 -end-0.5 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                    )}
                  </span>
                  {!sidebarCollapsed && <span className="truncate">{lang === 'ar' ? item.ar : item.en}</span>}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title={lang === 'ar' ? 'بحث' : 'Search'}
              className={`w-full h-11 rounded-2xl flex items-center text-[14px] text-[#8E8E93] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer ${
                sidebarCollapsed ? 'justify-center px-0' : 'gap-3.5 px-3'
              }`}
            >
              <Search className="w-[20px] h-[20px] shrink-0" strokeWidth={1.75} />
              {!sidebarCollapsed && <span className="truncate">{lang === 'ar' ? 'بحث' : 'Search'}</span>}
            </button>
          </nav>
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            title="API Hub"
            className={`w-full h-10 rounded-2xl flex items-center text-[13.5px] transition-colors cursor-pointer ${
              sidebarCollapsed ? 'justify-center px-0' : 'gap-3.5 px-3'
            } ${
              activeTab === 'settings'
                ? 'bg-white/[0.11] text-white font-semibold'
                : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <SlidersHorizontal className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
            {!sidebarCollapsed && <span className="truncate">API Hub</span>}
          </button>

          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className={`w-full p-2 rounded-2xl hover:bg-white/[0.05] flex items-center cursor-pointer transition-colors text-start ${
              sidebarCollapsed ? 'justify-center' : 'gap-2.5'
            }`}
          >
            <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={34} online={wsOnline} />
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">{user.displayName}</div>
                <div className="text-[11px] text-[#7A7A85] font-mono-num truncate">@{user.username}</div>
              </div>
            )}
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

      {/* 2026 MOBILE BOTTOM DOCK: Pitch-Black Outer/Side Framing (#000000) + Top-Rounded Only + Center-Pinch Implosion! */}
      <AnimatePresence>
        {shouldRenderMobileBottomDock && (
          <motion.nav
            key="mobile-bottom-sheet-dock"
            style={{ transformOrigin: '50% 100%' }}
            initial={{ scaleX: 0.24, scaleY: 0.45, y: 46, opacity: 0, borderTopLeftRadius: 48, borderTopRightRadius: 48 }}
            animate={
              bottomDockHidden
                ? {
                    scaleX: 0.16,
                    scaleY: 0.35,
                    y: 48,
                    opacity: 0,
                    borderTopLeftRadius: 60,
                    borderTopRightRadius: 60,
                    pointerEvents: 'none' as const,
                  }
                : {
                    scaleX: 1,
                    scaleY: 1,
                    y: 0,
                    opacity: 1,
                    borderTopLeftRadius: 26,
                    borderTopRightRadius: 26,
                    pointerEvents: 'auto' as const,
                  }
            }
            exit={{ scaleX: 0.16, scaleY: 0.35, y: 48, opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
            onClick={e => e.stopPropagation()}
            className="md:hidden fixed bottom-0 inset-x-0 z-40 rounded-b-none bg-black/96 backdrop-blur-2xl border-t border-x border-white/[0.12] px-3 pt-2.5 pb-3 shadow-[0_-14px_38px_rgba(0,0,0,0.85)]"
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
                    className={`relative flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-2xl transition-all duration-200 cursor-pointer ${
                      active ? 'text-white' : 'text-[#7A7A85] hover:text-[#D4D4D8]'
                    }`}
                  >
                    <span className="relative flex items-center justify-center">
                      <Icon active={active} className="w-[22px] h-[22px]" />
                      {item.liveDot && (
                        <span className="absolute -top-0.5 -end-1 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                      )}
                    </span>
                    <span className={`text-[10px] leading-none ${active ? 'font-semibold text-white' : 'font-medium'}`}>
                      {lang === 'ar' ? item.ar : item.en}
                    </span>
                    {active && (
                      <motion.span
                        layoutId="dock-active-bar"
                        className="absolute -top-1 w-6 h-[2.5px] rounded-full bg-white"
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

      {/* PULSE ("نبض") CORNER MORPH ORB */}
      <AnimatePresence>
        {showPulseCornerOrb && (
          <motion.button
            key="pulse-corner-dock-orb"
            type="button"
            initial={{ opacity: 0, scale: 0.4, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.4, y: 16 }}
            transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }}
            onClick={e => {
              e.stopPropagation();
              setBottomDockHidden(false);
            }}
            aria-label="إظهار الشريط السفلي"
            className="md:hidden fixed bottom-4 start-4 z-40 w-11 h-11 rounded-full bg-black/90 backdrop-blur-2xl border border-white/[0.16] text-white flex items-center justify-center shadow-2xl cursor-pointer active:scale-90"
          >
            <LayoutGrid className="w-[19px] h-[19px]" strokeWidth={1.9} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Account Switcher Modal */}
      {accountOpen && (
        <div
          onClick={() => setAccountOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end md:items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[340px] rounded-2xl bg-[#131318] border border-white/[0.12] overflow-hidden text-start"
          >
            <div className="px-4 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={36} online={wsOnline} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white flex items-center gap-1.5 truncate">
                    <span>{user.displayName}</span>
                    {user.verified && <VerifiedIcon />}
                  </div>
                  <div className="text-xs text-[#7A7A85] font-mono-num">@{user.username}</div>
                </div>
              </div>
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
            className="w-full max-w-[540px] bg-[#131318] border border-white/[0.12] rounded-2xl overflow-hidden text-start"
          >
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-3">
              <Search className="w-4 h-4 text-[#7A7A85]" />
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
                className="w-6 h-6 rounded-full flex items-center justify-center text-[#7A7A85] hover:text-white cursor-pointer"
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
                        <div className="text-[11px] text-[#7A7A85]">@{u.username}</div>
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
                      <div className="text-[11px] text-[#7A7A85] mt-0.5">@{String(p.username)}</div>
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
