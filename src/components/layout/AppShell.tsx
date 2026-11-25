import React, { useEffect, useState } from 'react';
import {
  Compass,
  Play,
  Radio,
  MessageCircle,
  Sparkles,
  LineChart,
  Search,
  SlidersHorizontal,
  LogOut,
  X,
} from 'lucide-react';
import { Lang, NavTab, UserProfile } from '../../types';
import { LmBrandMark, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
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

  const navItems: Array<{ id: NavTab; ar: string; en: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; liveDot?: boolean }> = [
    { id: 'social', ar: 'المجتمع', en: 'Feed', icon: Compass },
    { id: 'videos', ar: 'ريلز', en: 'Reels', icon: Play },
    { id: 'live', ar: 'مباشر', en: 'Live', icon: Radio, liveDot: true },
    { id: 'chat', ar: 'الدردشة', en: 'Chat', icon: MessageCircle },
    { id: 'ai', ar: 'LM AI', en: 'LM AI', icon: Sparkles },
    { id: 'finance', ar: 'الأسواق', en: 'Markets', icon: LineChart },
  ];

  const isImmersive = activeTab === 'videos' || activeTab === 'live';

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="h-screen w-screen bg-black text-[#F5F5F7] overflow-hidden relative select-none">
      {/* Main Full-Bleed Pure #000000 Stage */}
      <main className={`w-full h-full bg-black ${isImmersive ? 'overflow-hidden' : 'overflow-y-auto pb-24'}`}>
        {children}
      </main>

      {/* Unified Minimal Matte Bottom Dock (Zero Glow, Zero Clutter) */}
      <nav className="fixed bottom-3.5 inset-x-0 z-40 flex justify-center px-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#050506]/95 backdrop-blur-md border border-white/[0.1]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative px-3 sm:px-3.5 py-2 rounded-full flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#F5F5F7] text-black font-semibold'
                    : 'text-[#8E8E93] hover:text-[#F5F5F7] hover:bg-white/[0.05]'
                }`}
              >
                <span className="relative flex items-center">
                  <Icon className="w-4 h-4" strokeWidth={active ? 2.2 : 1.8} />
                  {item.liveDot && (
                    <span className="absolute -top-0.5 -end-0.5 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                  )}
                </span>
                <span className="hidden md:inline">{lang === 'ar' ? item.ar : item.en}</span>
              </button>
            );
          })}

          <div className="w-[1px] h-5 bg-white/[0.08] mx-0.5" />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            title={lang === 'ar' ? 'بحث شامل (Ctrl+K)' : 'Search (Ctrl+K)'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8E8E93] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" strokeWidth={1.8} />
          </button>

          <button
            type="button"
            onClick={() => setAccountOpen(v => !v)}
            className="ps-1 pe-1.5 py-0.5 rounded-full hover:bg-white/[0.06] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <UserAvatar initials={user.avatarInitials} avatarUrl={user.avatarUrl} size={28} online={wsOnline} />
          </button>
        </div>
      </nav>

      {/* Clean Monochrome Account & API Hub Popover */}
      {accountOpen && (
        <div
          onClick={() => setAccountOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center pb-20 px-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[340px] rounded-2xl bg-[#070709] border border-white/[0.1] overflow-hidden text-start"
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
              <LmBrandMark size={28} />
            </div>

            <div className="py-1 border-b border-white/[0.08]">
              <div className="px-4 py-1.5 text-[11px] text-[#71717A]">
                {lang === 'ar' ? 'تبديل سريع للحساب' : 'Switch Account'}
              </div>
              {allUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onSwitchUser(u);
                    setAccountOpen(false);
                  }}
                  className={`w-full px-4 py-2 flex items-center justify-between text-xs hover:bg-white/[0.04] cursor-pointer ${
                    u.id === user.id ? 'text-white font-semibold' : 'text-[#A1A1AA]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={24} />
                    <span>{u.displayName}</span>
                  </div>
                  {u.id === user.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </button>
              ))}
            </div>

            <div className="p-1.5 flex items-center justify-between gap-1">
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

      {/* Clean Hairline Search Overlay */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[540px] bg-[#050507] border border-white/[0.12] rounded-2xl overflow-hidden text-start"
          >
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-3">
              <Search className="w-4 h-4 text-[#71717A]" />
              <input
                autoFocus
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder={lang === 'ar' ? 'ابحث في الحسابات، النقاشات، الريلز، المجموعات...' : 'Search users, threads, reels, groups...'}
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
                  <div className="px-4 py-1 text-[11px] text-[#71717A]">{lang === 'ar' ? 'أشخاص' : 'People'}</div>
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
                  <div className="px-4 py-1 text-[11px] text-[#71717A]">{lang === 'ar' ? 'المجتمع' : 'Threads'}</div>
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
                  <div className="px-4 py-1 text-[11px] text-[#71717A]">{lang === 'ar' ? 'ريلز' : 'Reels'}</div>
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
