import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Lang, NavTab, ThemeId, UserProfile } from '../types';
import { api } from '../lib/api';

export interface ToastItem {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

export interface PendingAiShare {
  title: string;
  content: string;
  source: 'post_summary' | 'video_summary' | 'chat';
}

interface AppContextValue {
  user: UserProfile | null;
  allUsers: UserProfile[];
  lang: Lang;
  setLang: (l: Lang) => void;
  activeTab: NavTab;
  setActiveTab: (t: NavTab) => void;
  wsConnected: boolean;
  wsListeners: React.MutableRefObject<Set<(event: string, payload: unknown) => void>>;
  loginUser: (u: UserProfile) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshAllUsers: () => Promise<void>;
  setUserLocal: (u: UserProfile) => void;
  toast: (message: string, tone?: ToastItem['tone']) => void;
  toasts: ToastItem[];
  pendingAiShare: PendingAiShare | null;
  sendToAi: (share: PendingAiShare) => void;
  clearPendingAiShare: () => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('lm_lang') as Lang) || 'ar');
  const [activeTab, setActiveTab] = useState<NavTab>('chat');
  const [wsConnected, setWsConnected] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingAiShare, setPendingAiShare] = useState<PendingAiShare | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const wsListeners = useRef(new Set<(event: string, payload: unknown) => void>());

  const toast = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3600);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('lm_lang', l);
  }, []);

  // Sync HTML dir, lang & theme tokens
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    const theme: ThemeId = user?.theme || 'obsidian';
    document.documentElement.setAttribute('data-theme', theme);
    document.title = user?.customAppName ? `${user.customAppName} — المنصة الرقمية المتكاملة` : 'LM — المنصة الرقمية المتكاملة';
  }, [user?.theme, user?.customAppName]);

  const refreshAllUsers = useCallback(async () => {
    try {
      const data = await api<{ users: UserProfile[] }>('/api/auth/users');
      setAllUsers(data.users);
    } catch {
      // handled gracefully
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await api<{ user: UserProfile }>(`/api/users/${user.id}`);
      setUser(data.user);
      localStorage.setItem('lm_user_id', data.user.id);
    } catch {
      // ignore
    }
  }, [user?.id]);

  // Restore last logged-in user on boot
  useEffect(() => {
    refreshAllUsers();
    const savedId = localStorage.getItem('lm_user_id');
    if (savedId) {
      api<{ user: UserProfile }>(`/api/users/${savedId}`)
        .then(d => setUser(d.user))
        .catch(() => localStorage.removeItem('lm_user_id'));
    }
  }, [refreshAllUsers]);

  // WebSocket live connection with automatic reconnect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let alive = true;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        if (alive) retryTimer = setTimeout(connect, 2000);
      };
      ws.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as { event: string; payload: unknown };
          for (const listener of wsListeners.current) {
            listener(parsed.event, parsed.payload);
          }
        } catch {
          // ignore malformed frame
        }
      };
    };

    connect();
    return () => {
      alive = false;
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  // Global Ctrl+K shortcut for search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loginUser = useCallback((u: UserProfile) => {
    setUser(u);
    localStorage.setItem('lm_user_id', u.id);
    refreshAllUsers();
  }, [refreshAllUsers]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('lm_user_id');
  }, []);

  const sendToAi = useCallback((share: PendingAiShare) => {
    setPendingAiShare(share);
    setActiveTab('ai');
  }, []);

  const clearPendingAiShare = useCallback(() => setPendingAiShare(null), []);

  return (
    <AppContext.Provider
      value={{
        user,
        allUsers,
        lang,
        setLang,
        activeTab,
        setActiveTab,
        wsConnected,
        wsListeners,
        loginUser,
        logout,
        refreshUser,
        refreshAllUsers,
        setUserLocal: setUser,
        toast,
        toasts,
        pendingAiShare,
        sendToAi,
        clearPendingAiShare,
        searchOpen,
        setSearchOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
